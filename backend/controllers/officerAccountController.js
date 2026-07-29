import crypto from 'crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Merchant from '../models/Merchant.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { sendOfficerCredentials } from '../utils/resend.js';

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
    if (password && password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters.' });
    }
    if (!password) {
      password = generatePassword();
    }

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ error: 'An admin or officer with that email already exists.' });

    const officer = new Admin({
      email,
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

    res.status(201).json({ success: true, data: safeOfficer(officer), generatedPassword: password });
  } catch (error) {
    console.error('Create Officer Error:', error?.message || error);
    if (error.code === 11000) return res.status(409).json({ error: 'An admin or officer with that email already exists.' });
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Activate/deactivate an officer account.
// @route   PATCH /api/admin/officers/:id
// @access  Private (Owner/Admin)
export const updateOfficerStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const { status } = req.body || {};
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'status must be "active" or "inactive".' });
    }

    const target = await Admin.findOne({ _id: req.params.id, role: 'officer' });
    if (!target) return res.status(404).json({ error: 'Officer not found.' });

    target.status = status;
    await target.save();

    logAudit({
      action: status === 'active' ? 'admin.officer.reactivated' : 'admin.officer.deactivated',
      category: 'admin', severity: 'warning',
      message: `Officer ${target.email} set to ${status}`,
      actor: adminActor(req.admin), req,
    });

    res.json({ success: true, data: safeOfficer(target) });
  } catch (error) {
    console.error('Update Officer Status Error:', error?.message || error);
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
