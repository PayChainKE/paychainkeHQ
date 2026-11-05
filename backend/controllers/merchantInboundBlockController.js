import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import { sendAdminActionOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor, notifyMerchantInboundInApp, notifyMerchantInboundExternal } from './adminController.js';
import { normalizeInboundBlockReason, MAX_INBOUND_BLOCK_REASON } from '../utils/merchantPaymentAcceptance.js';
import { createNotification } from './notificationController.js';
import { disableMerchantCollections, restoreMerchantCollections } from '../services/merchantDisableService.js';
import { reviewHeldDeposits, creditHeldDeposit } from '../services/heldCreditService.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';

// Admin "block / allow incoming payments" for many merchants at once, e.g.
// when closing operations. Same effect as the single-merchant lock_inbound /
// unlock_inbound actions in adminController.js; one 6-digit code emailed to the
// acting admin approves the whole list, and the list, reason and notify choice
// are all bound to that code at request time.
//
// Four modes: 'block', 'allow', 'notify', which messages merchants who are
// already blocked (SMS, email and in-app) and updates the reason on their
// account, so the in-app banner says the same thing as the message, and
// 'disable', for merchants blocked already: credits the deposits held since
// their block, then disables the account. Blocking disables as well, and
// allowing reverses it (services/merchantDisableService.js).
//
// Demo and Play Store reviewer accounts are left out: they take no real
// customer money, and blocking the reviewer account would fail app review. The
// single-merchant action can still block one deliberately.

const ACTION = 'inbound_block_bulk';
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_MERCHANTS = 5000;
// Resend's default rate limit is 2 requests a second.
const EXTERNAL_NOTICE_GAP_MS = 600;

