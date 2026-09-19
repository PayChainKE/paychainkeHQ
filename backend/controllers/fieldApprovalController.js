import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { computePrechecks } from '../utils/applicationPrechecks.js';
import { actorFor, finalizeApproval, scopedToOfficer } from './officerController.js';
import {
  FieldApprovalError, applyFieldApproval, dailyApprovalCap, fieldReadiness, paymentDetailsOf, sendPaymentDetailsSms,
} from '../services/fieldApprovalService.js';

const CHECKLIST_KEYS = ['legalNameMatch', 'ubosIdentified', 'kraPinVerified', 'tillVerified', 'businessTypeCompliant'];

const summaryOf = (a) => ({
  _id: a._id, businessName: a.businessName, name: a.name, phone: a.phone, email: a.email, businessType: a.businessType, kybStatus: a.kybStatus,
});

async function loadOwn(req, { withPassword = false } = {}) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return null;
  const q = Merchant.findOne({ _id: req.params.id, kybStatus: { $exists: true }, ...scopedToOfficer(req.admin) });
  return withPassword ? q.select('+password') : q;
}

// @desc    What stands between this application and an on-site approval, the
//          risk tier the system would assign, and today's approval allowance.
// @route   GET /api/officer/applications/:id/field-readiness
// @access  Private (Officer)
export const getFieldReadiness = async (req, res) => {
  try {
    const app = await loadOwn(req);
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    const readiness = await fieldReadiness(app, req.admin._id);
    res.json({ success: true, data: { application: summaryOf(app), ...readiness, payment: paymentDetailsOf(app) } });
  } catch (error) {
    console.error('Field Readiness Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Approve on site: the officer confirms what they verified in person,
//          the system runs every gate, and on success the merchant is approved,
//          texted their Paybill + account number, and sent the set-password
//          link on their OWN phone. The set-password link is never returned
//          to the officer — that would let the officer set the merchant's
//          password and take over the account.
// @route   POST /api/officer/applications/:id/field-approve
// @access  Private (Officer)
export const fieldApprove = async (req, res) => {
  try {
    const attestation = req.body?.attestation || {};
    if (!CHECKLIST_KEYS.every((k) => attestation[k] === true)) {
      return res.status(400).json({ error: 'Confirm every item on the checklist to approve.' });
    }
    const app = await loadOwn(req, { withPassword: true });
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    for (const k of CHECKLIST_KEYS) app.kybChecklist[k] = true;
    const result = await applyFieldApproval(app, req, finalizeApproval);
    res.json({ success: true, data: { application: summaryOf(app), ...result } });
  } catch (error) {
    if (error instanceof FieldApprovalError) return res.status(error.status).json({ error: error.message, blockers: error.blockers });
    console.error('Field Approve Error:', error?.message || error);
    if (error.code === 11000) return res.status(409).json({ error: 'Could not allocate account details — please retry.' });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Resend the Paybill + account number SMS (the merchant lost it, wrong
//          number shown, etc.). Spaced and capped so it can't spam a number.
// @route   POST /api/officer/applications/:id/payment-details-sms
// @access  Private (Officer)
export const resendPaymentDetails = async (req, res) => {
  try {
    const app = await loadOwn(req);
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.kybStatus !== 'approved') return res.status(400).json({ error: 'Only approved merchants can be sent their payment details.' });
    const fa = app.fieldApproval || {};
    if (fa.detailsSmsAt && Date.now() - new Date(fa.detailsSmsAt).getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'A text was just sent. Please wait a minute before resending.' });
    }
    if ((fa.detailsSmsCount || 0) >= 5) {
      return res.status(429).json({ error: 'The payment details have already been sent 5 times. Contact an admin.' });
    }
    const result = await sendPaymentDetailsSms(app);
    if (result === 'no_phone') return res.status(400).json({ error: 'No valid phone number on file for this merchant.' });
    if (result === 'failed') return res.status(502).json({ error: 'The text could not be sent just now. Please try again in a moment.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Resend Payment Details Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Admin review of on-site approvals ─────────────────────────────────

// @desc    Merchants an officer approved on site, for an admin's after-the-fact
//          review. Defaults to those still waiting for review.
// @route   GET /api/officer/field-approvals?status=pending_review|confirmed|frozen
// @access  Private (Owner/Admin)
export const listFieldApprovals = async (req, res) => {
  try {
    const status = ['pending_review', 'confirmed', 'frozen'].includes(req.query.status) ? req.query.status : 'pending_review';
    const [items, counts] = await Promise.all([
      Merchant.find({ 'fieldApproval.reviewStatus': status })
        .sort({ 'fieldApproval.approvedAt': -1 })
        .limit(50)
        .populate('fieldApproval.officerId', 'name email')
        .select('businessName name phone email businessType county kybDocuments businessPhotos riskTier fieldApproval status nationalId kraPin businessNumber onboardingOfficerId flagged')
        .lean(),
      Promise.all(['pending_review', 'confirmed', 'frozen'].map((s) => Merchant.countDocuments({ 'fieldApproval.reviewStatus': s }))),
    ]);
    const data = await Promise.all(items.map(async (m) => ({
      _id: m._id,
      businessName: m.businessName,
      ownerName: m.name,
      phone: m.phone,
      businessType: m.businessType,
      county: m.county,
      riskTier: m.fieldApproval?.riskTier,
      approvedAt: m.fieldApproval?.approvedAt,
      officer: m.fieldApproval?.officerId ? { name: m.fieldApproval.officerId.name, email: m.fieldApproval.officerId.email } : null,
      reviewStatus: m.fieldApproval?.reviewStatus,
      reviewNote: m.fieldApproval?.reviewNote,
      accountStatus: m.status,
      photos: (m.businessPhotos || []).length,
      documents: (m.kybDocuments || []).length,
      flags: await computePrechecks(m).catch(() => []),
    })));
    res.json({ success: true, data, counts: { pending_review: counts[0], confirmed: counts[1], frozen: counts[2] } });
  } catch (error) {
    console.error('List Field Approvals Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark an on-site approval as reviewed and fine.
// @route   POST /api/officer/field-approvals/:id/confirm
// @access  Private (Owner/Admin)
export const confirmFieldApproval = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const m = await Merchant.findOneAndUpdate(
      { _id: req.params.id, 'fieldApproval.reviewStatus': 'pending_review' },
      { $set: { 'fieldApproval.reviewStatus': 'confirmed', 'fieldApproval.reviewedAt': new Date(), 'fieldApproval.reviewedBy': req.admin._id, 'fieldApproval.reviewNote': String(req.body?.note || '').trim().slice(0, 500) || null } },
      { returnDocument: 'after' }
    );
    if (!m) return res.status(404).json({ error: 'No on-site approval waiting for review with that id.' });
    logAudit({
      action: 'admin.field_approval.confirmed', category: 'admin', severity: 'info',
      message: 'On-site approval reviewed and confirmed', merchant: m, actor: actorFor(req.admin), req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Confirm Field Approval Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Freeze an account after an on-site approval turned out wrong. Locks
//          the account and signs out every device, exactly as an admin lock
//          does — but without the OTP step, because freezing only reduces
//          risk and the point is to be able to do it fast.
// @route   POST /api/officer/field-approvals/:id/freeze
// @access  Private (Owner/Admin)
export const freezeFieldApproval = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (reason.length < 5) return res.status(400).json({ error: 'Give a reason for freezing this account.' });
    const m = await Merchant.findOne({ _id: req.params.id, 'fieldApproval.reviewStatus': { $in: ['pending_review', 'confirmed'] } });
    if (!m) return res.status(404).json({ error: 'On-site approval not found.' });

    m.status = 'locked';
    m.lockedAt = new Date();
    m.lockedBy = req.admin._id;
    m.tokenVersion = (m.tokenVersion || 0) + 1;
    m.flagged = true;
    m.flagReason = `Frozen after on-site approval review: ${reason}`;
    m.flaggedAt = new Date();
    m.fieldApproval.reviewStatus = 'frozen';
    m.fieldApproval.reviewedAt = new Date();
    m.fieldApproval.reviewedBy = req.admin._id;
    m.fieldApproval.reviewNote = reason;
    await m.save();

    logAudit({
      action: 'admin.field_approval.frozen', category: 'admin', severity: 'critical',
      message: `Account frozen after on-site approval review: ${reason}`, merchant: m, actor: actorFor(req.admin), req,
      metadata: { reason },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Freeze Field Approval Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

export { dailyApprovalCap };
