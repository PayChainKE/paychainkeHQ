import crypto from 'crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { recordDeletion } from '../utils/trash.js';
import { adminActor } from './adminController.js';
import { sendOfficerCredentials } from '../utils/resend.js';
import { toE164Kenyan } from '../utils/notificationService.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';

// Onboarding-officer account management — admin/owner only. Deliberately a
// separate controller from teamController.js: team members (owner/admin/
// analyst) self-set their password via an emailed setup link, but officers
// can never self-service a password change (see authController.changePassword's
// officer guard) — an admin sets it directly at creation and on any reset,
// so the flows genuinely diverge rather than sharing teamController's
// ALLOWED_ROLES/invite-link path.

const OFFICER_LOGIN_URL = process.env.OFFICER_DASHBOARD_URL || 'https://officer.paychain.co.ke';

const safeOfficer = (a) => ({
  _id: a._id,
  email: a.email,
  phone: a.phone,
  name: a.name,
  role: a.role,
  status: a.status,
  lastLogin: a.lastLogin,
  loginCount: a.loginCount,
  invitedAt: a.invitedAt,
  invitedBy: a.invitedBy,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

const generatePassword = () => crypto.randomBytes(9).toString('base64url'); // ~12 chars

// @desc    List onboarding officer accounts, enriched with merchants onboarded.
// @route   GET /api/admin/officers
// @access  Private (Owner/Admin)
export const listOfficers = async (req, res) => {
  try {
    const officers = await Admin.find({ role: 'officer' }).sort('-createdAt').lean();
    const ids = officers.map((o) => o._id);

    const counts = await Merchant.aggregate([
      { $match: { onboardingOfficerId: { $in: ids } } },
      { $group: { _id: '$onboardingOfficerId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((r) => [String(r._id), r.count]));

    const data = officers.map((o) => ({
      ...safeOfficer(o),
      merchantsOnboarded: countMap.get(String(o._id)) || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('List Officers Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create an onboarding officer account. Admin sets (or the server
//          generates) the password directly — no self-service setup link.
// @route   POST /api/admin/officers
// @access  Private (Owner/Admin)
export const createOfficer = async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const name = String(req.body.name || '').trim();
    let password = req.body.password ? String(req.body.password) : '';

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    // Required — the whole point is giving the officer a phone-login/SMS-OTP
    // option alongside email, not just an optional extra field.
    const phone = toE164Kenyan(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'A valid Kenyan phone number is required.' });
    }
    if (password && password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters.' });
    }
    if (!password) {
      password = generatePassword();
    }

    const exists = await Admin.findOne({ $or: [{ email }, { phone }] });
    if (exists) {
      return res.status(409).json({
        error: exists.email === email
          ? 'An admin or officer with that email already exists.'
          : 'An admin or officer with that phone number already exists.',
      });
    }

    const officer = new Admin({
      email,
      phone,
      name,
      role: 'officer',
      status: 'active',
      invitedBy: req.admin._id,
      invitedAt: new Date(),
      password, // pre-save hook hashes this
    });
    await officer.save();

    const adminName = req.admin.name || req.admin.email?.split('@')[0] || 'PayChain Admin';
    sendOfficerCredentials(email, name, password, OFFICER_LOGIN_URL, adminName).catch((e) => {
      console.error('Officer credentials email dispatch failed:', e?.message || e);
    });

    logAudit({
      action: 'admin.officer.created', category: 'admin', severity: 'success',
      message: `Officer account created for ${email}`,
      actor: adminActor(req.admin), req,
      metadata: { officerEmail: email },
    });

    notifyAdmins({
      type: 'new_officer_account',
      severity: 'info',
      subject: 'New officer account created',
      heading: 'New Officer Account',
      details: `<strong>${escapeHtml(adminName)}</strong> created an officer account for <strong>${escapeHtml(email)}</strong>.`,
      metadata: { email, createdBy: adminName },
    });

    res.status(201).json({ success: true, data: safeOfficer(officer), generatedPassword: password });
  } catch (error) {
    console.error('Create Officer Error:', error?.message || error);
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({ error: key === 'phone' ? 'An admin or officer with that phone number already exists.' : 'An admin or officer with that email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update an officer account — activate/deactivate, and/or set their
//          phone number (e.g. backfilling one for an officer created before
//          phone-login existed). At least one of status/phone required.
// @route   PATCH /api/admin/officers/:id
// @access  Private (Owner/Admin)
export const updateOfficer = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const { status } = req.body || {};
    const phoneProvided = req.body?.phone !== undefined;

    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'status must be "active" or "inactive".' });
    }
    if (status === undefined && !phoneProvided) {
      return res.status(400).json({ error: 'Provide status and/or phone to update.' });
    }

    let phone;
    if (phoneProvided) {
      phone = toE164Kenyan(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'A valid Kenyan phone number is required.' });
      const dupe = await Admin.findOne({ phone, _id: { $ne: req.params.id } });
      if (dupe) return res.status(409).json({ error: 'An admin or officer with that phone number already exists.' });
    }

    const target = await Admin.findOne({ _id: req.params.id, role: 'officer' });
    if (!target) return res.status(404).json({ error: 'Officer not found.' });

    if (status !== undefined) target.status = status;
    if (phoneProvided) target.phone = phone;
    await target.save();

    if (status !== undefined) {
      logAudit({
        action: status === 'active' ? 'admin.officer.reactivated' : 'admin.officer.deactivated',
        category: 'admin', severity: 'warning',
        message: `Officer ${target.email} set to ${status}`,
        actor: adminActor(req.admin), req,
      });
    }
    if (phoneProvided) {
      logAudit({
        action: 'admin.officer.phone_updated', category: 'admin', severity: 'info',
        message: `Phone number updated for officer ${target.email}`,
        actor: adminActor(req.admin), req,
      });
    }

    res.json({ success: true, data: safeOfficer(target) });
  } catch (error) {
    console.error('Update Officer Error:', error?.message || error);
    if (error.code === 11000) return res.status(409).json({ error: 'An admin or officer with that phone number already exists.' });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin-driven password reset — the only way an officer's password
//          ever changes. Re-emails the new credentials.
// @route   POST /api/admin/officers/:id/reset-password
// @access  Private (Owner/Admin)
export const resetOfficerPassword = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    let password = req.body?.password ? String(req.body.password) : '';
    if (password && password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters.' });
    }
    if (!password) password = generatePassword();

    const target = await Admin.findOne({ _id: req.params.id, role: 'officer' });
    if (!target) return res.status(404).json({ error: 'Officer not found.' });

    target.password = password;
    // Invalidates any session the officer already has open — the caller
    // here is an admin acting on someone else's account (e.g. offboarding
    // or suspected compromise), so the old token being revoked doesn't
    // affect this request's own session.
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();

    const adminName = req.admin.name || req.admin.email?.split('@')[0] || 'PayChain Admin';
    sendOfficerCredentials(target.email, target.name, password, OFFICER_LOGIN_URL, adminName).catch((e) => {
      console.error('Officer credentials email dispatch failed:', e?.message || e);
    });

    logAudit({
      action: 'admin.officer.password_reset', category: 'admin', severity: 'warning',
      message: `Password reset for officer ${target.email}`,
      actor: adminActor(req.admin), req,
    });

    res.json({ success: true, data: safeOfficer(target), generatedPassword: password });
  } catch (error) {
    console.error('Reset Officer Password Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Permanently remove an officer account. Blocked while they have
//          open (claimed, unresolved) applications.
// @route   DELETE /api/admin/officers/:id
// @access  Private (Owner/Admin)
export const deleteOfficer = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const target = await Admin.findOne({ _id: req.params.id, role: 'officer' });
    if (!target) return res.status(404).json({ error: 'Officer not found.' });

    const openCount = await Merchant.countDocuments({
      claimedBy: target._id,
      kybStatus: { $in: ['pending', 'requires_revision'] },
    });
    if (openCount > 0) {
      return res.status(400).json({ error: `Reassign or resolve ${openCount} open application(s) claimed by this officer before deleting their account.` });
    }

    await recordDeletion({ collectionName: 'Admin', doc: target, label: `${target.name || target.email} (officer)`, deletedBy: req.admin._id });
    await target.deleteOne();

    logAudit({
      action: 'admin.officer.deleted', category: 'admin', severity: 'warning',
      message: `Officer ${target.email} removed`,
      actor: adminActor(req.admin), req,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Officer Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};