const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Resolves the selection into who will change and who won't (and why), so the
// admin sees it before approving and confirm re-checks it against live data.
async function classifySelection(merchantIds, mode) {
  const ids = [...new Set((Array.isArray(merchantIds) ? merchantIds : []).map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length === 0) return { error: 'Select at least one merchant.' };
  if (ids.length > MAX_MERCHANTS) return { error: `Select at most ${MAX_MERCHANTS} merchants at a time.` };

  const merchants = await Merchant.find({ _id: { $in: ids } })
    .select('businessName name email phone status ncbaMerchantCode inboundLocked accountDisabledAt isDemoMerchant isAppReviewAccount')
    .sort('businessName');

  const items = [];
  const skipped = [];
  const needsReview = [];
  const held = mode === 'disable'
    ? await reviewHeldDeposits(merchants.filter((m) => m.inboundLocked && m.status !== 'locked' && !m.isDemoMerchant && !m.isAppReviewAccount))
    : new Map();
  for (const m of merchants) {
    const row = { merchantId: String(m._id), businessName: m.businessName || m.email || '—' };
    const deposits = held.get(row.merchantId);
    if (m.isDemoMerchant || m.isAppReviewAccount) skipped.push({ ...row, reason: 'Demo/test account' });
    else if (mode === 'block' && m.inboundLocked) skipped.push({ ...row, reason: 'Already blocked' });
    else if (mode !== 'block' && !m.inboundLocked) skipped.push({ ...row, reason: 'Not blocked' });
    else if (mode === 'disable' && m.status === 'locked') skipped.push({ ...row, reason: 'Account locked: resolve the lock first' });
    else if (mode === 'disable') {
      needsReview.push(...deposits.needsReview.map((d) => ({ ...d, businessName: row.businessName })));
      if (m.accountDisabledAt && deposits.creditable.length === 0) skipped.push({ ...row, reason: 'Already disabled, nothing to credit' });
      else items.push({ ...row, holds: deposits.creditable, heldAmount: deposits.creditable.reduce((sum, d) => sum + d.amount, 0) });
    } else items.push(row);
  }
  return { items, skipped, merchants, needsReview };
}

const publicView = ({ items, skipped, needsReview }) => ({ items, skipped, needsReview });

const MODES = ['block', 'allow', 'notify', 'disable'];
const MODE_OTP_LABEL = {
  block: 'Block incoming payments (bulk)',
  allow: 'Allow incoming payments (bulk)',
  notify: 'Notify blocked merchants by SMS and email (bulk)',
  disable: 'Credit held deposits and disable accounts (bulk)',
};
const needsReason = (mode) => mode === 'block' || mode === 'notify';

// @desc    Show who a bulk block/allow would change, without changing anything.
// @route   POST /api/admin/merchants/inbound-block/preview  { merchantIds, mode }
// @access  Private (Admin, mutator)
export const previewBulkInboundBlock = async (req, res) => {
  try {
    const mode = req.body?.mode;
    if (!MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode.' });
    const result = await classifySelection(req.body?.merchantIds, mode);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, data: publicView(result) });
  } catch (error) {
    console.error('Preview Bulk Inbound Block Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Step 1: email the admin a code bound to exactly this list and reason.
// @route   POST /api/admin/merchants/inbound-block/request  { merchantIds, mode, reason, notifyExternal }
// @access  Private (Admin, mutator)
export const requestBulkInboundBlock = async (req, res) => {
  try {
    const mode = req.body?.mode;
    if (!MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode.' });
    const notifyExternal = mode === 'notify' || !!req.body?.notifyExternal;
    const reason = needsReason(mode) ? normalizeInboundBlockReason(req.body?.reason) : null;
    if (needsReason(mode) && !reason) {
      return res.status(400).json({ error: `Keep the reason under ${MAX_INBOUND_BLOCK_REASON} characters.` });
    }

    const result = await classifySelection(req.body?.merchantIds, mode);
    if (result.error) return res.status(400).json({ error: result.error });
    if (result.items.length === 0) {
      return res.status(409).json({ error: 'None of the selected merchants would change — see the reasons listed.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const merchantIds = result.items.map((i) => i.merchantId);
    // Binds the money too: confirm can credit only the deposits shown here.
    const holdIds = result.items.flatMap((i) => (i.holds || []).map((h) => h.holdId));
    const heldAmount = result.items.reduce((sum, i) => sum + (i.heldAmount || 0), 0);
    admin.pendingAction = {
      action: ACTION,
      targetId: admin._id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      payload: { merchantIds, mode, reason, notifyExternal, holdIds },
    };
    admin.markModified('pendingAction');
    await admin.save();

    const count = merchantIds.length;
    sendAdminActionOTP(
      admin.email,
      otp,
      MODE_OTP_LABEL[mode],
      `${count} merchant${count === 1 ? '' : 's'}${reason ? ` — reason: ${reason}` : ''}${holdIds.length ? ` — credits ${holdIds.length} held deposit${holdIds.length === 1 ? '' : 's'} totalling KES ${heldAmount.toLocaleString()}` : ''}`
    ).catch((err) => console.error('Bulk inbound block OTP email failed:', err));

    logAudit({
      action: 'admin.merchant.inbound_bulk_requested', category: 'admin', severity: 'warning',
      message: `Bulk "${mode}" of incoming payments requested — ${count} merchants (OTP sent to admin)`,
      actor: adminActor(admin), req,
      metadata: { mode, count, reason, notifyExternal, holdIds, heldAmount },
    });

    res.json({ success: true, message: 'Verification code sent to your admin email.', data: publicView(result) });
  } catch (error) {
    console.error('Request Bulk Inbound Block Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Per-merchant audit and notices, after the block itself has already applied.
// In-app goes to everyone first; SMS/email follow at the provider's pace. A
// restart mid-way can only lose notices: the block stands, and the merchant
// still sees the in-app banner because that reads inboundLocked directly.
async function deliverNotices(merchants, { mode, reason, notifyExternal, admin, req }) {
  const block = mode !== 'allow';
  const audit = {
    block: { action: 'admin.merchant.inbound_locked', severity: 'critical', message: `Incoming payments blocked by admin (bulk, OTP-verified) — reason: ${reason}` },
    allow: { action: 'admin.merchant.inbound_unlocked', severity: 'success', message: 'Incoming payments allowed again by admin (bulk, OTP-verified)' },
    notify: { action: 'admin.merchant.inbound_notified', severity: 'warning', message: `Blocked merchant notified by SMS and email (bulk, OTP-verified) — reason: ${reason}` },
  }[mode];
  for (const merchant of merchants) {
    logAudit({ ...audit, category: 'admin', merchant, actor: adminActor(admin), req });
    await notifyMerchantInboundInApp(merchant, block, reason);
  }
  if (!notifyExternal) return;
  for (const merchant of merchants) {
    await notifyMerchantInboundExternal(merchant, block, reason);
    await sleep(EXTERNAL_NOTICE_GAP_MS);
  }
}

// Credits the approved deposits, then disables the account. One merchant's
// failed credit can't stop the rest; their deposit stays open, and it's safe to
// run again. Money only moves for holds both approved and still clean now.
async function creditAndDisable(result, { holdIds, adminId, notifyExternal, admin, req }) {
  const approved = new Set(holdIds || []);
  const summary = { creditedCount: 0, creditedAmount: 0, failed: [] };
  const merchantsById = new Map(result.merchants.map((m) => [String(m._id), m]));
  const notices = [];

  for (const item of result.items) {
    const merchant = merchantsById.get(item.merchantId);
    let merchantTotal = 0;
    for (const hold of item.holds.filter((h) => approved.has(h.holdId))) {
      try {
        const { credited, amount } = await creditHeldDeposit(hold.holdId, merchant, adminId);
        if (!credited) continue;
        summary.creditedCount += 1;
        summary.creditedAmount += amount;
        merchantTotal += amount;
        logAudit({
          action: 'admin.merchant.held_deposit_credited', category: 'admin', severity: 'critical',
          message: `Held deposit KES ${amount.toLocaleString()} (ref ${hold.transId}) credited before disabling (OTP-verified)`,
          merchant, actor: adminActor(admin), req,
          metadata: { holdId: hold.holdId, transId: hold.transId, amount },
        });
      } catch (err) {
        console.error('Crediting held deposit failed:', hold.holdId, err?.message || err);
        summary.failed.push({ businessName: item.businessName, transId: hold.transId, amount: hold.amount });
      }
    }
    if (merchantTotal > 0) notices.push({ merchant, amount: merchantTotal });
  }

  const toDisable = result.items
    .map((i) => merchantsById.get(i.merchantId))
    .filter((m) => !m.accountDisabledAt);
  await disableMerchantCollections(toDisable.map((m) => m._id), adminId);
  for (const merchant of toDisable) {
    logAudit({
      action: 'admin.merchant.account_disabled', category: 'admin', severity: 'critical',
      message: 'Account disabled by admin: collection tools off, withdrawals still open (OTP-verified)',
      merchant, actor: adminActor(admin), req,
    });
  }

  deliverCreditNotices(notices, notifyExternal)
    .catch((err) => console.error('Held deposit notices failed:', err));
  return summary;
}

async function deliverCreditNotices(notices, notifyExternal) {
  for (const { merchant, amount } of notices) {
    const message = `${formatKes(amount)} received while your payment collection was paused has been added to your balance. You can sign in and withdraw it.`;
    await createNotification({ merchantId: merchant._id, kind: 'system', title: 'Held payments credited', message });
    if (notifyExternal && merchant.phone) {
      await safeSendSMS({ to: merchant.phone, message: `PayChain: ${message}` })
        .catch((err) => console.error('Held deposit SMS failed:', err));
      await sleep(EXTERNAL_NOTICE_GAP_MS);
    }
  }
}

// @desc    Step 2: apply the change to every merchant bound to the code.
// @route   POST /api/admin/merchants/inbound-block/confirm  { otp }
// @access  Private (Admin, mutator)
export const confirmBulkInboundBlock = async (req, res) => {
  try {
    const otp = String(req.body?.otp || '');
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'A 6-digit code is required.' });

    // Atomic so one code can't be replayed; a wrong code burns the request.
    const cleared = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
    const consumed = await Admin.findOneAndUpdate(
      {
        _id: req.admin._id,
        'pendingAction.action': ACTION,
        'pendingAction.otpHash': hashOtp(otp),
        'pendingAction.expiresAt': { $gt: new Date() },
      },
      { $set: { pendingAction: cleared } },
      { new: false }
    );
    if (!consumed) {
      await Admin.updateOne({ _id: req.admin._id, 'pendingAction.action': ACTION }, { $set: { pendingAction: cleared } });
      return res.status(401).json({ error: 'Verification failed. Request a new code.' });
    }

    const { merchantIds, mode, reason, notifyExternal, holdIds } = consumed.pendingAction?.payload || {};
    const result = await classifySelection(merchantIds, mode);
    if (result.error) return res.status(400).json({ error: result.error });

    if (mode === 'disable') {
      const summary = await creditAndDisable(result, { holdIds, adminId: req.admin._id, notifyExternal: !!notifyExternal, admin: req.admin, req });
      logAudit({
        action: 'admin.merchant.bulk_disabled', category: 'admin', severity: 'critical',
        message: `Bulk disable applied to ${result.items.length} merchants, KES ${summary.creditedAmount.toLocaleString()} of held deposits credited (OTP-verified)`,
        actor: adminActor(req.admin), req,
        metadata: { ...summary, merchantIds: result.items.map((i) => i.merchantId) },
      });
      return res.json({ success: true, data: { changed: result.items.length, skipped: result.skipped.length, mode, ...summary, needsReview: result.needsReview } });
    }

    const changing = new Set(result.items.map((i) => i.merchantId));
    const merchants = result.merchants.filter((m) => changing.has(String(m._id)));
    const now = new Date();
    if (merchants.length > 0) {
      await Merchant.updateMany(
        { _id: { $in: merchants.map((m) => m._id) } },
        {
          $set: {
            block: { inboundLocked: true, inboundLockedAt: now, inboundLockedBy: req.admin._id, inboundLockReason: reason },
            allow: { inboundLocked: false, inboundLockedAt: null, inboundLockedBy: null, inboundLockReason: null },
            notify: { inboundLockReason: reason },
          }[mode],
        }
      );
      const ids = merchants.map((m) => m._id);
      if (mode === 'block') await disableMerchantCollections(ids, req.admin._id);
      if (mode === 'allow') await restoreMerchantCollections(ids);
    }

    logAudit({
      action: { block: 'admin.merchant.inbound_bulk_blocked', allow: 'admin.merchant.inbound_bulk_allowed', notify: 'admin.merchant.inbound_bulk_notified' }[mode],
      category: 'admin',
      severity: mode === 'allow' ? 'success' : 'critical',
      message: `Bulk "${mode}" of incoming payments applied to ${merchants.length} merchants (OTP-verified)`,
      actor: adminActor(req.admin), req,
      metadata: { count: merchants.length, reason, notifyExternal: !!notifyExternal, merchantIds: merchants.map((m) => String(m._id)) },
    });

    deliverNotices(merchants, { mode, reason, notifyExternal: !!notifyExternal, admin: req.admin, req })
      .catch((err) => console.error('Bulk inbound block notices failed:', err));

    res.json({ success: true, data: { changed: merchants.length, skipped: result.skipped.length, mode } });
  } catch (error) {
    console.error('Confirm Bulk Inbound Block Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
