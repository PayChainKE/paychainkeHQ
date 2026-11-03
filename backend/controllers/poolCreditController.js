import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import PoolGoodwillCredit from '../models/PoolGoodwillCredit.js';
import { sendAdminActionOTP, sendMerchantLifecycleEmail } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';
import { computeUnsweptRevenue } from '../services/revenueSweepService.js';
import { getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';
import { getNcbaAccountBalance } from '../services/ncbaOpenBankingService.js';

// Admin "Credit from PayChain pool": PayChain pays a merchant out of its own
// unswept revenue held in the pooled NCBA account, like an internal transfer.
// For making a merchant whole when a customer payment can't be traced to a
// bank reference (otherwise use Pool Reconciliation's Credit Missed
// Collection, which is backed by the real bank event).
//
// No second admin needed, so the guard rails are here instead:
//   - owner role only (routes), plus a 6-character code emailed to the owner
//     and bound to (merchant, amount, reason)
//   - a written reason; per-credit cap
//   - funded from PayChain's unswept revenue first, then from bank surplus
//     (live NCBA balance above everything owed to merchants). Refused if the
//     two together can't cover it, so it never spends other merchants' money
//   - critical audit row, alert to all admins, SMS/email/in-app to merchant

const ACTION = 'pool_credit';
const ACTION_LABEL = 'Credit merchant from PayChain pool';
const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_POOL_CREDIT = 50000;

const OTP_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateCode() {
  const chars = Array.from({ length: 5 }, () => OTP_LETTERS[crypto.randomInt(OTP_LETTERS.length)]);
  chars.splice(crypto.randomInt(6), 0, String(crypto.randomInt(10)));
  return chars.join('');
}
function normalizeCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code) || (code.match(/\d/g) || []).length !== 1) return null;
  return code;
}
const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const round2 = (n) => Math.round(Number(n) * 100) / 100;

function parseRefs(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
  return [...new Set(list.map((r) => String(r).trim().toUpperCase()).filter((r) => /^[A-Z0-9-]{4,40}$/.test(r)))].slice(0, 20);
}

