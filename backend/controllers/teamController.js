import crypto from 'crypto';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Merchant from '../models/Merchant.js';
import Contact from '../models/Contact.js';
import Communication from '../models/Communication.js';
import { sendTeamInvite } from '../utils/resend.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';

const ADMIN_DASHBOARD_URL =
  process.env.ADMIN_DASHBOARD_URL || 'https://admin.paychain.co.ke';

const ALLOWED_ROLES = ['owner', 'admin', 'analyst'];
const ALLOWED_STATUSES = ['active', 'inactive', 'pending'];

// Owner-only guard. Returns true if proceed, otherwise sends 403 and returns false.
const requireOwner = (req, res) => {
  if (req.admin?.role !== 'owner') {
    res.status(403).json({ error: 'Only owners can perform this action.' });
    return false;
  }
  return true;
};

// Strip never-leaked fields from an Admin doc before returning.
const safeAdmin = (a) => ({
  _id: a._id,
  email: a.email,
  name: a.name,
  role: a.role,
  status: a.status,
  avatarUrl: a.avatarUrl,
  lastLogin: a.lastLogin,
  loginCount: a.loginCount,
  invitedAt: a.invitedAt,
  invitedBy: a.invitedBy,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

// @desc    List all admin team members. Enriched with merchants-onboarded
//          + support-tickets-resolved + comms-handled counts so the Team
//          page shows actual contribution, not a placeholder.
// @route   GET /api/admin/team
// @access  Private (Admin)
export const listTeam = async (req, res) => {
  try {
    const admins = await Admin.find().sort('-createdAt').lean();
    const ids = admins.map((a) => a._id);

    const [merchantCounts, ticketCounts, callCounts] = await Promise.all([
      Merchant.aggregate([
        { $match: { invitedBy: { $in: ids } } },
        { $group: { _id: '$invitedBy', count: { $sum: 1 } } },
      ]),
      Contact.aggregate([
        { $match: { 'replies.sentBy': { $in: ids } } },
        { $unwind: '$replies' },
        { $match: { 'replies.sentBy': { $in: ids } } },
        { $group: { _id: '$replies.sentBy', count: { $sum: 1 } } },
      ]),
      Communication.aggregate([
        { $match: { assignedTo: { $in: ids } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      ]),
    ]);

    const mMap = new Map(merchantCounts.map((r) => [String(r._id), r.count]));
    const tMap = new Map(ticketCounts.map((r) => [String(r._id), r.count]));
    const cMap = new Map(callCounts.map((r) => [String(r._id), r.count]));

    const members = admins.map((a) => ({
      ...safeAdmin(a),
      stats: {
        merchantsOnboarded: mMap.get(String(a._id)) || 0,
        ticketsResolved: tMap.get(String(a._id)) || 0,
        callsHandled: cMap.get(String(a._id)) || 0,
      },
    }));

    res.json({ success: true, data: members });
  } catch (error) {
    console.error('List Team Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Invite a new admin team member. Creates an Admin doc with
//          status='pending', issues a sha256-hashed setup token, and emails
//          the invite link. The setup-link reuses the merchant setup-password
//          flow under the hood (single token store on the doc).
// @route   POST /api/admin/team
// @access  Private (Owner)
export const inviteTeamMember = async (req, res) => {
  if (!requireOwner(req, res)) return;

  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const name  = String(req.body.name  || '').trim();
    const role  = ALLOWED_ROLES.includes(req.body.role) ? req.body.role : 'admin';

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ error: 'An admin with that email already exists.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const admin = new Admin({
      email,
      name,
      role,
      status: 'pending',
      invitedBy: req.admin._id,
      invitedAt: new Date(),
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    });
    await admin.save();

    const inviterName = req.admin.name || req.admin.email?.split('@')[0] || 'PayChain Owner';
    const setupLink = `${ADMIN_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;

    // Dispatch email async so the API call isn't held by the SMTP round-trip.
    sendTeamInvite(email, name, role, inviterName, setupLink).catch((e) => {
      console.error('Team invite email dispatch failed:', e?.message || e);
    });

    // Visibility for every other owner/admin — a new privileged account is
    // exactly the kind of change that should never happen silently, even
    // when it's legitimate.
    notifyAdmins({
      type: 'new_admin_account',
      severity: 'info',
      subject: 'New admin account invited',
      heading: 'New Admin Console Account',
      details: `<strong>${escapeHtml(inviterName)}</strong> invited <strong>${escapeHtml(email)}</strong> as <strong>${escapeHtml(role)}</strong>.`,
      metadata: { email, role, invitedBy: inviterName },
    });

    res.status(201).json({ success: true, data: safeAdmin(admin) });
  } catch (error) {
    console.error('Invite Team Member Error:', error?.message || error);
    if (error.code === 11000) return res.status(409).json({ error: 'An admin with that email already exists.' });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update a team member's name, role, or status (owner-only).
//          Owner can't demote themselves while they are the only owner.
// @route   PATCH /api/admin/team/:id
// @access  Private (Owner)
export const updateTeamMember = async (req, res) => {
  if (!requireOwner(req, res)) return;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Member not found.' });

    const { name, role, status } = req.body || {};

    if (typeof name === 'string') target.name = name.trim().slice(0, 80);
    if (role && ALLOWED_ROLES.includes(role)) {
      // Guard against the last-owner being demoted.
      if (target.role === 'owner' && role !== 'owner') {
        const ownerCount = await Admin.countDocuments({ role: 'owner' });
        if (ownerCount <= 1) return res.status(400).json({ error: 'Cannot demote the only remaining owner.' });
      }
      target.role = role;
    }
    if (status && ALLOWED_STATUSES.includes(status)) {
      // Same guard for deactivation.
      if (target.role === 'owner' && status === 'inactive') {
        const activeOwners = await Admin.countDocuments({ role: 'owner', status: 'active' });
        if (activeOwners <= 1) return res.status(400).json({ error: 'Cannot deactivate the only active owner.' });
      }
      target.status = status;
    }
    await target.save();

    res.json({ success: true, data: safeAdmin(target) });
  } catch (error) {
    console.error('Update Team Member Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Permanently remove a team member. Owner-only. Can't self-delete.
// @route   DELETE /api/admin/team/:id
// @access  Private (Owner)
export const removeTeamMember = async (req, res) => {
  if (!requireOwner(req, res)) return;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    if (String(req.params.id) === String(req.admin._id)) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
    }
    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Member not found.' });

    if (target.role === 'owner') {
      const ownerCount = await Admin.countDocuments({ role: 'owner' });
      if (ownerCount <= 1) return res.status(400).json({ error: 'Cannot remove the only remaining owner.' });
    }
    await target.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('Remove Team Member Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Re-send invite email to a pending member, refreshing the token.
// @route   POST /api/admin/team/:id/resend-invite
// @access  Private (Owner)
export const resendInvite = async (req, res) => {
  if (!requireOwner(req, res)) return;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Member not found.' });
    if (target.status !== 'pending') {
      return res.status(400).json({ error: 'Member is already active.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    target.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    target.passwordResetExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await target.save();

    const inviterName = req.admin.name || req.admin.email?.split('@')[0] || 'PayChain Owner';
    const setupLink = `${ADMIN_DASHBOARD_URL.replace(/\/$/, '')}/setup-password?token=${rawToken}`;

    sendTeamInvite(target.email, target.name, target.role, inviterName, setupLink).catch((e) => {
      console.error('Resend invite dispatch failed:', e?.message || e);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resend Invite Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Public: validate a setup token (called before showing the password form).
// @route   GET /api/admin/auth/setup-password/:token
// @access  Public
export const validateSetupToken = async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
    const admin = await Admin.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');
    if (!admin) return res.status(400).json({ error: 'This invite link is invalid or has expired.' });

    res.json({ success: true, data: { email: admin.email, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('Validate Setup Token Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Public: consume a setup token and set the admin's password.
// @route   POST /api/admin/auth/setup-password
// @access  Public
export const setupPasswordWithToken = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (String(password).length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const admin = await Admin.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!admin) return res.status(400).json({ error: 'This invite link is invalid or has expired.' });

    admin.password = password;
    admin.status = 'active';
    admin.passwordResetToken = null;
    admin.passwordResetExpires = null;
    await admin.save();

    res.json({ success: true, message: 'Password set. You can now sign in.' });
  } catch (error) {
    console.error('Setup Password Error:', error?.message || error);
    res.status(500).json({ error: 'Server Error' });
  }
};
