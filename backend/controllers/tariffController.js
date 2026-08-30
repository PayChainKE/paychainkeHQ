import crypto from 'crypto';
import Admin from '../models/Admin.js';
import TariffCard from '../models/TariffCard.js';
import { SAFARICOM_TARIFF } from '../config/revenueRateCard.js';
import {
  FLAT_FEE_FREE_TIER_MAX_KES,
  calculateCustomerSurcharge,
  getCustomerSurchargeBands,
  getInvoiceClientMarkupBands,
  getInvoiceMerchantFlatFee,
} from '../utils/pricingEngine.js';
import { MAX_PESALINK_AMOUNT, RTGS_BASE_COST, getPesaLinkTariff, getRtgsTariff } from '../config/bankTransferTariffCard.js';
import { B2C_REGISTERED_USER_BANDS, MAX_B2C_AMOUNT, calculateB2cServiceFee } from '../config/mpesaB2cTariffCard.js';
import { MAX_LIPA_NA_MPESA_B2B_AMOUNT, getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import {
  KPLC_POSTPAID_BASE_COST,
  NCWSC_BASE_COST,
  INTERNET_BASE_COST,
  getKplcPostpaidTariff,
  getKplcPrepaidTariff,
  getNcwscTariff,
  getInternetTariff,
  getRentTariff,
} from '../config/billPaymentTariffCard.js';
import {
  getNcbaDisbursementFlatFee,
  getStablecoinPaymentFlatFee,
  getSettlementFlatFee,
  getMpesaB2bLegacyFlatFee,
} from '../config/revenueRateCard.js';
import { sendAdminActionOTP } from '../utils/resend.js';
import { logAudit } from '../utils/auditLog.js';
import { adminActor } from './adminController.js';
import { loadTariffCache } from '../services/tariffCardCache.js';

// Timing-safe 6-digit-OTP-hash compare — identical helper to
// adminController.js's own safeEqual (kept local here rather than exported/
// imported to avoid coupling two controllers on an internal helper).
const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes, per this feature's explicit requirement
// Sanity ceiling against a fat-finger edit (e.g. an extra zero) going live
// platform-wide — every real fee on the platform today tops out around
// KES 400 (RTGS), so this is ~25x the highest real figure, generous enough
// to never block a deliberate re-price while still catching a genuine typo
// before it reaches real transactions.
const MAX_SANE_FEE_KES = 10_000;

// Turns a `{ max, ...fee fields }[]` band array into `{ label, ...fee
// fields }[]` with a human-readable "low–high" range per row (low is the
// previous row's max + 1, first row starts at 1) — every table on the
// Transaction Tariffs admin page is built from this, off the exact same
// arrays the pricing engine itself reads, so this can never drift from
// what's actually charged. `free` collapses every band at or below the
// platform's free-tier ceiling into one "1–{free}" row — some source
// tables (SAFARICOM_TARIFF) carry two separate zero-fee rows below 100
// (a 49 and a 100 boundary) that would otherwise render as two identical
// "free" rows back to back.
function labelBands(bands, { free } = {}) {
  const rows = free ? bands.filter((b) => b.max >= free) : bands;
  let prevMax = free || 0;
  return rows.map((b, i) => {
    const low = i === 0 && free ? 1 : prevMax + 1;
    prevMax = b.max;
    const label = i === 0 && free ? `1–${free}` : (b.max >= 250_000 ? `${low.toLocaleString()}+` : `${low.toLocaleString()}–${b.max.toLocaleString()}`);
    return { label, ...b };
  });
}

// Every admin-editable rate lives under one of these ~16 keys (see
// migrations/seedTariffCards.js). Building the full tariff payload below
// stamps `tariffKey` (flat cards) or `tariffKey`+`max` per row (tiered
// cards) onto every editable figure, so the frontend never hardcodes a key
// name — it just echoes back whatever this endpoint already told it.
function buildTariffPayload() {
  return {
    moneyIn: {
      note: 'Customer pays both columns on STK Push, QR, Payment Links, and self-funded wallet top-ups. Raw Paybill deposits / generic NCBA collections are KES 0 to everyone — Safaricom deducts its own cut from the payer automatically, outside PayChain\'s ledger entirely.',
      freeAtOrBelow: FLAT_FEE_FREE_TIER_MAX_KES,
      tariffKey: 'customer_surcharge',
      editable: 'paychainFee',
      // Evaluates calculateCustomerSurcharge at each real Safaricom band
      // boundary rather than zipping the two tables by array index —
      // getCustomerSurchargeBands() has its own, coarser boundary list, so
      // an index-paired zip would silently mismatch amounts and fees a few
      // rows in.
      bands: labelBands(SAFARICOM_TARIFF.map((s) => ({
        max: s.max,
        safaricomFee: s.fee,
        paychainFee: calculateCustomerSurcharge(s.max),
      })), { free: FLAT_FEE_FREE_TIER_MAX_KES }),
    },
    invoices: {
      note: `The one deliberate dual charge: the merchant pays a flat KES ${getInvoiceMerchantFlatFee()} service fee (clamped to the invoice value) alongside the customer's own tiered markup below.`,
      merchantFlatFee: getInvoiceMerchantFlatFee(),
      merchantFlatFeeKey: 'invoice_merchant_flat_fee',
      freeAtOrBelow: FLAT_FEE_FREE_TIER_MAX_KES,
      customerMarkupKey: 'invoice_client_markup',
      customerMarkupBands: labelBands(getInvoiceClientMarkupBands(), { free: FLAT_FEE_FREE_TIER_MAX_KES }),
    },
    moneyOut: {
      note: 'Merchant pays both the real third-party (NCBA/Safaricom) cost and PayChain\'s own margin on every rail below.',
      rails: [
        {
          id: 'rtgs',
          label: 'RTGS (bank transfer)',
          shape: 'flat',
          tariffKey: 'rtgs_service_fee',
          ...getRtgsTariff(),
        },
        {
          id: 'pesalink',
          label: 'PesaLink (bank transfer)',
          shape: 'tiered',
          tariffKey: 'pesalink_service_fee',
          maxAmount: MAX_PESALINK_AMOUNT,
          bands: labelBands([500, 3500, 7000, 10000, 250000].map((max) => ({ max, ...getPesaLinkTariff(max) }))),
        },
        {
          id: 'mobile_withdrawal',
          label: 'Mobile Withdrawal (M-Pesa B2C / NCBA Mobile B2W)',
          shape: 'tiered',
          tariffKey: 'mobile_withdrawal_service_fee',
          maxAmount: MAX_B2C_AMOUNT,
          // Same reasoning as moneyIn above — the PayChain-margin bands have
          // their own, coarser boundary list than B2C_REGISTERED_USER_BANDS
          // (14 rows vs 20), so this evaluates calculateB2cServiceFee at
          // each real Safaricom-cost boundary instead of an index zip.
          bands: labelBands(B2C_REGISTERED_USER_BANDS.map((s) => ({
            max: s.max,
            baseCost: s.safaricomFee,
            serviceFee: calculateB2cServiceFee(s.max),
          }))).map((b) => ({ ...b, totalFee: round2(b.baseCost + b.serviceFee) })),
        },
        {
          id: 'lipa_na_mpesa',
          label: 'Lipa na M-Pesa B2B (Paybill/Till payout)',
          shape: 'tiered',
          tariffKey: 'lipa_na_mpesa_service_fee',
          maxAmount: MAX_LIPA_NA_MPESA_B2B_AMOUNT,
          bands: labelBands([100, 500, 1000, 2500, 5000, 10000, 20000, 30000, 40000, 50000, 100000, 150000, 200000, 250000].map((max) => ({ max, ...getLipaNaMpesaTariff(max) }))),
        },
        {
          id: 'kplc_postpaid',
          label: 'KPLC Postpaid Bill',
          shape: 'flat',
          tariffKey: 'kplc_postpaid_service_fee',
          ...getKplcPostpaidTariff(),
        },
        {
          id: 'kplc_prepaid',
          label: 'KPLC Prepaid Token',
          shape: 'tiered',
          tariffKey: 'kplc_prepaid_service_fee',
          bands: labelBands([500, 2000, 4000, 7000, 10000, 25000, 50000, 100000, 250000].map((max) => ({ max, ...getKplcPrepaidTariff(max) }))),
        },
        {
          id: 'ncwsc',
          label: 'NCWSC (Nairobi Water)',
          shape: 'flat',
          tariffKey: 'ncwsc_service_fee',
          ...getNcwscTariff(),
        },
        {
          id: 'internet',
          label: 'Internet (priced, not yet a live Bulk Pay category)',
          shape: 'flat',
          dormant: true,
          tariffKey: 'internet_service_fee',
          ...getInternetTariff(),
        },
        {
          id: 'rent',
          label: 'Rent Settlement (priced, not yet a live Bulk Pay category)',
          shape: 'tiered',
          dormant: true,
          tariffKey: 'rent_service_fee',
          bands: labelBands([10000, 20000, 35000, 50000, 250000].map((max) => ({ max, ...getRentTariff(max) }))),
        },
      ],
    },
    flatStreams: {
      note: 'Flat PayChain margins on the remaining transaction types, not tied to a tiered NCBA/Safaricom cost sheet.',
      streams: [
        { id: 'ncba_disbursement', label: 'NCBA Disbursement (generic, e.g. bank/utility bulk payouts routed via NCBA Host-to-Host)', tariffKey: 'ncba_disbursement_flat', flatFee: getNcbaDisbursementFlatFee() },
        { id: 'stablecoin_payment', label: 'Stablecoin (USDC) outbound payment', tariffKey: 'stablecoin_flat', flatFee: getStablecoinPaymentFlatFee() },
        { id: 'settlement', label: 'Generic settlement (bank/mobile off-ramp)', tariffKey: 'settlement_flat', flatFee: getSettlementFlatFee() },
        { id: 'mpesa_b2b_legacy', label: 'M-Pesa B2B (legacy, pre-NCBA — historical transactions only)', tariffKey: 'mpesa_b2b_legacy_flat', flatFee: getMpesaB2bLegacyFlatFee() },
      ],
    },
  };
}

// @desc    Every fee tariff currently live on the platform, read straight
//          from the same config files/cache the pricing engine itself
//          reads — single source of truth, so this page can never show a
//          stale or hand-copied number. Grouped exactly like the
//          platform's own money-in / invoices / money-out / flat-stream
//          split. Third-party cost figures (baseCost/safaricomFee) are
//          shown for transparency but are never editable — only
//          PayChain's own kept margin is (see requestTariffUpdate below).
// @route   GET /api/admin/tariffs
// @access  Private (Admin)
export const getTariffs = async (req, res) => {
  try {
    res.json({ success: true, data: buildTariffPayload() });
  } catch (error) {
    console.error('Get Tariffs Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Every key a change can target, and — for tiered ones — the exact `max`
// boundaries that must be present, in this order. This is the shape
// contract requestTariffUpdate validates every submitted change against:
// a request can change a `fee` value but can never add, remove, reorder,
// or re-boundary a band.
const TARIFF_SHAPES = {
  customer_surcharge: { shape: 'tiered', maxes: [100, 500, 1000, 1500, 2500, 3500, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 70000, 250000] },
  invoice_client_markup: { shape: 'tiered', maxes: [100, 500, 1000, 1500, 2500, 3500, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 70000, 250000] },
  invoice_merchant_flat_fee: { shape: 'flat' },
  pesalink_service_fee: { shape: 'tiered', maxes: [500, 3500, 7000, 10000, 250000] },
  rtgs_service_fee: { shape: 'flat' },
  mobile_withdrawal_service_fee: { shape: 'tiered', maxes: [49, 100, 500, 1000, 1500, 2500, 3500, 5000, 7500, 10000, 20000, 50000, 100000, 250000] },
  lipa_na_mpesa_service_fee: { shape: 'tiered', maxes: [100, 500, 1000, 2500, 5000, 10000, 20000, 30000, 40000, 50000, 100000, 150000, 200000, 250000] },
  kplc_postpaid_service_fee: { shape: 'flat' },
  kplc_prepaid_service_fee: { shape: 'tiered', maxes: [500, 2000, 4000, 7000, 10000, 25000, 50000, 100000, 250000] },
  ncwsc_service_fee: { shape: 'flat' },
  internet_service_fee: { shape: 'flat' },
  rent_service_fee: { shape: 'tiered', maxes: [10000, 20000, 35000, 50000, 250000] },
  settlement_flat: { shape: 'flat' },
  stablecoin_flat: { shape: 'flat' },
  mpesa_b2b_legacy_flat: { shape: 'flat' },
  ncba_disbursement_flat: { shape: 'flat' },
};

function labelForChange(key, max) {
  const known = {
    customer_surcharge: 'Customer Surcharge', invoice_client_markup: 'Invoice Customer Markup',
    invoice_merchant_flat_fee: 'Invoice Merchant Fee', pesalink_service_fee: 'PesaLink',
    rtgs_service_fee: 'RTGS', mobile_withdrawal_service_fee: 'Mobile Withdrawal',
    lipa_na_mpesa_service_fee: 'Lipa na M-Pesa B2B', kplc_postpaid_service_fee: 'KPLC Postpaid',
    kplc_prepaid_service_fee: 'KPLC Prepaid', ncwsc_service_fee: 'NCWSC', internet_service_fee: 'Internet',
    rent_service_fee: 'Rent Settlement', settlement_flat: 'Generic Settlement', stablecoin_flat: 'Stablecoin Payment',
    mpesa_b2b_legacy_flat: 'M-Pesa B2B (legacy)', ncba_disbursement_flat: 'NCBA Disbursement',
  };
  const label = known[key] || key;
  return max != null ? `${label} (up to KES ${max.toLocaleString()})` : label;
}

// @desc    Validate a proposed batch of tariff changes and mint a 5-minute
//          OTP bound to exactly that batch, emailed to the requesting
//          admin. Mirrors requestMerchantAction's OTP-binding pattern
//          (Admin.pendingAction) — see adminController.js.
// @route   POST /api/admin/tariffs/request-update
// @access  Private (Admin, requireMutator)
export const requestTariffUpdate = async (req, res) => {
  try {
    const { changes } = req.body || {};
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: 'Provide at least one tariff change.' });
    }
    if (changes.length > 100) {
      return res.status(400).json({ error: 'Too many changes in one batch.' });
    }

    const summaryLines = [];
    for (const change of changes) {
      const { key, max, newFee } = change || {};
      const contract = TARIFF_SHAPES[key];
      if (!contract) return res.status(400).json({ error: `Unknown tariff key: ${key}` });
      if (!Number.isFinite(Number(newFee)) || Number(newFee) < 0) {
        return res.status(400).json({ error: `${labelForChange(key, max)}: fee must be a non-negative number.` });
      }
      if (Number(newFee) > MAX_SANE_FEE_KES) {
        return res.status(400).json({ error: `${labelForChange(key, max)}: KES ${newFee} is far above any real fee on this platform — check for a typo (an extra zero?). If this is genuinely intended, it needs a code change, not this form.` });
      }
      if (contract.shape === 'flat') {
        if (max != null) return res.status(400).json({ error: `${labelForChange(key)} is a flat fee — it doesn't take a band.` });
      } else {
        if (!contract.maxes.includes(Number(max))) {
          return res.status(400).json({ error: `${labelForChange(key, max)}: not a real band boundary for this tariff — band boundaries can't be changed, only the fee inside one.` });
        }
      }
      summaryLines.push(`${labelForChange(key, max)}: KES ${newFee}`);
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    admin.pendingAction = {
      action: 'update_tariffs',
      targetId: null,
      otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      payload: changes.map((c) => ({ key: c.key, max: c.max ?? null, newFee: Number(c.newFee) })),
    };
    await admin.save();

    sendAdminActionOTP(
      admin.email,
      otp,
      'Update Transaction Tariffs',
      summaryLines.join('; ')
    ).catch((err) => console.error('Tariff update OTP email failed:', err));

    res.json({ success: true, message: 'Verification code sent to your admin email. It expires in 5 minutes.' });
  } catch (error) {
    console.error('Request Tariff Update Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Confirm a pending tariff-update batch with the OTP. Applies
//          every change atomically, reloads the in-memory tariff cache
//          (live for the very next transaction, no restart needed), and
//          audit-logs the full before/after diff.
// @route   POST /api/admin/tariffs/confirm-update
// @access  Private (Admin, requireMutator)
export const confirmTariffUpdate = async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ error: 'A 6-digit code is required.' });
    }

    // Only the otpHash subfield is `select: false` — projecting both
    // `pendingAction` and `pendingAction.otpHash` would trigger a MongoDB
    // path-collision error (code 31249). Loading just the hash brings the
    // rest of the subdoc along via the default projection — same pattern as
    // adminController.js#confirmMerchantAction.
    const admin = await Admin.findById(req.admin._id).select('+pendingAction.otpHash');
    if (!admin) return res.status(401).json({ error: 'Admin session invalid.' });

    const pa = admin.pendingAction || {};
    const bindingOk = pa.action === 'update_tariffs' && pa.otpHash && pa.expiresAt && new Date() < new Date(pa.expiresAt);
    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const otpOk = bindingOk && safeEqual(otpHash, pa.otpHash);

    if (!otpOk) {
      // Clear binding on hard failure to prevent brute force on a single mint.
      admin.pendingAction = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
      await admin.save();
      return res.status(401).json({ error: 'Verification failed or code expired. Re-request a new code.' });
    }

    const changes = Array.isArray(pa.payload) ? pa.payload : [];
    const before = [];
    const bulkOps = [];
    for (const change of changes) {
      const { key, max, newFee } = change;
      const doc = await TariffCard.findOne({ key });
      if (!doc) continue; // shouldn't happen — key was validated at request time
      if (doc.shape === 'flat') {
        before.push({ key, max: null, oldFee: doc.flatFee, newFee });
        bulkOps.push({ updateOne: { filter: { key }, update: { $set: { flatFee: newFee, updatedBy: req.admin._id } } } });
      } else {
        const band = doc.bands.find((b) => b.max === max);
        before.push({ key, max, oldFee: band?.fee ?? null, newFee });
        bulkOps.push({
          updateOne: {
            filter: { key, 'bands.max': max },
            update: { $set: { 'bands.$.fee': newFee, updatedBy: req.admin._id } },
          },
        });
      }
    }
    if (bulkOps.length > 0) {
      await TariffCard.bulkWrite(bulkOps);
    }

    // Single-use — clear regardless of what happens next.
    admin.pendingAction = { action: null, targetId: null, otpHash: null, expiresAt: null, payload: null };
    await admin.save();

    await loadTariffCache();

    logAudit({
      action: 'admin.tariffs.updated',
      category: 'admin',
      severity: 'critical',
      message: `Admin updated ${before.length} tariff value(s) (OTP-verified)`,
      actor: adminActor(admin),
      req,
      metadata: { changes: before },
    });

    res.json({ success: true, data: buildTariffPayload() });
  } catch (error) {
    console.error('Confirm Tariff Update Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
