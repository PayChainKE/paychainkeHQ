import crypto from 'crypto';
import mongoose from 'mongoose';
import Waitlist from '../models/Waitlist.js';
import Merchant from '../models/Merchant.js';
import { sendWaitlistConfirmation, sendMerchantInvite } from '../utils/resend.js';
import { getNcbaVirtualAccountNumber, validatePhoneNumber, isValidPhoneInputFormat, NcbaValidationError } from '../utils/ncbaValidators.js';
import { isValidEmail, EMAIL_FORMAT_HINT } from '../utils/emailValidator.js';

const MERCHANT_DASHBOARD_URL =
  process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

const ALLOWED_STATUSES = ['pending', 'contacted', 'approved', 'rejected', 'converted'];

// ── Public ────────────────────────────────────────────────────────────

// @desc    Join Waitlist (public — landing page form)
// @route   POST /api/waitlist
// @access  Public
export const joinWaitlist = async (req, res) => {
  const { fullName, businessName, phone, email, businessType, challenge } = req.body;

  try {
    if (email) {
      const existing = await Waitlist.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'This email is already on our waitlist!' });
      }
    }

    const subscriber = await Waitlist.create({
      fullName,
      businessName,
      phone,
      email,
      businessType,
      challenge,
    });

    if (email) {
      sendWaitlistConfirmation(email, fullName).catch((err) =>
        console.error('Waitlist confirmation email failed:', err)
      );
    }

    res.status(201).json({ success: true, message: 'Successfully joined the waitlist' });
  } catch (error) {
    console.error('Waitlist Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────

// @desc    Get all waitlist entries (full list — UI handles paging/filtering)
// @route   GET /api/waitlist
// @access  Private (Admin)
export const getWaitlist = async (req, res) => {
  try {
    const entries = await Waitlist.find({})
      .sort({ priority: -1, createdAt: -1 })
      .populate('updatedBy', 'email')
      .populate('convertedMerchantId', 'email businessName')
      .lean();
    res.json(entries);
  } catch (error) {
    console.error('Get Waitlist Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Pipeline analytics — counts, conversion rate, avg time-to-status.
// @route   GET /api/waitlist/analytics
// @access  Private (Admin)
export const getWaitlistAnalytics = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [statusAgg, totalCount, recentCount, convertedAgg, typeAgg] = await Promise.all([
      Waitlist.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Waitlist.countDocuments(),
      Waitlist.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      // Average days-to-convert (createdAt → convertedAt) for converted rows.
      Waitlist.aggregate([
        { $match: { status: 'converted', convertedAt: { $ne: null } } },
        {
          $project: {
            days: {
              $divide: [{ $subtract: ['$convertedAt', '$createdAt'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        { $group: { _id: null, avgDays: { $avg: '$days' } } },
      ]),
      // Top business types by frequency.
      Waitlist.aggregate([
        { $group: { _id: '$businessType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const byStatus = ALLOWED_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    statusAgg.forEach((row) => { byStatus[row._id || 'pending'] = row.count; });

    const convertedTotal = byStatus.converted || 0;
    const conversionRate = totalCount > 0 ? (convertedTotal / totalCount) * 100 : 0;

    res.json({
      success: true,
      data: {
        total: totalCount,
        recent7d: recentCount,
        byStatus,
        conversionRate: Number(conversionRate.toFixed(1)),
        avgDaysToConvert: convertedAgg[0]?.avgDays != null ? Number(convertedAgg[0].avgDays.toFixed(1)) : null,
        topBusinessTypes: typeAgg.map((row) => ({ type: row._id || 'Unknown', count: row.count })),
      },
    });
  } catch (error) {
    console.error('Waitlist Analytics Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update pipeline status. Stamps contactedAt the first time the
//          entry transitions to 'contacted', and tracks the admin who did it.
// @route   PUT /api/waitlist/:id/status
// @access  Private (Admin)
export const updateWaitlistStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const entry = await Waitlist.findById(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    // Convert is a separate, heavier endpoint that mints a merchant. Block here.
    if (status === 'converted') {
      return res.status(400).json({ error: 'Use the convert endpoint to mark an entry as converted.' });
    }

    entry.status = status;
    if (status === 'contacted' && !entry.contactedAt) entry.contactedAt = new Date();
    entry.updatedBy = req.admin?._id || null;
    await entry.save();

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Update Waitlist Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle priority star on a waitlist entry.
// @route   PUT /api/waitlist/:id/priority
// @access  Private (Admin)
export const toggleWaitlistPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const entry = await Waitlist.findById(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });
    entry.priority = !!priority;
    entry.updatedBy = req.admin?._id || null;
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Toggle Waitlist Priority Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Save internal admin notes on a waitlist entry.
// @route   PUT /api/waitlist/:id/notes
// @access  Private (Admin)
export const updateWaitlistNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const trimmed = String(notes || '').slice(0, 2000);
    const entry = await Waitlist.findById(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });
    entry.notes = trimmed || null;
    entry.updatedBy = req.admin?._id || null;
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Update Waitlist Notes Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete a waitlist entry (hard delete — entry is a candidate, not
//          a real business record yet).
// @route   DELETE /api/waitlist/:id
// @access  Private (Admin)
export const deleteWaitlistEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const result = await Waitlist.deleteOne({ _id: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Entry not found.' });
    res.json({ success: true, message: 'Entry removed.' });
  } catch (error) {
    console.error('Delete Waitlist Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Convert a waitlist entry to a real Merchant — mints a unique
//          5-digit account number + a 24h password-setup token, emails the
//          merchant the secure setup link, and marks the entry as
//          'converted' with a reference to the new Merchant.
// @route   POST /api/waitlist/:id/convert
// @access  Private (Admin)
export const convertWaitlistEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }

    const entry = await Waitlist.findById(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });
    if (entry.status === 'converted') {
      return res.status(409).json({ error: 'This entry has already been converted.' });
    }
    if (!entry.email) {
      return res.status(400).json({ error: 'Cannot convert: this entry has no email address.' });
    }
    if (!isValidEmail(entry.email)) {
      return res.status(400).json({ error: `This entry's email ("${entry.email}") isn't a valid format — correct it on the waitlist entry before converting.` });
    }

    // Reject if a merchant with this email/phone already exists — the admin
    // either onboarded them already or there's a data conflict.
    const phone = String(entry.phone || '').replace(/\s+/g, '');
    if (phone) {
      if (!isValidPhoneInputFormat(phone)) {
        return res.status(400).json({ error: `This entry's phone number ("${phone}") isn't a valid Kenyan mobile number format (+254, 07, or 01) — correct it on the waitlist entry before converting.` });
      }
      try {
        validatePhoneNumber(phone);
      } catch (e) {
        if (e instanceof NcbaValidationError) {
          return res.status(400).json({ error: `This entry's phone number ("${phone}") isn't a valid Kenyan mobile number — correct it on the waitlist entry before converting.` });
        }
        throw e;
      }
    }
    if (await Merchant.exists({ email: entry.email })) {
      return res.status(409).json({ error: 'A merchant with that email already exists.' });
    }
    if (phone && await Merchant.exists({ phone })) {
      return res.status(409).json({ error: 'A merchant with that phone already exists.' });
    }

    // paybillAccount (the old 5-digit shared-Paybill sub-account) is
    // deliberately no longer assigned to new merchants — the live payment
    // rail is the NCBA virtual account (ncbaMerchantCode), auto-assigned by
    // the Merchant model's pre-save hook.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const merchant = await Merchant.create({
      name: entry.fullName,
      email: entry.email,
      phone,
      businessName: entry.businessName,
      registrationSource: 'web',
      isVerified: true,
      invitedBy: req.admin?._id || null,
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });

    const setupLink = `${MERCHANT_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;
    sendMerchantInvite(entry.email, entry.fullName, entry.businessName, setupLink, getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode), merchant.ncbaMerchantCode)
      .catch((err) => console.error('Convert: invite email failed:', err));

    entry.status = 'converted';
    entry.convertedAt = new Date();
    entry.convertedMerchantId = merchant._id;
    entry.updatedBy = req.admin?._id || null;
    await entry.save();

    res.json({
      success: true,
      message: 'Waitlist entry converted to merchant. Setup invite emailed.',
      data: {
        waitlistId: entry._id,
        merchantId: merchant._id,
        ncbaMerchantCode: merchant.ncbaMerchantCode,
        ncbaVirtualAccountNumber: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode),
        email: entry.email,
      },
    });
  } catch (error) {
    console.error('Convert Waitlist Error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A merchant with that email or phone already exists.' });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};
