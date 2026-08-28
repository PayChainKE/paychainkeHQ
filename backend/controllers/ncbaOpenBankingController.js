import bcrypt from 'bcryptjs';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';
import {
  submitPesaLinkTransfer,
  submitRtgsTransfer,
  submitInternalNcbaTransfer,
  submitMobileB2wPayment,
  submitLipaNaMpesaPayment,
  NcbaOpenBankingValidationError,
  NcbaOpenBankingRequestError,
} from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber } from '../utils/ncbaValidators.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';

// BeneficiaryBankBIC NCBA confirmed for itself (see kenyanBankCodes.js) — a
// destination account under this code lives at NCBA, so it must go through
// the Internal Funds Transfer rail, not PesaLink. PesaLink is the interbank
// switch; routing an NCBA-to-NCBA transfer through it produces a hard
// decline even on a real, correct account number (observed live: "RC01").
export const NCBA_OWN_BANK_CODE = '07000';
import { createNotification } from './notificationController.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';
import { buildPayoutSentSms, buildPayoutFailedSms, buildPayoutRecipientReceivedSms } from '../utils/paymentSmsTemplates.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { debitAvailableBalance } from '../utils/availableBalance.js';
import { KENYAN_BANK_CODES } from '../config/kenyanBankCodes.js';
import { getB2cTariff } from '../config/mpesaB2cTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { getKplcPostpaidTariff, getKplcPrepaidTariff, getNcwscTariff } from '../config/billPaymentTariffCard.js';
import { getBankTransferTariff } from '../config/bankTransferTariffCard.js';
import { logAudit } from '../utils/auditLog.js';

