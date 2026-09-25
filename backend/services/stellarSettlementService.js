import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import StellarLedgerEntry from '../models/StellarLedgerEntry.js';
import * as stellar from '../utils/stellarHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';

// Stellar Instaward round two — testnet only, fiat side simulated.
//
//  Deliverable 1: a per-merchant settlement rule. A Stellar pilot merchant
//    (Merchant.isDemoMerchant) sets what share of each incoming payment is
//    auto-converted to testnet USDC in their Stellar wallet; the rest stays
//    liquid in KES. Applied AFTER the KES credit, off the payment path, so a
//    slow Stellar network can never delay or break a payment notification
//    (the reason the old automatic conversion was switched off — see
//    config/inflationShieldFlag.js).
//  Deliverable 2: Request Payout — debits the merchant's Stellar wallet
//    on-chain and produces a SIMULATED M-Pesa B2C disbursement to their
//    registered phone, with a receipt hash. No real money moves and no NCBA
//    rail is touched.
//
// Every event is written to StellarLedgerEntry, the source of the
// reconciliation statement (with StellarExpert testnet links).

export const MIN_SPLIT_KES = 1;
let stellarCallTimeoutMs = Number(process.env.STELLAR_CALL_TIMEOUT_MS) || 25_000;
// Test hook: the stress test shortens this to prove RPC-timeout handling.
export const __setStellarTimeoutMs = (ms) => { stellarCallTimeoutMs = ms; };

export class SettlementError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'SettlementError';
    this.code = code;
    this.status = status;
  }
}

// Stellar / rate dependencies, overridable so the stress test and unit tests
// can run without the network (see scripts/stellar-stress-test.js).
const deps = {
  settle: stellar.settleInflationShield,
  sweep: stellar.swapUsdcToKesOnChain,
  balance: stellar.getWalletBalance,
  rate: getLiveKesToUsdcRate,
};
export const __setStellarDeps = (overrides) => Object.assign(deps, overrides);

const round2 = (n) => Math.round(n * 100) / 100;
const round7 = (n) => Math.round(n * 1e7) / 1e7;

// ── Pure helpers (unit-tested) ──────────────────────────────────────────

/** Splits a net KES credit: stellarKes goes to USDC, liquidKes stays in KES. */
export function computeSplit(netAmount, percent) {
  const net = Number(netAmount);
  const pct = Number(percent);
  const safeNet = Number.isFinite(net) && net > 0 ? net : 0;
  if (!safeNet || !Number.isFinite(pct) || pct <= 0) return { stellarKes: 0, liquidKes: round2(safeNet) };
  const stellarKes = round2((safeNet * Math.min(pct, 100)) / 100);
  return { stellarKes, liquidKes: round2(safeNet - stellarKes) };
}

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

/** SHA-256 over the canonical (key-sorted) JSON of the receipt fields. */
export const buildReceiptHash = (fields) =>
  crypto.createHash('sha256').update(stableStringify(fields)).digest('hex');

export const explorerTxUrl = (hash) => {
  if (!hash) return null;
  const net = String(stellar.STELLAR_NETWORK).toUpperCase() === 'PUBLIC' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
};

const toMsisdn254 = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (/^254[71]\d{8}$/.test(d)) return d;
  if (/^0[71]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[71]\d{8}$/.test(d)) return `254${d}`;
  return d || null;
};

export const maskPhone = (phone) => {
  const d = toMsisdn254(phone);
  if (!d || d.length < 9) return null;
  const local = d.startsWith('254') ? `0${d.slice(3)}` : d;
  return `${local.slice(0, 4)} *** ${local.slice(-3)}`;
};

/**
 * Builds a Safaricom-Daraja-shaped B2C request and a successful result payload.
 * SIMULATION ONLY: it is never sent anywhere (the callback URLs are on the
 * reserved `.invalid` TLD so nothing could ever resolve them) and every field
 * says so. Stored on the ledger entry as the audit trail of the disbursement.
 */
