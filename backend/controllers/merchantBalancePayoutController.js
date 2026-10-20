import crypto from 'crypto';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Admin from '../models/Admin.js';
import { sendAdminActionOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';
import { getAvailableBalance } from '../utils/availableBalance.js';
import { getB2cTariff, MAX_B2C_AMOUNT } from '../config/mpesaB2cTariffCard.js';
import { withMerchantTariffLock } from '../services/tariffCardCache.js';
import {
  executeNcbaMobileMoneyPayout,
  InsufficientFundsError,
  NcbaPostSubmissionRecordError,
} from './ncbaOpenBankingController.js';
import { NcbaOpenBankingValidationError, MOBILE_B2W_MIN_AMOUNT } from '../services/ncbaOpenBankingService.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';
import AdminBalancePayoutBatch from '../models/AdminBalancePayoutBatch.js';

// Admin "send a merchant their remaining balance" — for winding down /
// pausing operations without PayChain being left holding merchant money.
// Pays the merchant's available KES balance (minus the standard M-PESA
// withdrawal fee, exactly what the merchant would pay withdrawing it
// themselves) out to their primary phone or another number the merchant
// supplied, via the same NCBA mobile-money rail every merchant payout uses
// (executeNcbaMobileMoneyPayout — balance reservation, refund-on-failure and
// Transaction record all come from there, not re-implemented here).
//
// Gated by an admin OTP bound to (action, merchant, phone, amount) on the
// same Admin.pendingAction binding requestMerchantAction uses — but with a
// distinct code shape (5 letters + 1 digit) so this money-moving action's
// code can never be confused with the 6-digit codes the other admin actions
// send.

const ACTION = 'balance_payout';
const ACTION_LABEL = 'Send merchant remaining balance';
const OTP_TTL_MS = 10 * 60 * 1000;

// No I or O — they read as 1 and 0 next to the digit in an email.
const OTP_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateLetterDigitOtp() {
  const chars = Array.from({ length: 5 }, () => OTP_LETTERS[crypto.randomInt(OTP_LETTERS.length)]);
  chars.splice(crypto.randomInt(6), 0, String(crypto.randomInt(10)));
  return chars.join('');
}

function normalizeOtp(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  if ((code.match(/\d/g) || []).length !== 1) return null;
  return code;
}

const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex');

// Airtel Kenya's MSISDN ranges; everything else on a 07/01 prefix is
// Safaricom. Only a default — the admin can override it in the UI.
function detectNetwork(msisdn254) {
  const body = String(msisdn254).slice(3); // drop 254
  if (/^(73\d|75[0-6]|762|78\d|10[0-2])/.test(body)) return 'airtel';
  return 'safaricom';
}

// Largest whole-shilling amount that, plus its own B2C fee, fits inside
// `available`. The fee is a step function of the amount, so start from
// "available minus the fee at the top" (always fits) and walk up while the
// next shilling still fits — the gap is at most one band's fee difference.
async function computeSendable(merchantId, available) {
  return withMerchantTariffLock(merchantId, () => {
    const feeFor = (a) => getB2cTariff(a).totalFee;
    const ceiling = Math.min(Math.floor(available), MAX_B2C_AMOUNT);
    if (ceiling <= 0) return null;
    let amount = Math.floor(ceiling - feeFor(ceiling));
    if (amount <= 0) return null;
    while (amount + 1 <= ceiling && amount + 1 + feeFor(amount + 1) <= available) amount += 1;
    // NCBA's Mobile Money Transfer rejects anything under its minimum.
    if (amount < MOBILE_B2W_MIN_AMOUNT) return null;
    return { amount, fee: feeFor(amount) };
  });
}

function resolveDestination(merchant, { destination, phone }) {
  const raw = destination === 'other' ? phone : merchant.phone;
  if (!raw || String(raw).trim() === '') {
    throw new NcbaValidationError(
      destination === 'other' ? 'Enter the phone number to send to.' : 'This merchant has no primary phone number on file.',
      'INVALID_PHONE'
    );
  }
  return validatePhoneNumber(raw);
}

// Demo (Stellar evidence) and Play Store reviewer accounts hold simulated
// balances — same exclusion getMerchantBalances applies. Paying one out
// would send real money for a fake balance.
const isTestAccount = (m) => !!(m?.isDemoMerchant || m?.isAppReviewAccount);

async function buildQuote(merchant) {
  const kesBalance = Math.round((merchant.kesBalance || 0) * 100) / 100;
  const { availableBalance, heldAmount } = await getAvailableBalance(merchant._id, kesBalance);
  const sendable = await computeSendable(merchant._id, availableBalance);
  return {
    kesBalance,
    availableBalance,
    heldAmount,
    amount: sendable?.amount || 0,
    fee: sendable?.fee || 0,
    remainingAfter: sendable
      ? Math.round((kesBalance - sendable.amount - sendable.fee) * 100) / 100
      : kesBalance,
    cappedAtMax: Math.floor(availableBalance) > MAX_B2C_AMOUNT,
    maxPerPayout: MAX_B2C_AMOUNT,
  };
}

// @desc    Quote what a "send remaining balance" payout would send right now.
// @route   GET /api/admin/merchants/:id/balance-payout/preview?destination=primary|other&phone=
// @access  Private (Admin, mutator)
export const previewBalancePayout = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid merchant id.' });
    const merchant = await Merchant.findById(id).select('businessName email phone kesBalance status tariffLock');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const quote = await buildQuote(merchant);
    let phone = null;
    let network = null;
    try {
      phone = resolveDestination(merchant, { destination: req.query.destination, phone: req.query.phone });
      network = detectNetwork(phone);
    } catch {
      // Preview still returns the money figures without a valid phone yet.
    }

    res.json({
      success: true,
      data: {
        ...quote,
        primaryPhone: merchant.phone || null,
        phone,
        network,
      },
    });
  } catch (error) {
    console.error('Preview Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Step 1: validate the destination, quote the amount, and email the
//          admin a 5-letter + 1-digit code bound to exactly this payout.
// @route   POST /api/admin/merchants/:id/balance-payout/request
// @access  Private (Admin, mutator)
export const requestBalancePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { destination = 'primary', phone: rawPhone, network: rawNetwork } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid merchant id.' });
    if (!['primary', 'other'].includes(destination)) return res.status(400).json({ error: 'Invalid destination.' });

    const merchant = await Merchant.findById(id).select('businessName email phone kesBalance status tariffLock isDemoMerchant isAppReviewAccount');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });
    if (isTestAccount(merchant)) {
      return res.status(409).json({ error: 'This is a demo/test account — its balance is simulated, not real money owed, so it can\'t be paid out.' });
    }

    let phone;
    try {
      phone = resolveDestination(merchant, { destination, phone: rawPhone });
    } catch (e) {
      if (e instanceof NcbaValidationError) {
        return res.status(400).json({ error: e.message.startsWith('PhoneNumber') ? 'Enter a valid Kenyan phone number.' : e.message });
      }
      throw e;
    }
    const network = rawNetwork === 'airtel' || rawNetwork === 'safaricom' ? rawNetwork : detectNetwork(phone);

    const quote = await buildQuote(merchant);
    if (quote.amount <= 0) {
      return res.status(409).json({
        error: quote.kesBalance > 0
          ? `Balance of KES ${formatKes(quote.kesBalance)} is too small to send (the mobile money minimum is KES ${MOBILE_B2W_MIN_AMOUNT} after the withdrawal fee)${quote.heldAmount > 0 ? ' (or part of it was credited in the last 2 minutes and is briefly held)' : ''}.`
          : 'This merchant has no balance to send.',
      });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = generateLetterDigitOtp();
    admin.pendingAction = {
      action: ACTION,
      targetId: merchant._id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      payload: { phone, network, destination, amount: quote.amount, fee: quote.fee },
    };
    await admin.save();

    sendAdminActionOTP(
      admin.email,
      otp,
      ACTION_LABEL,
      `${merchant.businessName} (${merchant.email}) — KES ${formatKes(quote.amount)} to ${phone} (${network === 'airtel' ? 'Airtel Money' : 'M-PESA'})`
    ).catch((err) => console.error('Balance payout OTP email failed:', err));

    logAudit({
      action: 'admin.merchant.balance_payout_requested', category: 'admin', severity: 'warning',
      message: `Balance payout requested — KES ${formatKes(quote.amount)} to ${phone} (OTP sent to admin)`,
      merchant, actor: adminActor(admin), req,
      metadata: { phone, network, destination, amount: quote.amount, fee: quote.fee },
    });

    res.json({
      success: true,
      message: 'Verification code sent to your admin email.',
      data: { ...quote, phone, network, destination },
    });
  } catch (error) {
    console.error('Request Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Step 2: verify the code and send the payout. The binding is
//          consumed atomically BEFORE the transfer, so two concurrent
//          confirms with the same code can't both send money.
// @route   POST /api/admin/merchants/:id/balance-payout/confirm
// @access  Private (Admin, mutator)
export const confirmBalancePayout = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid merchant id.' });
    const code = normalizeOtp(req.body?.otp);
    if (!code) return res.status(400).json({ error: 'Enter the 6-character code (5 letters and 1 digit).' });

    const cleared = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
    const consumed = await Admin.findOneAndUpdate(
      {
        _id: req.admin._id,
        'pendingAction.action': ACTION,
        'pendingAction.targetId': new mongoose.Types.ObjectId(id),
        'pendingAction.otpHash': hashOtp(code),
        'pendingAction.expiresAt': { $gt: new Date() },
      },
      { $set: { pendingAction: cleared } },
      // Return the pre-update doc so the bound payload is still readable.
      { new: false }
    );

    if (!consumed) {
      // Hard failure clears any pending balance-payout binding, so a single
      // minted code can't be brute-forced — same rule confirmMerchantAction
      // applies to its 6-digit codes.
      await Admin.updateOne(
        { _id: req.admin._id, 'pendingAction.action': ACTION },
        { $set: { pendingAction: cleared } }
      );
      return res.status(401).json({ error: 'Verification failed. Request a new code.' });
    }

    const { phone, network, destination, amount, fee } = consumed.pendingAction?.payload || {};
    if (!phone || !amount) {
      return res.status(400).json({ error: 'This request is missing its payout details. Request a new code.' });
    }

    const merchant = await Merchant.findById(id).select('businessName email phone kesBalance');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found.' });

    const outcome = await payOutBalance({ merchant, phone, network, destination, amount, fee, req, admin: req.admin });
    if (!outcome.ok) return res.status(outcome.httpStatus).json({ error: outcome.error });

    const { transaction, newBalance, pending } = outcome;
    notifyAdmins({
      type: 'admin_balance_payout',
      severity: 'warning',
      subject: `Merchant balance sent — ${merchant.businessName}`,
      heading: 'Merchant remaining balance sent',
      details: `<p><strong>${escapeHtml(merchant.businessName || '')}</strong> — KES ${formatKes(amount)} (fee KES ${formatKes(fee)}) to ${escapeHtml(phone)}.</p>`
        + `<p>Sent by ${escapeHtml(req.admin.email || 'admin')}. Ref ${escapeHtml(transaction.reference)}. Balance left: KES ${formatKes(newBalance)}.</p>`,
      metadata: { merchantId: String(merchant._id), amount, fee, phone, reference: transaction.reference },
    });

    res.json({
      success: true,
      message: pending
        ? 'Payout submitted to NCBA — awaiting confirmation.'
        : `KES ${formatKes(amount)} sent to ${phone}.`,
      data: {
        reference: transaction.reference,
        status: transaction.status,
        amount,
        fee,
        phone,
        network,
        newBalance,
      },
    });
  } catch (error) {
    console.error('Confirm Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Sends one merchant's approved payout and does the per-merchant
// bookkeeping (audit row, merchant SMS + in-app notice). Shared by the
// single and bulk confirm paths. Never throws for a payout-level failure —
// returns { ok:false, httpStatus, error } so the bulk loop can record it
// and carry on to the next merchant.
async function payOutBalance({ merchant, phone, network, destination = 'primary', amount, fee, req, admin }) {
  let result;
  try {
    result = await executeNcbaMobileMoneyPayout({
      merchantId: merchant._id,
      phone,
      network,
      beneficiaryName: merchant.businessName,
      amount,
      narration: 'PayChain balance refund',
      referencePrefix: 'ADMIN-BAL',
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return { ok: false, httpStatus: 409, error: "The merchant's balance changed since this was requested. Re-open the payout to get a fresh quote." };
    }
    if (err instanceof NcbaPostSubmissionRecordError) {
      logAudit({
        action: 'admin.merchant.balance_payout_record_failed', category: 'admin', severity: 'critical',
        message: `Balance payout of KES ${formatKes(amount)} to ${phone} reached NCBA but could not be recorded locally (ref ${err.reference})`,
        merchant, actor: adminActor(admin), req,
        metadata: { phone, network, amount, reference: err.reference },
      });
      return { ok: false, httpStatus: 502, error: `${err.message} Reference: ${err.reference}. Do not retry — check the NCBA statement.`, reference: err.reference };
    }
    if (err instanceof NcbaOpenBankingValidationError) {
      return { ok: false, httpStatus: 400, error: err.message };
    }
    logAudit({
      action: 'admin.merchant.balance_payout_failed', category: 'admin', severity: 'warning',
      message: `Balance payout of KES ${formatKes(amount)} to ${phone} failed — balance refunded: ${err.message}`,
      merchant, actor: adminActor(admin), req,
      metadata: { phone, network, amount, error: err.message },
    });
    return { ok: false, httpStatus: 502, error: "The transfer was rejected and the merchant's balance was left untouched. Try again shortly." };
  }

  const { transaction, merchant: after } = result;
  const newBalance = Math.round((after?.kesBalance ?? 0) * 100) / 100;
  const pending = transaction.status === 'pending';

  logAudit({
    action: 'admin.merchant.balance_payout_sent', category: 'admin', severity: 'critical',
    message: `Remaining balance sent by admin (OTP-verified) — KES ${formatKes(amount)} + fee KES ${formatKes(fee)} to ${phone}${pending ? ' (awaiting NCBA confirmation)' : ''}`,
    merchant, actor: adminActor(admin), req,
    metadata: { phone, network, destination, amount, fee, reference: transaction.reference, transactionId: String(transaction._id), status: transaction.status, newBalance },
  });

  createNotification({
    merchantId: merchant._id,
    kind: 'security',
    title: 'Balance sent to your phone',
    message: `PayChain sent your remaining balance of KES ${formatKes(amount)} to ${phone}. Ref ${transaction.reference}.`,
  });
  if (merchant.phone) {
    safeSendSMS({
      to: merchant.phone,
      message: `PayChain: Your remaining balance of Ksh ${formatKes(amount)} has been sent to ${phone}. Ref ${transaction.reference}. Questions? support@paychain.co.ke`,
    }).catch((err) => console.error('Balance payout SMS failed:', err));
  }

  return { ok: true, transaction, newBalance, pending };
}

// ── Bulk: pay everyone / pay selected merchants ─────────────────────────────
// Always to each merchant's PRIMARY phone — a per-merchant "other number"
// only makes sense one at a time (use the single flow above for that).
// One 5-letter + 1-digit code approves the whole list of quotes; payouts
// then run one at a time in the background (an HTTP request can't stay open
// for hundreds of NCBA calls) and the admin UI polls the batch for progress.

const BULK_ACTION = 'balance_payout_bulk';
const BULK_LABEL = 'Send remaining balances (batch)';
const MAX_BULK = 500;

// Resolves the scope to merchants and splits them into payable quotes and
// skipped rows (with a reason the admin sees before approving).
async function buildBulkQuotes({ all, merchantIds }) {
  const base = { isDemoMerchant: { $ne: true }, isAppReviewAccount: { $ne: true } };
  let query;
  if (all) {
    query = { ...base, kesBalance: { $gt: 0 } };
  } else {
    const ids = [...new Set((Array.isArray(merchantIds) ? merchantIds : []).map(String))]
      .filter((x) => mongoose.Types.ObjectId.isValid(x));
    if (ids.length === 0) return { error: 'Select at least one merchant.' };
    query = { _id: { $in: ids } };
  }
  const merchants = await Merchant.find(query)
    .select('businessName email phone kesBalance status tariffLock isDemoMerchant isAppReviewAccount')
    .sort('-kesBalance');
  if (merchants.length > MAX_BULK) {
    return { error: `That's ${merchants.length} merchants — a batch can pay at most ${MAX_BULK}. Select fewer and run it in parts.` };
  }

  const items = [];
  const skipped = [];
  for (const m of merchants) {
    const row = { merchantId: String(m._id), businessName: m.businessName || m.email || '—', kesBalance: Math.round((m.kesBalance || 0) * 100) / 100 };
    if (isTestAccount(m)) { skipped.push({ ...row, reason: 'Demo/test account (simulated balance)' }); continue; }
    if (!(m.kesBalance > 0)) { skipped.push({ ...row, reason: 'No balance' }); continue; }
    let phone;
    try { phone = validatePhoneNumber(m.phone); } catch { skipped.push({ ...row, reason: 'No valid primary phone — use the single payout to send to another number' }); continue; }
    const quote = await buildQuote(m);
    if (quote.amount <= 0) {
      skipped.push({ ...row, reason: quote.heldAmount > 0 ? 'Recently credited — briefly held, try again in 2 min' : `Below the KES ${MOBILE_B2W_MIN_AMOUNT} mobile money minimum after fees` });
      continue;
    }
    items.push({
      ...row,
      phone,
      network: detectNetwork(phone),
      amount: quote.amount,
      fee: quote.fee,
      remainingAfter: quote.remainingAfter,
      cappedAtMax: quote.cappedAtMax,
    });
  }
  const round = (v) => Math.round(v * 100) / 100;
  return {
    items,
    skipped,
    totalAmount: round(items.reduce((t, i) => t + i.amount, 0)),
    totalFees: round(items.reduce((t, i) => t + i.fee, 0)),
  };
}

// Every item update bumps updatedAt, so a 'running' batch with no progress
// for 10 minutes was cut off by a restart — it mustn't block new batches
// forever. (Its 'queued' items were never sent; see the model's comment.)
const STALE_BATCH_MS = 10 * 60 * 1000;
const runningBatchExists = () => AdminBalancePayoutBatch.exists({
  status: 'running',
  updatedAt: { $gt: new Date(Date.now() - STALE_BATCH_MS) },
});

// @desc    Quote a batch payout without sending anything.
// @route   POST /api/admin/merchants/balance-payout/bulk/preview  { all } | { merchantIds }
// @access  Private (Admin, mutator)
export const previewBulkBalancePayout = async (req, res) => {
  try {
    const quotes = await buildBulkQuotes(req.body || {});
    if (quotes.error) return res.status(400).json({ error: quotes.error });
    res.json({ success: true, data: { ...quotes, maxPerPayout: MAX_B2C_AMOUNT } });
  } catch (error) {
    console.error('Preview Bulk Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Quote the batch and email the admin a code approving exactly it.
// @route   POST /api/admin/merchants/balance-payout/bulk/request  { all } | { merchantIds }
// @access  Private (Admin, mutator)
export const requestBulkBalancePayout = async (req, res) => {
  try {
    if (await runningBatchExists()) {
      return res.status(409).json({ error: 'Another balance payout batch is still running. Wait for it to finish first.' });
    }
    const all = !!req.body?.all;
    const quotes = await buildBulkQuotes(req.body || {});
    if (quotes.error) return res.status(400).json({ error: quotes.error });
    if (quotes.items.length === 0) {
      return res.status(409).json({ error: 'None of these merchants can be paid right now — see the reasons listed.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = generateLetterDigitOtp();
    admin.pendingAction = {
      action: BULK_ACTION,
      targetId: admin._id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      payload: {
        scope: all ? 'all' : 'selected',
        items: quotes.items.map(({ merchantId, businessName, phone, network, amount, fee }) => ({ merchantId, businessName, phone, network, amount, fee })),
        totalAmount: quotes.totalAmount,
        totalFees: quotes.totalFees,
      },
    };
    admin.markModified('pendingAction');
    await admin.save();

    sendAdminActionOTP(
      admin.email,
      otp,
      BULK_LABEL,
      `${quotes.items.length} merchant${quotes.items.length === 1 ? '' : 's'} — KES ${formatKes(quotes.totalAmount)} total to their primary phones`
    ).catch((err) => console.error('Bulk balance payout OTP email failed:', err));

    logAudit({
      action: 'admin.merchant.balance_payout_bulk_requested', category: 'admin', severity: 'warning',
      message: `Batch balance payout requested — ${quotes.items.length} merchants, KES ${formatKes(quotes.totalAmount)} (OTP sent to admin)`,
      actor: adminActor(admin), req,
      metadata: { scope: all ? 'all' : 'selected', count: quotes.items.length, totalAmount: quotes.totalAmount, totalFees: quotes.totalFees },
    });

    res.json({ success: true, message: 'Verification code sent to your admin email.', data: { ...quotes, maxPerPayout: MAX_B2C_AMOUNT } });
  } catch (error) {
    console.error('Request Bulk Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

async function processBatch(batchId, { req, admin }) {
  const batch = await AdminBalancePayoutBatch.findById(batchId);
  if (!batch) return;
  const counts = { sent: 0, pending: 0, failed: 0 };

  for (let i = 0; i < batch.items.length; i += 1) {
    const item = batch.items[i];
    await AdminBalancePayoutBatch.updateOne({ _id: batchId }, { $set: { [`items.${i}.status`]: 'processing' } });

    let update;
    try {
      const merchant = await Merchant.findById(item.merchantId).select('businessName email phone kesBalance');
      if (!merchant) {
        update = { status: 'failed', error: 'Merchant no longer exists.' };
      } else {
        const outcome = await payOutBalance({
          merchant, phone: item.phone, network: item.network, amount: item.amount, fee: item.fee, req, admin,
        });
        update = outcome.ok
          ? { status: outcome.pending ? 'pending' : 'sent', reference: outcome.transaction.reference }
          : { status: 'failed', error: outcome.error, reference: outcome.reference || null };
      }
    } catch (err) {
      console.error('Bulk balance payout item error:', err);
      update = { status: 'failed', error: err.message || 'Unexpected error' };
    }
    counts[update.status] += 1;
    await AdminBalancePayoutBatch.updateOne({ _id: batchId }, {
      $set: {
        [`items.${i}.status`]: update.status,
        [`items.${i}.reference`]: update.reference || null,
        [`items.${i}.error`]: update.error || null,
        [`items.${i}.processedAt`]: new Date(),
      },
    });
  }

  await AdminBalancePayoutBatch.updateOne({ _id: batchId }, { $set: { status: 'completed', completedAt: new Date() } });

  logAudit({
    action: 'admin.merchant.balance_payout_bulk_completed', category: 'admin', severity: 'critical',
    message: `Batch balance payout finished — ${counts.sent} sent, ${counts.pending} awaiting NCBA, ${counts.failed} failed (of ${batch.items.length})`,
    actor: adminActor(admin), req,
    metadata: { batchId: String(batchId), ...counts, totalAmount: batch.totalAmount, totalFees: batch.totalFees },
  });
  notifyAdmins({
    type: 'admin_balance_payout_bulk',
    severity: counts.failed ? 'critical' : 'warning',
    subject: `Batch balance payout finished — ${batch.items.length} merchants`,
    heading: 'Merchant balances sent (batch)',
    details: `<p>${counts.sent} sent, ${counts.pending} awaiting NCBA confirmation, <strong>${counts.failed} failed</strong> — of ${batch.items.length} merchants, KES ${formatKes(batch.totalAmount)} approved.</p>`
      + `<p>Started by ${escapeHtml(admin.email || 'admin')}. Full results on the Pool Reconciliation page.</p>`,
    metadata: { batchId: String(batchId), ...counts },
  });
}

// @desc    Verify the code, record the batch and start paying in the
//          background. Responds immediately with the batch id to poll.
// @route   POST /api/admin/merchants/balance-payout/bulk/confirm  { otp }
// @access  Private (Admin, mutator)
export const confirmBulkBalancePayout = async (req, res) => {
  try {
    const code = normalizeOtp(req.body?.otp);
    if (!code) return res.status(400).json({ error: 'Enter the 6-character code (5 letters and 1 digit).' });

    const cleared = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
    const consumed = await Admin.findOneAndUpdate(
      {
        _id: req.admin._id,
        'pendingAction.action': BULK_ACTION,
        'pendingAction.otpHash': hashOtp(code),
        'pendingAction.expiresAt': { $gt: new Date() },
      },
      { $set: { pendingAction: cleared } },
      { new: false }
    );
    if (!consumed) {
      await Admin.updateOne(
        { _id: req.admin._id, 'pendingAction.action': BULK_ACTION },
        { $set: { pendingAction: cleared } }
      );
      return res.status(401).json({ error: 'Verification failed. Request a new code.' });
    }

    const payload = consumed.pendingAction?.payload || {};
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'This request has no payouts in it. Request a new code.' });
    }
    if (await runningBatchExists()) {
      return res.status(409).json({ error: 'Another balance payout batch is still running. Request a new code once it finishes.' });
    }

    const batch = await AdminBalancePayoutBatch.create({
      createdBy: req.admin._id,
      createdByEmail: req.admin.email || null,
      scope: payload.scope === 'all' ? 'all' : 'selected',
      items: payload.items.map((i) => ({ ...i, status: 'queued' })),
      totalAmount: payload.totalAmount || 0,
      totalFees: payload.totalFees || 0,
    });

    logAudit({
      action: 'admin.merchant.balance_payout_bulk_started', category: 'admin', severity: 'critical',
      message: `Batch balance payout started (OTP-verified) — ${batch.items.length} merchants, KES ${formatKes(batch.totalAmount)}`,
      actor: adminActor(req.admin), req,
      metadata: { batchId: String(batch._id), count: batch.items.length, totalAmount: batch.totalAmount },
    });

    const admin = { _id: req.admin._id, email: req.admin.email, name: req.admin.name };
    processBatch(batch._id, { req, admin }).catch(async (err) => {
      console.error('Bulk balance payout batch crashed:', err);
      await AdminBalancePayoutBatch.updateOne({ _id: batch._id }, { $set: { status: 'completed', completedAt: new Date() } }).catch(() => {});
    });

    res.json({ success: true, message: `Paying ${batch.items.length} merchants…`, data: { batchId: batch._id } });
  } catch (error) {
    console.error('Confirm Bulk Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    One batch's progress/results.
// @route   GET /api/admin/merchants/balance-payout/bulk/:batchId
// @access  Private (Admin, mutator)
export const getBulkBalancePayout = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(batchId)) return res.status(400).json({ error: 'Invalid batch id.' });
    const batch = await AdminBalancePayoutBatch.findById(batchId).lean();
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });
    res.json({ success: true, data: batch });
  } catch (error) {
    console.error('Get Bulk Balance Payout Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Recent batches (newest first) — the record of past runs.
// @route   GET /api/admin/merchants/balance-payout/bulk
// @access  Private (Admin, mutator)
export const listBulkBalancePayouts = async (req, res) => {
  try {
    const batches = await AdminBalancePayoutBatch.find().sort('-createdAt').limit(20).lean();
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('List Bulk Balance Payouts Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