// What PayChain may spend from the pool, and how a credit of `amount`
// would be funded:
//   - revenue: PayChain's net unswept revenue, used first
//   - surplus: live NCBA balance minus all merchant balances minus revenue
//     (money in the account that nobody is owed)
// The hard ceiling is always live balance minus merchant balances, the same
// gate the revenue sweep uses, so the account never drops below what is
// owed to merchants. If NCBA's balance can't be read, only revenue is used.
async function poolFunding(amount = 0) {
  const [{ netUnswept }, merchantAgg, live] = await Promise.all([
    computeUnsweptRevenue(),
    Merchant.aggregate([
      { $match: { isDemoMerchant: { $ne: true }, isAppReviewAccount: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$kesBalance' } } },
    ]),
    getNcbaAccountBalance().catch(() => ({ balance: null })),
  ]);
  const revenue = round2(Math.max(0, netUnswept));
  const merchantTotal = round2(merchantAgg[0]?.total || 0);
  const liveBalance = Number.isFinite(live?.balance) ? round2(live.balance) : null;

  let available;
  let surplus = 0;
  if (liveBalance === null) {
    available = revenue;
  } else {
    const notOwedToMerchants = round2(Math.max(0, liveBalance - merchantTotal));
    surplus = round2(Math.max(0, notOwedToMerchants - revenue));
    available = notOwedToMerchants;
  }
  const fromRevenue = round2(Math.min(amount, revenue, available));
  const fromSurplus = round2(Math.max(0, Math.min(amount, available) - fromRevenue));
  return { available, revenue, surplus, liveBalance, merchantTotal, fromRevenue, fromSurplus };
}

function fundingShortMessage(f, amount) {
  if (f.liveBalance === null) {
    return `PayChain's unswept revenue is KES ${formatKes(f.revenue)} and the live NCBA balance couldn't be read to check for surplus, so KES ${formatKes(amount)} can't be covered right now. Try again shortly.`;
  }
  return `The pool can only spare KES ${formatKes(f.available)} (live balance KES ${formatKes(f.liveBalance)} minus KES ${formatKes(f.merchantTotal)} owed to merchants). Crediting KES ${formatKes(amount)} would use other merchants' money. Top up account 1010837186 first.`;
}

// @desc    Step 1: validate and email the owner a confirmation code.
// @route   POST /api/admin/merchants/:id/pool-credit/request
// @access  Private (owner)
export const requestPoolCredit = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid merchant id.' });

    const amount = round2(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
    if (amount > MAX_POOL_CREDIT) return res.status(400).json({ error: `A single pool credit is capped at KES ${formatKes(MAX_POOL_CREDIT)}.` });
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) return res.status(400).json({ error: 'Give a reason of at least 10 characters (it is shown on the audit log).' });
    if (reason.length > 500) return res.status(400).json({ error: 'Keep the reason under 500 characters.' });
    const relatedRefs = parseRefs(req.body?.relatedRefs);

    const merchant = await Merchant.findById(id).select('businessName email phone isDemoMerchant isAppReviewAccount');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });
    if (merchant.isDemoMerchant || merchant.isAppReviewAccount) {
      return res.status(409).json({ error: 'This is a demo/test account — it can\'t be credited real money.' });
    }

    const funding = await poolFunding(amount);
    if (amount > funding.available) {
      return res.status(409).json({ error: fundingShortMessage(funding, amount) });
    }

    // Warn if one of these references was already credited to this merchant.
    const alreadyCredited = relatedRefs.length
      ? await Transaction.find({ merchantId: merchant._id, reference: { $in: relatedRefs } }).select('reference').lean()
      : [];
    if (alreadyCredited.length) {
      return res.status(409).json({ error: `Already credited to this merchant: ${alreadyCredited.map((t) => t.reference).join(', ')}. Check their history before crediting again.` });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const code = generateCode();
    admin.pendingAction = {
      action: ACTION,
      targetId: merchant._id,
      otpHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      payload: { amount, reason, relatedRefs },
    };
    await admin.save();

    sendAdminActionOTP(admin.email, code, ACTION_LABEL, `${merchant.businessName} (${merchant.email}) — KES ${formatKes(amount)} from PayChain's own funds. Reason: ${reason}`)
      .catch((err) => console.error('Pool credit code email failed:', err));

    logAudit({
      action: 'admin.merchant.pool_credit_requested', category: 'admin', severity: 'warning',
      message: `Pool credit requested — KES ${formatKes(amount)} (code sent to admin). Reason: ${reason}`,
      merchant, actor: adminActor(admin), req,
      metadata: { amount, reason, relatedRefs },
    });

    res.json({
      success: true,
      message: 'Verification code sent to your admin email.',
      data: { amount, fromRevenue: funding.fromRevenue, fromSurplus: funding.fromSurplus, revenue: funding.revenue, surplus: funding.surplus, liveBalance: funding.liveBalance },
    });
  } catch (error) {
    console.error('Request Pool Credit Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Step 2: verify the code and credit the merchant. The code is
//          consumed atomically first, so it can only ever credit once.
// @route   POST /api/admin/merchants/:id/pool-credit/confirm
// @access  Private (owner)
export const confirmPoolCredit = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid merchant id.' });
    const code = normalizeCode(req.body?.otp);
    if (!code) return res.status(400).json({ error: 'Enter the 6-character code (5 letters and 1 digit).' });

    const cleared = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
    const consumed = await Admin.findOneAndUpdate(
      {
        _id: req.admin._id,
        'pendingAction.action': ACTION,
        'pendingAction.targetId': new mongoose.Types.ObjectId(id),
        'pendingAction.otpHash': hashCode(code),
        'pendingAction.expiresAt': { $gt: new Date() },
      },
      { $set: { pendingAction: cleared } },
      { new: false }
    );
    if (!consumed) {
      await Admin.updateOne({ _id: req.admin._id, 'pendingAction.action': ACTION }, { $set: { pendingAction: cleared } });
      return res.status(401).json({ error: 'Verification failed. Request a new code.' });
    }

    const { amount, reason, relatedRefs = [] } = consumed.pendingAction?.payload || {};
    if (!amount || !reason) return res.status(400).json({ error: 'This request is missing its details. Request a new code.' });

    const merchant = await Merchant.findById(id).select('businessName email phone ncbaMerchantCode');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    // Re-check: other credits or a sweep may have run since the code was sent.
    const funding = await poolFunding(amount);
    if (amount > funding.available) {
      return res.status(409).json({ error: `${fundingShortMessage(funding, amount)} Nothing was credited.` });
    }
    const { fromRevenue, fromSurplus } = funding;

    const reference = `GOODWILL-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const session = await mongoose.startSession();
    let transaction;
    let updatedMerchant;
    try {
      await session.withTransaction(async () => {
        updatedMerchant = await Merchant.findByIdAndUpdate(merchant._id, { $inc: { kesBalance: amount } }, { returnDocument: 'after', session });
        [transaction] = await Transaction.create([{
          merchantId: merchant._id,
          accountNumber: merchant.ncbaMerchantCode,
          // top_up: already a credit type everywhere (dashboard, mobile app,
          // available-balance hold) and in no revenue stream, so its fee is
          // always 0 and it never counts as PayChain revenue or GMV.
          type: 'top_up',
          amount,
          kesAmount: amount,
          currency: 'KES',
          status: 'completed',
          reference,
          sender: { name: 'PayChain (credit from pool)', id: 'PAYCHAIN' },
          recipient: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
          balanceAfter: round2(updatedMerchant?.kesBalance ?? 0),
        }], { session });
        await PoolGoodwillCredit.create([{
          merchantId: merchant._id,
          amount,
          fromRevenue,
          fromSurplus,
          reason,
          relatedRefs,
          reference,
          transactionId: transaction._id,
          creditedBy: req.admin._id,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    const newBalance = round2(updatedMerchant?.kesBalance ?? 0);
    const admin = req.admin;

    logAudit({
      action: 'admin.merchant.pool_credited', category: 'admin', severity: 'critical',
      message: `Credited KES ${formatKes(amount)} from PayChain's pool (OTP-verified), ref ${reference}. Reason: ${reason}`,
      merchant, actor: adminActor(admin), req,
      metadata: { amount, fromRevenue, fromSurplus, liveBalance: funding.liveBalance, reason, relatedRefs, reference, transactionId: String(transaction._id), newBalance },
    });
    notifyAdmins({
      type: 'admin_balance_payout',
      severity: 'warning',
      subject: `Pool credit — KES ${formatKes(amount)} to ${merchant.businessName}`,
      heading: 'Merchant credited from PayChain pool',
      details: `<p><strong>${escapeHtml(merchant.businessName || '')}</strong> was credited KES ${formatKes(amount)} from PayChain's own funds by ${escapeHtml(admin.email || 'admin')}.</p>`
        + `<p>Funded from: PayChain revenue KES ${formatKes(fromRevenue)}${fromSurplus > 0 ? ` + bank surplus KES ${formatKes(fromSurplus)}` : ''}.</p>`
        + `<p>Reason: ${escapeHtml(reason)}</p>`
        + (relatedRefs.length ? `<p>Original payment refs: ${escapeHtml(relatedRefs.join(', '))} — do not also credit these via Credit Missed Collection.</p>` : '')
        + `<p>Ref ${escapeHtml(reference)}. New balance: KES ${formatKes(newBalance)}.</p>`,
      metadata: { merchantId: String(merchant._id), amount, reference, relatedRefs },
    });

    const account = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode) || merchant.ncbaMerchantCode || '';
    createNotification({
      merchantId: merchant._id,
      kind: 'wallet',
      title: 'Your account has been credited',
      message: `PayChain credited KES ${formatKes(amount)} to your wallet. Ref ${reference}. New balance KES ${formatKes(newBalance)}.`,
    });
    if (merchant.phone) {
      safeSendSMS({
        to: merchant.phone,
        message: `PayChain: Your account ${account} has been credited Ksh ${formatKes(amount)} by PayChain. Ref ${reference}. New balance: Ksh ${formatKes(newBalance)}. Queries: support@paychain.co.ke`,
      }).catch((err) => console.error('Pool credit SMS failed:', err));
    }
    if (merchant.email) {
      sendMerchantLifecycleEmail(merchant.email, {
        subject: `Your PayChain account has been credited KES ${formatKes(amount)}`,
        heading: `KES ${formatKes(amount)} credited to your account`,
        paragraphsHtml: `<p>Hello ${escapeHtml(merchant.businessName || '')},</p>
          <p>PayChain has credited <strong>KES ${formatKes(amount)}</strong> to your PayChain wallet${account ? ` (account <strong>${escapeHtml(account)}</strong>)` : ''}.</p>
          <p>Reference: <strong>${escapeHtml(reference)}</strong><br/>New balance: <strong>KES ${formatKes(newBalance)}</strong></p>
          <p>It's available in your wallet now and you can withdraw it as usual.</p>`,
      }).catch((err) => console.error('Pool credit email failed:', err?.message || err));
    }

    res.json({ success: true, message: `KES ${formatKes(amount)} credited to ${merchant.businessName}.`, data: { reference, amount, fromRevenue, fromSurplus, newBalance } });
  } catch (error) {
    console.error('Confirm Pool Credit Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