export function buildSimulatedB2C({ phone, kesAmount, reference, now = new Date() }) {
  const msisdn = toMsisdn254(phone);
  const originator = crypto.randomUUID();
  const transactionId = `SIM${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return {
    simulated: true,
    request: {
      InitiatorName: 'PAYCHAIN_SIMULATION',
      SecurityCredential: 'SIMULATED',
      CommandID: 'BusinessPayment',
      Amount: kesAmount,
      PartyA: 'SIMULATED',
      PartyB: msisdn,
      Remarks: `PayChain Stellar redemption ${reference}`,
      QueueTimeOutURL: 'https://simulated.invalid/b2c/timeout',
      ResultURL: 'https://simulated.invalid/b2c/result',
      Occasion: 'STELLAR_REDEMPTION',
    },
    response: {
      Result: {
        ResultType: 0,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully. (SIMULATED)',
        OriginatorConversationID: originator,
        ConversationID: `AG_SIM_${originator.slice(0, 8)}`,
        TransactionID: transactionId,
        ResultParameters: {
          ResultParameter: [
            { Key: 'TransactionAmount', Value: kesAmount },
            { Key: 'TransactionReceipt', Value: transactionId },
            { Key: 'ReceiverPartyPublicName', Value: `${maskPhone(phone) || msisdn} (simulated)` },
            { Key: 'TransactionCompletedDateTime', Value: now.toISOString() },
          ],
        },
      },
    },
  };
}

// Spreadsheet formula injection guard for the CSV export.
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const RECONCILIATION_COLUMNS = [
  'Date (UTC)', 'Type', 'Status', 'Source payment', 'Split %', 'KES', 'USDC', 'Rate (USDC per KES)',
  'Stellar tx hash', 'StellarExpert link', 'Receipt hash', 'Simulated M-Pesa receipt', 'Note',
];

export function ledgerEntryToRow(e) {
  return [
    new Date(e.createdAt).toISOString(),
    e.kind === 'split_settlement' ? 'Auto-settlement to Stellar' : 'Redemption to M-Pesa (simulated)',
    e.status,
    e.sourceReference || '',
    e.splitPercent ?? '',
    e.kesAmount ?? '',
    e.usdcAmount ?? '',
    e.rate ?? '',
    e.stellarTxHash || '',
    explorerTxUrl(e.stellarTxHash) || '',
    e.receiptHash || '',
    e.simulatedB2C?.response?.Result?.TransactionID || '',
    e.errorMessage || '',
  ];
}

export function ledgerToCsv(entries) {
  return [RECONCILIATION_COLUMNS, ...entries.map(ledgerEntryToRow)]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

// A failure that provably left nothing on the ledger (funds short, no
// trustline, network rejected the tx) versus an ambiguous one (timeout, dropped
// connection) where the transaction may still have landed.
const DEFINITIVE_FAILURE = [
  /insufficient usdc/i, /no usdc trustline/i, /does not exist/i, /too small/i,
  /\bop_[a-z_]+/i, /\btx_[a-z_]+/i, /is not set/i, /could not decrypt/i,
];
export const isDefinitiveFailure = (err) =>
  err?.code === 'INSUFFICIENT_USDC' || DEFINITIVE_FAILURE.some((re) => re.test(String(err?.message || '')));

const withTimeout = (promise, ms = stellarCallTimeoutMs) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new SettlementError('The Stellar network did not respond in time.', 'RPC_TIMEOUT', 504)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const assertPilotMerchant = (merchant) => {
  if (!merchant?.isDemoMerchant) {
    throw new SettlementError('This feature is not available on your account.', 'NOT_AVAILABLE', 403);
  }
  if (!merchant.stellarPublicKey) {
    throw new SettlementError('No Stellar wallet configured for this merchant.', 'NO_WALLET', 400);
  }
};

// ── Settlement rule (Deliverable 1) ─────────────────────────────────────

export const getSettlementRule = (merchant) => {
  const enabled = !!merchant?.settlementRule?.enabled;
  const stellarSharePercent = Number(merchant?.settlementRule?.stellarSharePercent) || 0;
  return { enabled, stellarSharePercent, liquidSharePercent: 100 - stellarSharePercent };
};

export async function saveSettlementRule(merchantId, { enabled, stellarSharePercent }) {
  const merchant = await Merchant.findById(merchantId).select('isDemoMerchant stellarPublicKey settlementRule');
  assertPilotMerchant(merchant);

  const pct = Number(stellarSharePercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new SettlementError('Stellar share must be a percentage between 0 and 100.', 'INVALID_PERCENT');
  }
  if (typeof enabled !== 'boolean') {
    throw new SettlementError('enabled must be true or false.', 'INVALID_ENABLED');
  }

  const updated = await Merchant.findByIdAndUpdate(
    merchantId,
    { $set: { 'settlementRule.enabled': enabled, 'settlementRule.stellarSharePercent': Math.round(pct * 100) / 100 } },
    { returnDocument: 'after' }
  );
  return getSettlementRule(updated);
}

/**
 * Applies the merchant's rule to one incoming payment that has already been
 * credited in KES. Returns a small result object and never throws for an
 * expected outcome (skipped / failed / unconfirmed) — callers run it detached.
 */
export async function applySettlementSplit({ merchantId, netAmount, sourceReference }) {
  const merchant = await Merchant.findById(merchantId)
    .select('isDemoMerchant stellarPublicKey settlementRule businessName ncbaMerchantCode');
  if (!merchant?.isDemoMerchant) return { skipped: 'not_pilot_merchant' };
  const rule = getSettlementRule(merchant);
  if (!rule.enabled || rule.stellarSharePercent <= 0) return { skipped: 'rule_off' };
  if (!merchant.stellarPublicKey) return { skipped: 'no_wallet' };

  const { stellarKes } = computeSplit(netAmount, rule.stellarSharePercent);
  if (stellarKes < MIN_SPLIT_KES) return { skipped: 'below_minimum' };

  const ratePerKes = await deps.rate();
  const usdcAmount = round7(stellarKes * ratePerKes);
  if (!(usdcAmount > 0)) return { skipped: 'below_minimum' };

  // One split per incoming payment: the unique index makes a webhook retry a no-op.
  let entry;
  try {
    entry = await StellarLedgerEntry.create({
      merchantId, kind: 'split_settlement', status: 'pending', sourceReference: sourceReference || null,
      splitPercent: rule.stellarSharePercent, kesAmount: stellarKes, usdcAmount, rate: ratePerKes,
    });
  } catch (err) {
    if (err?.code === 11000) return { skipped: 'already_split' };
    throw err;
  }

  // Atomic conditional debit of exactly the amount just credited.
  const debited = await Merchant.findOneAndUpdate(
    { _id: merchantId, kesBalance: { $gte: stellarKes } },
    { $inc: { kesBalance: -stellarKes } },
    { returnDocument: 'after' }
  );
  if (!debited) {
    await StellarLedgerEntry.updateOne({ _id: entry._id }, {
      $set: { status: 'failed', errorCode: 'INSUFFICIENT_KES', errorMessage: 'Not enough KES balance to settle to Stellar.' },
    });
    return { failed: 'INSUFFICIENT_KES', entryId: entry._id };
  }

  try {
    const txHash = await withTimeout(deps.settle(merchant.stellarPublicKey, usdcAmount));
    const receiptHash = buildReceiptHash({
      entryId: String(entry._id), merchantId: String(merchantId), kind: 'split_settlement',
      kesAmount: stellarKes, usdcAmount, rate: ratePerKes, stellarTxHash: txHash, sourceReference: sourceReference || null,
    });
    await StellarLedgerEntry.updateOne({ _id: entry._id }, { $set: { status: 'completed', stellarTxHash: txHash, receiptHash } });

    try {
      await Transaction.create({
        merchantId, accountNumber: merchant.ncbaMerchantCode, type: 'fx_swap',
        amount: usdcAmount, kesAmount: stellarKes, usdcAmount, currency: 'USDC', status: 'completed',
        reference: txHash,
        sender: { name: 'Auto-settlement', id: 'MASTER_WALLET' },
        recipient: { name: merchant.businessName, id: merchant.stellarPublicKey },
      });
      await Merchant.updateOne({ _id: merchantId }, { $inc: { usdcBalance: usdcAmount } });
    } catch (recordErr) {
      // The chain leg is done and recorded on the ledger entry; only the
      // convenience mirror rows failed. Reconcilable, so log and move on.
      console.error(`⚠️ Split settled on-chain (${txHash}) but mirror rows failed:`, recordErr.message);
    }
    return { completed: true, entryId: entry._id, txHash, kesAmount: stellarKes, usdcAmount };
  } catch (err) {
    const definitive = isDefinitiveFailure(err);
    if (definitive) {
      // Provably nothing moved: give the merchant their KES back.
      await Merchant.updateOne({ _id: merchantId }, { $inc: { kesBalance: stellarKes } });
    }
    await StellarLedgerEntry.updateOne({ _id: entry._id }, {
      $set: {
        status: definitive ? 'failed' : 'unconfirmed',
        errorCode: err.code || (definitive ? 'STELLAR_REJECTED' : 'STELLAR_UNCONFIRMED'),
        errorMessage: definitive
          ? `${err.message} KES was returned to the merchant.`
          : `${err.message} It may still confirm on the network — KES was NOT returned; reconcile against the wallet balance.`,
      },
    });
    console.error(`❌ Settlement split ${definitive ? 'failed' : 'unconfirmed'} for ${merchantId}: ${err.message}`);
    return { [definitive ? 'failed' : 'unconfirmed']: err.code || err.message, entryId: entry._id };
  }
}

/** Fire-and-forget wrapper used at the incoming-payment credit points. */
export function scheduleSettlementSplit(merchant, netAmount, sourceReference) {
  // Cheap pre-check so the vast majority of merchants pay nothing for this.
  if (!merchant?.isDemoMerchant || !merchant?.settlementRule?.enabled) return;
  setImmediate(() => {
    applySettlementSplit({ merchantId: merchant._id, netAmount, sourceReference })
      .catch((err) => console.error(`❌ Settlement split crashed for ${merchant._id}:`, err.message));
  });
}

// ── Request Payout / redemption (Deliverable 2) ─────────────────────────

/**
 * Debits the merchant's Stellar wallet on-chain and records a SIMULATED M-Pesa
 * B2C disbursement to their registered phone, returning a receipt.
 */
export async function redeemToMpesa({ merchantId, usdcAmount }) {
  const amount = round7(Number(usdcAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new SettlementError('Enter a payout amount greater than zero.', 'INVALID_AMOUNT');
  }

  const merchant = await Merchant.findById(merchantId).select('+stellarEncryptedSecretKey');
  assertPilotMerchant(merchant);
  if (!merchant.phone) throw new SettlementError('No registered phone number to pay out to.', 'NO_PHONE');

  // Verify the on-chain balance first.
  let liveUsdc;
  try {
    liveUsdc = await withTimeout(deps.balance(merchant.stellarPublicKey));
  } catch (err) {
    throw new SettlementError(
      err.code === 'RPC_TIMEOUT' ? err.message : 'Could not read the Stellar wallet balance. Please try again.',
      err.code === 'RPC_TIMEOUT' ? 'RPC_TIMEOUT' : 'RPC_ERROR', 503
    );
  }
  if (!(liveUsdc >= amount)) {
    throw new SettlementError(
      `Insufficient USDC in your Stellar wallet (you have ${liveUsdc} USDC, requested ${amount}).`, 'INSUFFICIENT_USDC'
    );
  }

  const ratePerKes = await deps.rate();
  const kesEquivalent = round2(amount / ratePerKes);

  const entry = await StellarLedgerEntry.create({
    merchantId, kind: 'redemption', status: 'pending', kesAmount: kesEquivalent, usdcAmount: amount, rate: ratePerKes,
    destinationPhoneMasked: maskPhone(merchant.phone),
  });

  let txHash;
  try {
    txHash = await withTimeout(deps.sweep(merchant.stellarEncryptedSecretKey, amount));
  } catch (err) {
    const definitive = isDefinitiveFailure(err);
    await StellarLedgerEntry.updateOne({ _id: entry._id }, {
      $set: {
        status: definitive ? 'failed' : 'unconfirmed',
        errorCode: err.code || (definitive ? 'STELLAR_REJECTED' : 'STELLAR_UNCONFIRMED'),
        errorMessage: definitive
          ? err.message
          : `${err.message} The debit may still confirm — check the wallet balance before retrying.`,
      },
    });
    throw new SettlementError(
      definitive ? err.message : 'The Stellar network did not confirm the payout in time. Check your balance before retrying.',
      err.code || (definitive ? 'STELLAR_REJECTED' : 'STELLAR_UNCONFIRMED'),
      definitive ? 400 : 504
    );
  }

  const b2c = buildSimulatedB2C({ phone: merchant.phone, kesAmount: kesEquivalent, reference: String(entry._id) });
  const receiptHash = buildReceiptHash({
    entryId: String(entry._id), merchantId: String(merchantId), kind: 'redemption',
    kesAmount: kesEquivalent, usdcAmount: amount, rate: ratePerKes, stellarTxHash: txHash,
    b2cTransactionId: b2c.response.Result.TransactionID,
  });

  await StellarLedgerEntry.updateOne({ _id: entry._id }, {
    $set: { status: 'completed', stellarTxHash: txHash, receiptHash, simulatedB2C: b2c },
  });

  try {
    await Transaction.create({
      merchantId, accountNumber: merchant.ncbaMerchantCode, type: 'fx_swap',
      amount: kesEquivalent, kesAmount: kesEquivalent, usdcAmount: amount, currency: 'KES', status: 'completed',
      reference: txHash,
      sender: { name: merchant.businessName, id: merchant.stellarPublicKey },
      recipient: { name: 'M-Pesa payout (simulated)', id: maskPhone(merchant.phone) || 'REGISTERED_PHONE' },
    });
    await Merchant.updateOne({ _id: merchantId }, { $set: { usdcBalance: Math.max(0, round7(liveUsdc - amount)) } });
  } catch (recordErr) {
    console.error(`⚠️ Redemption confirmed on-chain (${txHash}) but mirror rows failed:`, recordErr.message);
  }

  return {
    entryId: String(entry._id),
    status: 'completed',
    usdcAmount: amount,
    kesEquivalent,
    rate: ratePerKes,
    stellarTxHash: txHash,
    stellarExpertUrl: explorerTxUrl(txHash),
    receiptHash,
    simulatedB2C: b2c,
    destinationPhoneMasked: maskPhone(merchant.phone),
    remainingUsdc: Math.max(0, round7(liveUsdc - amount)),
  };
}

// ── Reconciliation statement ────────────────────────────────────────────

export async function listLedgerEntries(merchantId, { limit = 500 } = {}) {
  const rows = await StellarLedgerEntry.find({ merchantId }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({ ...r, stellarExpertUrl: explorerTxUrl(r.stellarTxHash) }));
}