export class InsufficientFundsError extends Error {
  constructor(merchantId, requested, available) {
    super(`Merchant ${merchantId} has insufficient balance: requested ${requested}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

// Thrown by executeNcbaBankPayout/executeNcbaMobileMoneyPayout/
// executeNcbaLipaNaMpesaPayout when NCBA has already confirmed or accepted
// a transfer but the local Transaction.create() call afterward failed.
// Distinct from every other error these functions throw specifically so
// callers can tell "the transfer itself failed/was rejected, and was
// refunded" apart from "the transfer went through (or was accepted), only
// our own record-keeping failed" — the merchant is NEVER refunded in this
// case (refunding here would pay them back for money that actually left),
// so a caller must not tell the merchant/API consumer this was refunded or
// that it's safe to retry.
export class NcbaPostSubmissionRecordError extends Error {
  constructor(message, { reference } = {}) {
    super(message);
    this.name = 'NcbaPostSubmissionRecordError';
    this.reference = reference;
  }
}

function logEvent(level, event, fields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Validates the destination and submits a bank transfer via either of
 * NCBA's local bank rails. Pure submit-only helper — does NOT touch
 * Merchant balance or create a Transaction record, so it's safe to call
 * from contexts that already manage their own balance reservation
 * (bulkPayController.authorizeBatch's Bank branch reserves the whole
 * batch's total upfront, one level above this per-row call).
 *
 * EFT was removed as a supported rail (2026-08-13) — a real UAT submit
 * test against NCBA's confirmed PesaLink bank code came back
 * BIC_NOT_FOUND, and no working code/format was found for it. Only
 * PesaLink and RTGS are offered.
 *
 * @param {'pesalink'|'rtgs'} [rail='pesalink'] - 'pesalink' settles
 *        immediately, 24/7/365, Kenya/KES only, bounded at KES 999,999;
 *        'rtgs' settles T+3 hours same business day, supports KE/UG/TZ/RW
 *        beneficiaries in seven currencies, and has no maximum amount cap.
 * @param {string} [beneficiaryCountry] - required for rail:'rtgs' (KE/UG/TZ/RW)
 * @param {string} [beneficiaryAddress] - used for rail:'rtgs' only
 * @param {string} [creditCurrency] - used for rail:'rtgs' only, defaults 'KES'
 * @param {string} [debitCurrency] - used for rail:'rtgs' only, defaults 'KES'
 * @param {string} [purposeCode] - used for rail:'rtgs' only; NCBA's Purpose
 *        of Payment code list is "to be shared during onboarding" per the
 *        UAT Guide, so this falls back to their own sample value ('MSC')
 *        when not provided — see submitRtgsTransfer.
 *
 * Neither rail has a pre-flight validation step anymore (see this
 * function's body) — submission is the only correctness check for both now.
 *
 * Per NCBA's UAT Guide, both rails resolve synchronously — if this
 * resolves at all, the transfer succeeded (submitPesaLinkTransfer/
 * submitRtgsTransfer throw on a non-'000' resultCode, unlike M-Pesa's
 * B2C/bulk-pay rails, which only ever report "accepted" here and confirm
 * completion later via a callback).
 *
 * Throws NcbaOpenBankingValidationError on bad input or a failed
 * destination-account validation, or NcbaOpenBankingRequestError on a
 * synchronous rejection from NCBA.
 */
export async function submitNcbaBankTransfer({
  businessName, bankCode, accountNumber, accountName, amount, narration,
  rail = 'pesalink', beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
}) {
  const numericAmount = Number(amount);
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (!['pesalink', 'rtgs'].includes(rail)) {
    throw new NcbaOpenBankingValidationError('rail must be "pesalink" or "rtgs"');
  }
  if (rail === 'rtgs' && !beneficiaryCountry) {
    throw new NcbaOpenBankingValidationError('beneficiaryCountry is required for an RTGS transfer');
  }
  // Merchant balance is held and debited purely in KES (Merchant.kesBalance)
  // — RTGS itself supports settling in USD/GBP/EUR/TZS/UGX/RWF, but nothing
  // in this codebase converts a non-KES CreditAmount back into how much KES
  // to actually deduct from the merchant's wallet. Allowing a non-KES
  // currency through here would silently debit the wrong amount (e.g.
  // deduct "500" KES from the wallet for a transfer that actually sent 500
  // USD). Locked to KES-only until real FX conversion is built for this
  // rail specifically.
  if (rail === 'rtgs' && ((creditCurrency && creditCurrency !== 'KES') || (debitCurrency && debitCurrency !== 'KES'))) {
    throw new NcbaOpenBankingValidationError('Multi-currency RTGS transfers are not yet supported — creditCurrency and debitCurrency must be KES until FX conversion is added.');
  }

  // A destination at NCBA itself must go through the Internal Funds
  // Transfer rail regardless of the requested rail — PesaLink/RTGS are
  // both interbank/cross-border rails and NCBA declines an NCBA-to-NCBA
  // transfer routed through them (see NCBA_OWN_BANK_CODE doc comment
  // above). No PesaLink pre-validation either: IFT resolves synchronously
  // and reports its own rejection, same as PesaLink would.
  const isNcbaOwnAccount = bankCode === NCBA_OWN_BANK_CODE;

  // No pre-flight destination-account validation — NCBA validation
  // endpoints across the platform have been unreliable enough to block
  // real payouts (see Mobile B2W/KPLC history), so this now goes straight
  // to submission for every rail; PesaLink/RTGS both resolve synchronously
  // and report their own rejection if the destination is actually bad.
  const railPrefix = isNcbaOwnAccount ? 'IFT' : { pesalink: 'PL', rtgs: 'RTGS' }[rail];
  const transactionId = `NCBA-${railPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  let hostResponse;
  if (isNcbaOwnAccount) {
    hostResponse = await submitInternalNcbaTransfer({
      transactionId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryAccountName: accountName || 'PayChain Payout',
      amount: numericAmount,
      narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
    });
  } else if (rail === 'rtgs') {
    hostResponse = await submitRtgsTransfer({
      transactionId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryBankBic: bankCode,
      beneficiaryName: accountName || 'PayChain Payout',
      beneficiaryCountry,
      beneficiaryAddress,
      amount: numericAmount,
      creditCurrency,
      debitCurrency,
      narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
      purposeCode,
    });
  } else {
    hostResponse = await submitPesaLinkTransfer({
      transactionId,
      beneficiaryAccountNumber: accountNumber,
      beneficiaryBankCode: bankCode,
      beneficiaryName: accountName || 'PayChain Payout',
      amount: numericAmount,
      narration: narration || `PayChain Payout - ${businessName || 'Merchant'}`,
    });
  }

  return { transactionId, hostResponse, rail: isNcbaOwnAccount ? 'ift' : rail };
}

/**
 * Atomically reserves a merchant's balance and submits a PesaLink transfer
 * in one call — used by handleBankPayout below (single, merchant-initiated
 * withdrawals) where balance hasn't been reserved by anything else yet.
 *
 * Throws NcbaOpenBankingValidationError, InsufficientFundsError, or
 * whatever ncbaOpenBankingService throws on a submission failure (after
 * refunding the reservation).
 */
export async function executeNcbaBankPayout({
  merchantId, bankCode, accountNumber, accountName, amount, narration,
  rail = 'pesalink', beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
}) {
  const numericAmount = Number(amount);

  // Fail fast on a bad destination account before touching balance —
  // submitNcbaBankTransfer would validate again below, but checking here
  // too avoids reserving funds for input that's already known-invalid.
  if (!bankCode || !accountNumber || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('bankCode, accountNumber and a positive amount are required for a bank payout');
  }
  if (!['pesalink', 'rtgs'].includes(rail)) {
    throw new NcbaOpenBankingValidationError('rail must be "pesalink" or "rtgs"');
  }
  if (rail === 'rtgs' && !beneficiaryCountry) {
    throw new NcbaOpenBankingValidationError('beneficiaryCountry is required for an RTGS transfer');
  }

  // Interbank Transfer Tariff (config/bankTransferTariffCard.js) — known
  // upfront from the requested `rail`, except when the destination is
  // NCBA's own bank code, which submitNcbaBankTransfer always forces onto
  // the (unpriced) IFT rail regardless of what was requested — checked
  // here too so the debit doesn't reserve a PesaLink/RTGS fee for a
  // transfer that's actually going out fee-free via IFT.
  const isNcbaOwnAccount = bankCode === NCBA_OWN_BANK_CODE;
  const { totalFee: transferFee } = isNcbaOwnAccount
    ? { totalFee: 0 }
    : getBankTransferTariff(rail, numericAmount);
  const totalDebit = Math.round((numericAmount + transferFee) * 100) / 100;

  // Atomically reserve funds — the $gte guard means this either fully
  // succeeds (balance was sufficient) or matches zero documents (it
  // wasn't), so no read-then-write gap for a concurrent request to race
  // through. Mirrors services/ncbaBulkPaymentService.js's reservation
  // pattern. Reserves totalDebit (principal + fee), not just the
  // principal, so the merchant needs enough balance to cover the fee too.
  // debitAvailableBalance also holds back money credited in the last 2
  // minutes (see utils/availableBalance.js) so a bad/duplicate credit
  // can't be withdrawn before it's had a chance to be caught.
  const reservedMerchant = await debitAvailableBalance(merchantId, totalDebit);

  if (!reservedMerchant) {
    const merchant = await Merchant.findById(merchantId);
    throw new InsufficientFundsError(merchantId, totalDebit, merchant?.kesBalance ?? 0);
  }

  let transactionId, hostResponse, actualRail;
  try {
    ({ transactionId, hostResponse, rail: actualRail } = await submitNcbaBankTransfer({
      businessName: reservedMerchant.businessName, bankCode, accountNumber, accountName, amount: numericAmount, narration, rail,
      beneficiaryCountry, beneficiaryAddress, creditCurrency, debitCurrency, purposeCode,
    }));
  } catch (err) {
    // Submission never reached (or was rejected outright by) NCBA — refund
    // the full reservation (principal + fee) since nothing was disbursed.
    await Merchant.findByIdAndUpdate(merchantId, { $inc: { kesBalance: totalDebit } });
    throw err;
  }

  // NCBA has confirmed this transfer (PesaLink/RTGS resolve synchronously)
  // — from here on, a failure must never trigger a refund of the reservation
  // above, since the money has genuinely already left.
  let transaction;
  try {
    transaction = await Transaction.create({
      merchantId,
      accountNumber: reservedMerchant.ncbaMerchantCode || 'WALLET_FUND',
      // Fee-mapped to the ncba_disbursement_fee revenue stream (see
      // config/revenueRateCard.js), priced per-rail off settlementRail below
      // — see utils/feeCalculator.js.
      type: 'ncba_outbound',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      status: 'completed',
      reference: transactionId,
      sender: { name: reservedMerchant.businessName, id: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER || 'PAYCHAIN_NCBA_ACCOUNT' },
      recipient: { name: accountName || 'Bank Account', id: accountNumber },
      settlementRail: actualRail,
    });
  } catch (recordErr) {
    logEvent('error', 'ncba_bank_payout_confirmed_but_recording_failed', {
      merchantId: String(merchantId), transactionId, amount: numericAmount, error: recordErr.message,
    });
    throw new NcbaPostSubmissionRecordError(
      'This bank transfer was confirmed by NCBA but recording it locally failed — the merchant was NOT refunded.',
      { reference: transactionId }
    );
  }

  return { transaction, hostResponse, merchant: reservedMerchant, fee: transferFee };
}

/**
 * Single-recipient payout to an M-Pesa wallet via NCBA's
 * MobileMoneyTransfer rail (see submitMobileB2wPayment's own doc comment
 * for the endpoint/payload history). Same reservation/refund-on-failure
 * shape as executeNcbaBankPayout above, extracted alongside it so the
 * Developer API payout endpoint can reuse the exact NCBA calls
 * bulkPayController.js's Personal Number branch already makes in
 * production, rather than a second implementation of the same integration
 * drifting out of sync with it.
 *
 * beneficiaryName is required by NCBA's payload but the Developer API has
 * no per-payee identity field for mobile money destinations (only bank
 * payouts collect accountName) — falls back to a generic label rather than
 * rejecting the request outright.
 *
 * Unlike a bank payout, this rail is asynchronous — NCBA confirms receipt,
 * not completion. The returned transaction is 'pending' and resolves later
 * via resolvePendingOpenBankingTransaction below (the same webhook/sweep
 * that already resolves every other async NCBA rail).
 *
 * Throws NcbaOpenBankingValidationError, InsufficientFundsError, or
 * whatever ncbaOpenBankingService throws on a submission failure (after
 * refunding the reservation).
 */
export async function executeNcbaMobileMoneyPayout({ merchantId, phone, network, beneficiaryName, amount, narration }) {
  const numericAmount = Number(amount);
  if (!phone || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('phone and a positive amount are required for a mobile money payout');
  }
  const resolvedNetwork = network === 'airtel' ? 'airtel' : 'safaricom';

  const { totalFee } = getB2cTariff(numericAmount);
  const totalDebit = Math.round((numericAmount + totalFee) * 100) / 100;

  // debitAvailableBalance also holds back money credited in the last 2
  // minutes (see utils/availableBalance.js) so a bad/duplicate credit
  // can't be withdrawn before it's had a chance to be caught.
  const reservedMerchant = await debitAvailableBalance(merchantId, totalDebit);
  if (!reservedMerchant) {
    const merchant = await Merchant.findById(merchantId);
    throw new InsufficientFundsError(merchantId, totalDebit, merchant?.kesBalance ?? 0);
  }

  const transactionId = `PAYOUT-API-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let ncbaConfirmed = true;
  try {
    await submitMobileB2wPayment({
      transactionId, beneficiaryName: beneficiaryName || 'PayChain Merchant', amount: numericAmount,
      recipientNumber: phone, narration: narration || 'Developer API payout',
    });
  } catch (err) {
    // NcbaOpenBankingRequestError means NCBA actually received and
    // processed the request — same reasoning as initiateB2C
    // (mpesaController.js): refunding here on top of a transfer that may
    // have already completed would double-cost PayChain with no record of
    // what happened, so this is recorded 'pending' instead of refunded,
    // not treated as a definite failure.
    if (!(err instanceof NcbaOpenBankingRequestError)) {
      await Merchant.findByIdAndUpdate(merchantId, { $inc: { kesBalance: totalDebit } });
      throw err;
    }
    ncbaConfirmed = false;
  }

  // status is 'completed' (not the historically-assumed 'pending') once
  // submitMobileB2wPayment's own broadened success check actually confirms
  // the transfer — NCBA's documented "resolves later via callback" has
  // never been observed arriving for this rail in practice, so a real
  // success left 'pending' would eventually get auto-marked 'failed' and
  // refunded by the reconciliation sweep purely for lack of a callback
  // that was never coming.
  // NCBA has, at minimum, received this request (the submit try/catch above
  // only reaches here on success or a request it can't confidently read as
  // a definite rejection) — a failure below must never refund the
  // reservation, since the transfer may have already landed.
  let transaction;
  try {
    transaction = await Transaction.create({
      merchantId,
      accountNumber: reservedMerchant.ncbaMerchantCode || 'WALLET_FUND',
      type: 'ncba_mobile_b2w',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      status: ncbaConfirmed ? 'completed' : 'pending',
      reference: transactionId,
      sender: { name: reservedMerchant.businessName, id: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER || 'PAYCHAIN_NCBA_ACCOUNT' },
      recipient: { name: null, id: phone },
      mobileNetwork: resolvedNetwork,
    });
  } catch (recordErr) {
    logEvent('error', 'ncba_mobile_money_payout_confirmed_but_recording_failed', {
      merchantId: String(merchantId), transactionId, amount: numericAmount, ncbaConfirmed, error: recordErr.message,
    });
    throw new NcbaPostSubmissionRecordError(
      'This mobile money payout was submitted to NCBA but recording it locally failed — the merchant was NOT refunded.',
      { reference: transactionId }
    );
  }

  return { transaction, merchant: reservedMerchant, fee: totalFee };
}

/**
 * Single-recipient payout to a Paybill or Buy Goods (Till) number via NCBA's
 * Lipa na M-Pesa Payment API. Same shape as executeNcbaMobileMoneyPayout
 * above — reuses bulkPayController.js's existing Paybill/Till branch calls,
 * async (resolves via resolvePendingOpenBankingTransaction), reservation +
 * refund-on-failure.
 *
 * paymentType is taken as given from the caller — no pre-flight
 * Till/Paybill resolution against NCBA's own registries anymore (that
 * validation call is one of the ones blocking payouts platform-wide).
 */
export async function executeNcbaLipaNaMpesaPayout({ merchantId, paymentType, payBillTillNo, accountReference, amount, narration }) {
  const numericAmount = Number(amount);
  if (!payBillTillNo || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new NcbaOpenBankingValidationError('payBillTillNo and a positive amount are required for a paybill/till payout');
  }

  const { totalFee } = getLipaNaMpesaTariff(numericAmount);
  const totalDebit = Math.round((numericAmount + totalFee) * 100) / 100;

  // debitAvailableBalance also holds back money credited in the last 2
  // minutes (see utils/availableBalance.js) so a bad/duplicate credit
  // can't be withdrawn before it's had a chance to be caught.
  const reservedMerchant = await debitAvailableBalance(merchantId, totalDebit);
  if (!reservedMerchant) {
    const merchant = await Merchant.findById(merchantId);
    throw new InsufficientFundsError(merchantId, totalDebit, merchant?.kesBalance ?? 0);
  }

  // No hyphens — NCBA's Lipa na M-Pesa endpoint rejects reqChnlId/
  // reqTransactionReferenceNo values containing special characters (per
  // Rose, NCBA support, 2026-08-27).
  const transactionId = `PAYOUTAPI${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const resolvedPaymentType = paymentType === 'paybill' ? 'Paybill' : 'Till';
  // NCBA's Lipa na M-Pesa endpoint needs reqMobileNumber in 254XXXXXXXXX
  // form, not the stored 07XXXXXXXX (per Rose, NCBA support) — same
  // normalization applied at every other submitLipaNaMpesaPayment call site.
  let notifyMobileNumber = reservedMerchant.phone;
  try { notifyMobileNumber = validatePhoneNumber(reservedMerchant.phone); } catch { /* left as raw */ }
  try {
    await submitLipaNaMpesaPayment({
      transactionId, paymentType: resolvedPaymentType, payBillTillNo, amount: numericAmount,
      accountReference: resolvedPaymentType === 'Paybill' ? accountReference : undefined,
      recipientName: null,
      notifyMobileNumber,
      narration: narration || 'Developer API payout',
    });
  } catch (err) {
    // NcbaOpenBankingRequestError means NCBA actually received the
    // request — same reasoning as executeNcbaMobileMoneyPayout above:
    // refunding on top of a transfer NCBA may have already processed would
    // double-cost PayChain with no record of what happened, so this is left
    // 'pending' (unrefunded) instead, same as every other caller of
    // submitLipaNaMpesaPayment. Anything else (validation/config/auth) never
    // reached NCBA, so refunding it is safe.
    if (!(err instanceof NcbaOpenBankingRequestError)) {
      await Merchant.findByIdAndUpdate(merchantId, { $inc: { kesBalance: totalDebit } });
      throw err;
    }
  }

  // NCBA has, at minimum, received this request — a failure below must
  // never refund the reservation, for the same reason as the two executors
  // above.
  let transaction;
  try {
    transaction = await Transaction.create({
      merchantId,
      accountNumber: reservedMerchant.ncbaMerchantCode || 'WALLET_FUND',
      type: 'ncba_lipa_na_mpesa',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      // 'pending' — Lipa na M-Pesa confirms asynchronously, see doc comment above.
      status: 'pending',
      reference: transactionId,
      sender: { name: reservedMerchant.businessName, id: process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER || 'PAYCHAIN_NCBA_ACCOUNT' },
      recipient: { name: null, id: payBillTillNo },
    });
  } catch (recordErr) {
    logEvent('error', 'ncba_lnm_payout_confirmed_but_recording_failed', {
      merchantId: String(merchantId), transactionId, amount: numericAmount, error: recordErr.message,
    });
    throw new NcbaPostSubmissionRecordError(
      'This Paybill/Till payout was submitted to NCBA but recording it locally failed — the merchant was NOT refunded.',
      { reference: transactionId }
    );
  }

  return { transaction, merchant: reservedMerchant, fee: totalFee, resolvedType: resolvedPaymentType };
}

// @desc    List NCBA-recognized bank clearing codes, for the merchant
//          dashboard's bank-destination picker.
// @route   GET /openbanking/bank-codes (mounted at /api/v1 and /v1)
// @access  Private (merchant)
export const getBankCodes = (req, res) => {
  res.json({ bankCodes: KENYAN_BANK_CODES });
};

// @desc    Merchant-initiated single withdrawal to a bank account via NCBA
//          PesaLink (immediate) or RTGS (cross-border/multi-currency,
//          KES-only for now — see submitNcbaBankTransfer's doc comment)
// @route   POST /openbanking/bank-payout (mounted at /api/v1 and /v1)
// @access  Private (merchant)
export const handleBankPayout = async (req, res) => {
  const merchantId = req.merchant._id;
  const {
    bankCode, accountNumber, accountName, amount, narration, pin, rail: requestedRail,
    beneficiaryCountry, beneficiaryAddress, purposeCode,
  } = req.body;
  const rail = requestedRail === 'rtgs' ? 'rtgs' : 'pesalink';

  try {
    if (!pin || String(pin).length !== 4) {
      return res.status(400).json({ error: 'A valid 4-digit payment PIN is required.' });
    }
    if (requestedRail && !['pesalink', 'rtgs'].includes(requestedRail)) {
      return res.status(400).json({ error: 'rail must be "pesalink" or "rtgs".' });
    }
    if (rail === 'rtgs' && !beneficiaryCountry) {
      return res.status(400).json({ error: 'beneficiaryCountry is required for an RTGS transfer.' });
    }

    // PIN checked inline, within this same request that executes the
    // transfer — deliberately not the decoupled verify-payment-pin
    // pre-flight pattern the frontend uses elsewhere, which nothing
    // server-side actually enforces.
    const merchant = await Merchant.findById(merchantId).select('+appPin');
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    if (!merchant.appPin) {
      return res.status(400).json({ error: 'Please set up your payment PIN first.', pinNotSet: true });
    }

    try {
      await assertPinNotLocked(merchantId);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }

    const pinMatches = await bcrypt.compare(String(pin), merchant.appPin);
    if (!pinMatches) {
      await recordFailedPinAttempt(merchantId);
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }
    await resetPinAttempts(merchantId);

    // Correct PIN alone doesn't stop a double-click or a client retrying a
    // slow/timed-out request from submitting the exact same real transfer
    // twice — this rejects an identical (merchant, rail, destination,
    // amount) submission landing within a short window of the last one.
    try {
      await claimPayoutSubmission(merchantId, ['bank-payout', rail, bankCode, accountNumber, amount]);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }

    const { transaction, hostResponse, merchant: updatedMerchant, fee } = await executeNcbaBankPayout({
      merchantId, bankCode, accountNumber, accountName, amount, narration, rail,
      beneficiaryCountry, beneficiaryAddress, purposeCode,
    });

    // transaction.settlementRail is the rail actually used — may differ
    // from the requested `rail` when the destination was an NCBA account
    // and got routed to IFT instead (see submitNcbaBankTransfer).
    const usedRail = transaction.settlementRail || rail;

    const RAIL_NOTIFICATION_MESSAGE = {
      rtgs: `KES ${Number(amount).toLocaleString()} was sent to your bank account via RTGS. It settles within a few hours.`,
      pesalink: `KES ${Number(amount).toLocaleString()} was sent to your bank account via PesaLink.`,
      ift: `KES ${Number(amount).toLocaleString()} was sent to your NCBA bank account.`,
    };
    createNotification({
      merchantId,
      kind: 'payment',
      title: 'Bank payout completed',
      message: RAIL_NOTIFICATION_MESSAGE[usedRail],
    }).catch((e) => logEvent('error', 'ncba_openbanking_payout_notification_failed', { transactionId: transaction.reference, error: e.message }));

    if (updatedMerchant.phone) {
      const { date, time } = formatTransactionDateTime();
      const RAIL_SMS_LABEL = { rtgs: 'Bank Payout (RTGS)', pesalink: 'Bank Payout', ift: 'Bank Payout' };
      const { message } = buildPayoutSentSms({
        ref: transaction.reference,
        label: RAIL_SMS_LABEL[usedRail],
        amount: Number(amount),
        recipientName: accountName || 'your bank account',
        date,
        time,
        balance: updatedMerchant.kesBalance,
      });
      safeSendSMS({
        to: updatedMerchant.phone,
        message,
      }).then((result) => {
        if (!result.success) logEvent('error', 'ncba_openbanking_payout_sms_failed', { transactionId: transaction.reference, error: result.error });
      });
    }

    const RAIL_RESPONSE_MESSAGE = {
      rtgs: 'Bank transfer submitted via RTGS. It settles within a few hours.',
      pesalink: 'Bank transfer completed via PesaLink.',
      ift: 'Bank transfer completed to your NCBA account.',
    };
    res.status(200).json({
      success: true,
      message: RAIL_RESPONSE_MESSAGE[usedRail],
      transaction,
      newBalance: updatedMerchant.kesBalance,
      fee,
      hostResponse,
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer, including the PayChain service fee.' });
    }
    if (err instanceof NcbaOpenBankingValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NcbaPostSubmissionRecordError) {
      // The transfer itself was confirmed by NCBA — the merchant was NOT
      // refunded, and must not be told it was. Distinct from the generic
      // branch below, whose "failed and was refunded" SMS would be false
      // here.
      logEvent('error', 'ncba_openbanking_payout_post_submission_record_error', {
        merchantId: merchantId.toString(), reference: err.reference, error: err.message,
      });
      return res.status(202).json({
        success: true,
        pending: true,
        message: 'Your bank transfer was sent, but we hit an error recording it. Please check your transaction history shortly — do not resubmit this payout.',
        reference: err.reference,
      });
    }
    logEvent('error', 'ncba_openbanking_payout_error', { merchantId: merchantId.toString(), error: err.message, stack: err.stack });

    // Reaching here (as opposed to the two branches above) means
    // executeNcbaBankPayout got past its own pre-flight checks and actually
    // reserved + refunded the merchant's balance before rethrowing — unlike
    // B2C/B2W's ambiguous case, PesaLink/RTGS are genuinely synchronous
    // (resultCode IS the final result, not just an accepted acknowledgement
    // — see submitPesaLinkTransfer's own doc comment), so a rejection here
    // is a real, confirmed failure and the refund that already happened is
    // correct and final. The merchant just had no way to know any of that
    // happened — handleBankPayout's success path already sends a "Bank
    // Payout Sent" SMS, but nothing told them when it failed instead.
    Merchant.findById(merchantId).select('phone kesBalance').then((merchant) => {
      if (!merchant?.phone) return;
      const RAIL_SMS_LABEL = { rtgs: 'Bank Payout (RTGS)', pesalink: 'Bank Payout', ift: 'Bank Payout' };
      const { message } = buildPayoutFailedSms({
        ref: `BANK-${Date.now()}`,
        label: RAIL_SMS_LABEL[rail] || 'Bank Payout',
        amount: Number(amount),
        recipientName: accountName || 'your bank account',
        balance: merchant.kesBalance,
      });
      safeSendSMS({ to: merchant.phone, message }).then((r) => {
        if (!r.success) logEvent('error', 'ncba_openbanking_payout_failed_sms_failed', { merchantId: merchantId.toString(), error: r.error });
      });
      createNotification({
        merchantId,
        kind: 'payment',
        title: 'Bank payout failed',
        message: `KES ${Number(amount).toLocaleString()} bank payout to ${accountName || 'your destination account'} failed and was refunded to your balance.`,
      }).catch((e) => logEvent('error', 'ncba_openbanking_payout_failed_notification_failed', { merchantId: merchantId.toString(), error: e.message }));
    }).catch((e) => logEvent('error', 'ncba_openbanking_payout_failed_merchant_lookup_failed', { merchantId: merchantId.toString(), error: e.message }));

    res.status(502).json({ error: 'Failed to process bank payout. Please try again.' });
  }
};

// @desc    NCBA Open Banking per-transaction result callback — distinct
//          from the account-level SOAP notification webhook
//          (ncbaAccountNotificationController.js).
//
//          This IS the settlement path for bulk payouts: services/
//          ncbaBulkPaymentService.js's BILLPAY/utility rows are created
//          'pending' and only ever resolved here (PesaLink/RTGS single
//          payouts resolve synchronously in handleBankPayout above and
//          never reach this handler in 'pending' state). Route-level auth
//          (verifyNcbaBasicAuth in ncbaRoutes.js) is what stops anyone who
//          can read/guess a payment reference from POSTing a fake
//          FAILED status here to trigger a refund of a real payout.
// @route   POST /webhooks/ncba-openbanking-callback (mounted at /api/v1 and /v1)
// @access  NCBA host-to-host only (HTTP Basic Auth via verifyNcbaBasicAuth)
export const handlePesaLinkCallback = async (req, res) => {
  // Ack immediately — same "banks retry on non-200/slow response"
  // convention as the account-notification webhook.
  res.status(200).json({ resultCode: '0', resultDescription: 'Accepted' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawReference = body.TransactionID || body.transactionId || body.reference;
  // Reject anything that isn't a plain string before it ever reaches a Mongo
  // query filter below — a body-derived object here (e.g. an
  // {"$ne": null}-shaped value) would otherwise be interpreted as a query
  // operator instead of an equality match, matching an arbitrary pending
  // transaction rather than the one this callback is actually about. Route
  // auth (verifyNcbaBasicAuth) is the primary control here, but this is
  // cheap defense-in-depth against a leaked/misused credential.
  if (typeof rawReference !== 'string' || !rawReference) {
    logEvent('warn', 'ncba_openbanking_callback_missing_reference', { body });
    return;
  }
  const reference = rawReference;
  const succeeded = ['SUCCESS', 'COMPLETED', '0'].includes(String(body.Status || body.status || '').toUpperCase());
  await resolvePendingOpenBankingTransaction({ reference, succeeded });
};

// Shared resolver behind handlePesaLinkCallback above — also called by
// services/ncbaOpenBankingReconciliationService.js's timeout sweep for
// async rails (Mobile B2W, Lipa na M-Pesa, KPLC/NCWSC) whose callback never
// arrives. NCBA's own doc claims these settle "via a later callback" to
// this same webhook, but that's unconfirmed in practice — nothing has ever
// been observed calling back for a real Mobile B2W payout, leaving the
// Transaction stuck 'pending' forever with the merchant's balance already
// debited. The reconciliation sweep drives this same code path with
// succeeded:false after a timeout, so a payout that never confirms is
// refunded instead of silently lost — identical outcome to a real FAILED
// callback, just triggered by absence of one rather than by one arriving.
export async function resolvePendingOpenBankingTransaction({ reference, succeeded }) {
  try {
    // Atomic claim on the pending->resolved transition — a plain
    // `if (transaction.status === 'pending')` read followed by a separate
    // `.save()` is a TOCTOU race: two redeliveries of the same callback
    // (NCBA retries, like every other bank webhook) could both read
    // 'pending' before either write, double-refunding a failed payout. The
    // status:'pending' filter here is what makes only one caller ever win.
    const transaction = await Transaction.findOneAndUpdate(
      { reference, status: 'pending' },
      { $set: { status: succeeded ? 'completed' : 'failed' } },
      { returnDocument: 'after' }
    );
    if (!transaction) {
      logEvent('info', 'ncba_openbanking_callback_no_pending_match', { reference });
      return;
    }

    let merchantForSms = null;
    if (!succeeded) {
      // The payout never landed — return the funds to the merchant's balance.
      // For every fee-charging rail on this webhook, PayChain's own fee was
      // ALSO deducted alongside the payout/bill amount at initiation
      // (mpesaController.js's initiateB2C/initiateB2B, or
      // bulkPayController.js's batch debit for the Bulk Pay rows) —
      // refunding only transaction.amount here would permanently cost the
      // merchant that fee even though the transfer/bill payment never went
      // through.
      let refundAmount = transaction.amount;
      if (transaction.type === 'ncba_mobile_b2w') {
        const { totalFee } = getB2cTariff(transaction.amount);
        refundAmount += totalFee;
      } else if (transaction.type === 'ncba_lipa_na_mpesa') {
        const { totalFee } = getLipaNaMpesaTariff(transaction.amount);
        refundAmount += totalFee;
      } else if (transaction.type === 'ncba_kplc') {
        const { totalFee } = getKplcPostpaidTariff();
        refundAmount += totalFee;
      } else if (transaction.type === 'ncba_kplc_prepaid') {
        const { totalFee } = getKplcPrepaidTariff(transaction.amount);
        refundAmount += totalFee;
      } else if (transaction.type === 'ncba_ncwsc') {
        const { totalFee } = getNcwscTariff();
        refundAmount += totalFee;
      }
      merchantForSms = await Merchant.findByIdAndUpdate(
        transaction.merchantId,
        { $inc: { kesBalance: refundAmount } },
        { returnDocument: 'after' }
      );
    } else {
      merchantForSms = await Merchant.findById(transaction.merchantId).select('phone');
    }

    // This webhook now resolves bank-account payouts (PesaLink/RTGS), Mobile
    // B2W (M-Pesa/Airtel number) payouts, Lipa na M-Pesa (Paybill/Till)
    // payouts, KPLC bill payments, and NCWSC (Nairobi Water) bill payments
    // — "Bank payout" wording would be wrong for all but the first. Note
    // bulk-pay's Bank-routed rows (PesaLink synchronous branch in
    // bulkPayController.js) never reach this webhook in 'pending' state, so
    // in practice every 'ncba_outbound' row that does land here is a real
    // bank payout, not a mislabeled one.
    //
    // ncba_mobile_b2w/ncba_lipa_na_mpesa used to fall through to the generic
    // 'Payout' default below — every failure notification/SMS for a B2C
    // withdrawal or a B2B Till/Paybill payment read "Payout Failed" instead
    // of naming the actual rail, inconsistent with initiateB2C's own
    // success-path SMS (mpesaController.js), which already says
    // "Withdrawal Sent". Lipa na M-Pesa doesn't persist Paybill vs Till on
    // the Transaction itself, so "Till/Paybill Payment" is the most specific
    // label available without adding a new field just for wording.
    const NON_BANK_TYPE_LABELS = {
      ncba_kplc: 'KPLC bill payment',
      ncba_kplc_prepaid: 'KPLC prepaid token purchase',
      ncba_ncwsc: 'NCWSC bill payment',
      ncba_mobile_b2w: 'Withdrawal',
      ncba_lipa_na_mpesa: 'Till/Paybill Payment',
    };
    const isBankPayout = !Object.keys(NON_BANK_TYPE_LABELS).includes(transaction.type);
    const payoutLabel = isBankPayout ? 'Bank payout' : (NON_BANK_TYPE_LABELS[transaction.type] || 'Payout');

    createNotification({
      merchantId: transaction.merchantId,
      kind: 'payment',
      title: succeeded ? `${payoutLabel} completed` : `${payoutLabel} failed`,
      message: succeeded
        ? `KES ${transaction.amount.toLocaleString()} was successfully sent to ${transaction.recipient?.name || 'the recipient'}.`
        : `KES ${transaction.amount.toLocaleString()} ${payoutLabel.toLowerCase()} to ${transaction.recipient?.name || 'the recipient'} failed and was refunded to your balance.`,
    }).catch((e) => logEvent('error', 'ncba_openbanking_callback_notification_failed', { reference, error: e.message }));

    // Shared by both the merchant-facing and recipient-facing SMS blocks
    // below, so the two always quote the same date/time for one resolution.
    const { date, time } = formatTransactionDateTime();

    if (merchantForSms?.phone) {
      const recipientName = transaction.recipient?.name || 'the recipient';
      const { message } = succeeded
        ? buildPayoutSentSms({ ref: reference, label: payoutLabel, amount: transaction.amount, recipientName, date, time })
        : buildPayoutFailedSms({ ref: reference, label: payoutLabel, amount: transaction.amount, recipientName, date, time, balance: merchantForSms.kesBalance || 0 });
      safeSendSMS({ to: merchantForSms.phone, message }).then((r) => {
        if (!r.success) logEvent('error', 'ncba_openbanking_callback_sms_failed', { reference, error: r.error });
      });
    }

    // Recipient-facing "you've been paid" SMS — Mobile Money (M-PESA/Airtel
    // Money) payouts only, since those are the only rail here where
    // transaction.recipient.id is actually the recipient's own phone number
    // (mobileNetwork is only ever set for this rail — see initiateB2C and
    // bulkPayController.js's Personal Number branch). Bank/Till/Paybill
    // payouts don't collect a recipient phone number today, so there's
    // nothing to notify.
    if (succeeded && transaction.mobileNetwork && transaction.recipient?.id) {
      const { message: recipientMessage } = buildPayoutRecipientReceivedSms({
        ref: reference,
        amount: transaction.amount,
        businessName: transaction.sender?.name,
        date,
        time,
      });
      safeSendSMS({ to: transaction.recipient.id, message: recipientMessage }).then((r) => {
        if (!r.success) logEvent('error', 'ncba_openbanking_callback_recipient_sms_failed', { reference, error: r.error });
      });
    }

    // Update the matching row inside a bulk-pay batch, if this reference belongs to one.
    // Atomic per-row claim (positional $ filtered on the row's own
    // 'pending' status) plus a compare-and-swap on the aggregate status —
    // same reasoning as the Transaction update above.
    const batch = await PayoutBatch.findOneAndUpdate(
      { 'transactions.receiptNumber': reference, 'transactions.status': 'pending' },
      { $set: { 'transactions.$.status': succeeded ? 'completed' : 'failed' } },
      { returnDocument: 'after' }
    );
    if (batch) {
      const previousBatchStatus = batch.status;
      const statuses = batch.transactions.map((t) => t.status);
      let newBatchStatus = previousBatchStatus;
      if (statuses.every((s) => s === 'completed')) newBatchStatus = 'Processed';
      else if (statuses.some((s) => s === 'pending')) newBatchStatus = 'Pending';
      else if (statuses.some((s) => s === 'failed')) newBatchStatus = 'Partial';
      if (newBatchStatus !== previousBatchStatus) {
        await PayoutBatch.updateOne({ _id: batch._id, status: previousBatchStatus }, { $set: { status: newBatchStatus } });
      }

      // Every row just settled (batch left 'Pending' for the first time) —
      // send the one summary SMS for the whole batch here, not one per row.
      const justResolved = previousBatchStatus === 'Pending' && newBatchStatus !== 'Pending';
      if (justResolved) {
        const batchMerchant = await Merchant.findById(batch.merchantId).select('phone');
        if (batchMerchant?.phone) {
          const succeededCount = statuses.filter((s) => s === 'completed').length;
          const failedCount = statuses.filter((s) => s === 'failed').length;
          const { date: batchDate, time: batchTime } = formatTransactionDateTime();
          const batchMessage = `${batch.batchReference} Bulk Payout ${newBatchStatus} on ${batchDate} at ${batchTime}. ${succeededCount} of ${batch.transactions.length} payout(s) completed (Ksh ${formatKes(batch.totalNetAmount)} total)${failedCount > 0 ? `; ${failedCount} failed and refunded` : ''}.`;
          safeSendSMS({ to: batchMerchant.phone, message: batchMessage }).then((r) => {
            if (!r.success) logEvent('error', 'ncba_openbanking_batch_sms_failed', { batchId: batch._id.toString(), error: r.error });
          });
        }
      }
    }

    // Developer API fan-out: if this transaction was initiated via POST
    // /api/v1/developer/payments/payout for a mobile money/paybill/till
    // destination (matched by linkedPayoutReference), sync its status and
    // fire the matching payment.payout.* webhook — same generic pattern
    // resolveStkOutcome (mpesaController.js) uses for collects, matched by
    // linkedStkCheckoutId instead. No-ops for every transaction that isn't
    // Developer-API-linked (the far more common case: dashboard payouts,
    // bulk pay, bill payments).
    const developerPayment = await DeveloperPayment.findOneAndUpdate(
      { linkedPayoutReference: reference, status: 'pending' },
      {
        $set: {
          status: succeeded ? 'success' : 'failed',
          ...(succeeded ? {} : { failureReason: 'Payout failed.' }),
        },
      },
      { returnDocument: 'after' }
    );
    if (developerPayment) {
      dispatchDeveloperEvent(
        developerPayment.developerId,
        `payment.payout.${succeeded ? 'succeeded' : 'failed'}`,
        { payment: publicDeveloperPayment(developerPayment) }
      );
    }

    logEvent('info', 'ncba_openbanking_callback_processed', { reference, succeeded });
  } catch (err) {
    logEvent('error', 'ncba_openbanking_callback_error', { reference, error: err.message, stack: err.stack });
  }
};

// @desc    List NCBA async-rail payouts stuck 'pending' past
//          ncbaOpenBankingReconciliationService.js's timeout window,
//          flagged pendingReason:'stuck_timeout_needs_manual_review'
//          instead of being auto-refunded (NCBA's TransactionStatusQuery
//          endpoint is confirmed broken, so the sweep can no longer trust a
//          bare timeout as proof a payout failed — see that service's own
//          doc comment). This is the admin-facing counterpart: without it,
//          flagged payouts had no in-app resolution path at all.
// @route   GET /admin/ncba-payouts/stuck-review
// @access  Private (admin, excludeOfficer)
export const adminListStuckOpenBankingPayouts = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      status: 'pending',
      pendingReason: 'stuck_timeout_needs_manual_review',
    })
      .sort('-createdAt')
      .limit(200)
      .populate('merchantId', 'businessName phone ncbaMerchantCode');
    res.json({ transactions });
  } catch (err) {
    logEvent('error', 'admin_list_stuck_openbanking_payouts_error', { error: err.message });
    res.status(500).json({ error: 'Failed to list stuck payouts' });
  }
};

// @desc    Manually resolve one flagged stuck payout, after an admin has
//          checked NCBA's portal directly to see whether it actually
//          landed. Routes through the exact same resolution path a real
//          NCBA webhook uses (resolvePendingOpenBankingTransaction) — same
//          atomic {status:'pending'} claim, same refund-on-failure/
//          notify-on-success behaviour — so this can never double-resolve
//          a transaction a late-arriving real callback already settled.
// @route   POST /admin/ncba-payouts/:reference/resolve
// @access  Private (admin, requireMutator + sensitiveActionLimiter — this
//          can trigger a real refund)
export const adminResolveStuckOpenBankingPayout = async (req, res) => {
  const { reference } = req.params;
  const { succeeded } = req.body;
  if (typeof succeeded !== 'boolean') {
    return res.status(400).json({ error: 'succeeded (boolean) is required.' });
  }
  try {
    const before = await Transaction.findOne({ reference }).select('status pendingReason');
    if (!before) {
      return res.status(404).json({ error: 'No transaction found with this reference.' });
    }
    if (before.status !== 'pending') {
      return res.status(409).json({ error: `This transaction is already '${before.status}' — nothing to resolve.` });
    }

    await resolvePendingOpenBankingTransaction({ reference, succeeded });

    const after = await Transaction.findOne({ reference }).select('status');
    logAudit({
      action: 'admin.ncba_payout.manual_resolve', category: 'wallet', severity: 'critical',
      message: `Admin manually resolved stuck payout ${reference} as ${succeeded ? 'succeeded' : 'failed'}`,
      req, actor: { type: 'admin', id: req.admin._id, email: req.admin.email, name: req.admin.name },
      metadata: { reference, succeeded, resultingStatus: after?.status },
    });
    res.json({ success: true, reference, status: after?.status });
  } catch (err) {
    logEvent('error', 'admin_resolve_stuck_openbanking_payout_error', { reference, error: err.message });
    res.status(500).json({ error: 'Failed to resolve this payout' });
  }
};
