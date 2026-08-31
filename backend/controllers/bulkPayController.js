import Payee from '../models/Payee.js';
import PayoutBatch from '../models/PayoutBatch.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { submitNcbaBankTransfer, NCBA_OWN_BANK_CODE } from './ncbaOpenBankingController.js';
import { getBankTransferTariff } from '../config/bankTransferTariffCard.js';
import { submitNcbaUtilityPayment } from '../services/ncbaBulkPaymentService.js';
import bcrypt from 'bcryptjs';
import { sendBatchReceiptEmail } from '../utils/resend.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { debitAvailableBalance } from '../utils/availableBalance.js';
import { getB2cTariff, B2cTariffBoundsError } from '../config/mpesaB2cTariffCard.js';
import { getKplcPostpaidTariff, getKplcPrepaidTariff, getNcwscTariff } from '../config/billPaymentTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';
import { submitMobileB2wPayment, submitLipaNaMpesaPayment, validateKplcAccount, submitKplcPayment, validateKplcPrepaidAccount, submitKplcPrepaidPayment, validateNcwscAccount, submitNcwscPayment, NcbaOpenBankingValidationError, NcbaOpenBankingRequestError } from '../services/ncbaOpenBankingService.js';
import { buildPayoutSentSms } from '../utils/paymentSmsTemplates.js';
import { normalizeKraPin, isValidKraPin, KRA_PIN_FORMAT_HINT } from '../utils/kraPinValidator.js';
import { isLipaNaMpesaBetaMerchant, LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE } from '../config/lipaNaMpesaBetaAllowlist.js';
import { computeBulkPayoutRowFee } from '../utils/bulkPayFeeCalculator.js';

// Every catch block in this file used to respond with { error: error.message }
// directly, which bypasses server.js's global error handler entirely (that
// handler only redacts errors reaching it via next(err) in production) — so
// raw internal exception text (library internals, occasionally a fragment of
// a DB error) was always sent straight to the client regardless of
// environment. Found during a security review of the bulk-pay flow.
// serverError() logs the full detail server-side always, and only echoes
// error.message back to the client outside production, matching the app's
// own established redaction behavior elsewhere.
function serverError(res, status, publicMessage, error, logPrefix) {
  console.error(logPrefix || publicMessage, error);
  const body = { message: publicMessage };
  if (process.env.NODE_ENV !== 'production') {
    body.error = error?.message || String(error);
  }
  return res.status(status).json(body);
}

// Professional, human-readable batch reference — BAT-YYYYMMDD-XXXXX (today's
// date plus a 5-char uppercase alphanumeric suffix) — replaces the old
// `BAT-${Date.now()}` (a bare 13-digit millisecond timestamp with no
// readable meaning) with something a merchant can actually recognize at a
// glance and quote back in a support conversation, while staying just as
// collision-safe in practice (PayoutBatch.batchReference is still a unique
// index either way).
function generateBatchReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BAT-${datePart}-${suffix}`;
}

// @desc    Get all payees for a merchant
// @route   GET /api/bulkpay/payees
// @access  Private
export const getPayees = async (req, res) => {
  try {
    const payees = await Payee.find({ merchantId: req.merchant._id }).sort({ createdAt: -1 });
    res.json(payees);
  } catch (error) {
    serverError(res, 500, 'Server error fetching payees', error);
  }
};

// @desc    Read-only estimate of the transaction cost a batch will incur,
//          shown before the merchant authorizes it — so "Total Payout"
//          (the sum of what recipients receive) isn't the only figure they
//          see before a PIN-confirmed debit that also includes fees. Never
//          moves money, never touches balance, never creates a Transaction
//          — see bulkPayFeeCalculator.js's own doc comment for why this
//          intentionally does NOT share code with authorizeBatch's real
//          fee logic.
// @route   POST /api/bulkpay/preview-fees
//          Body: { items: [{ payeeId, amount }, ...] }
// @access  Private
export const previewBatchFees = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.json({ totalFee: 0, rows: [] });
    }

    const payeeIds = items.map((i) => i.payeeId).filter(Boolean);
    const payees = await Payee.find({ _id: { $in: payeeIds }, merchantId: req.merchant._id }).lean();
    const payeeById = Object.fromEntries(payees.map((p) => [String(p._id), p]));

    let totalFee = 0;
    const rows = items.map((item) => {
      const payee = payeeById[item.payeeId];
      const netAmount = Number(item.amount) || 0;
      if (!payee || netAmount <= 0) return { payeeId: item.payeeId, fee: 0, category: null };

      let fee = 0;
      let category = null;
      try {
        ({ fee, category } = computeBulkPayoutRowFee(payee, netAmount));
      } catch {
        // Amount out of bounds for this rail's tariff — authorizeBatch
        // surfaces this properly at authorize time with the actual payee
        // name; the estimate just shows 0 for this one row rather than
        // failing the whole preview over it.
      }
      totalFee += fee;
      return { payeeId: item.payeeId, fee, category };
    });

    res.json({ totalFee: Math.round(totalFee * 100) / 100, rows });
  } catch (error) {
    serverError(res, 500, 'Failed to estimate transaction costs', error);
  }
};

// @desc    Add a new payee (with KRA validation)
// @route   POST /api/bulkpay/payees
// @access  Private
export const addPayee = async (req, res) => {
  try {
    let {
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider, utilityType,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    } = req.body;

    if ((mobileMoneyType === 'Paybill' || mobileMoneyType === 'Buy Goods') && !isLipaNaMpesaBetaMerchant(req.merchant._id)) {
      return res.status(403).json({ message: LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE });
    }

    // The frontend sends '' (not null) for every non-Utility payee — Payee's
    // schema enum is ['KPLC', 'KPLC_PREPAID', 'WATER', null], which does not
    // include '', so this crashed the save for every Employee/Supplier/
    // Contractor with a hard ValidatorError before this normalization existed.
    utilityProvider = utilityProvider || null;

    kraPin = kraPin ? normalizeKraPin(kraPin) : kraPin;
    if (kraPin && !isValidKraPin(kraPin)) {
      return res.status(400).json({ message: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}` });
    }

    // Neither Employees nor Suppliers require KRA PIN/ID Number/eTIMS
    // Invoice/CU Number anymore — PayChain has no live KRA integration on
    // this path (no payroll withholding, no eTIMS submission), so requiring
    // them here only added friction with no compliance benefit. They stay
    // as optional fields on the model in case a merchant wants to record
    // them for their own bookkeeping.

    const payee = new Payee({
      merchantId: req.merchant._id,
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider, utilityType,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    });

    const savedPayee = await payee.save();
    res.status(201).json(savedPayee);
  } catch (error) {
    serverError(res, 500, 'Failed to add payee', error);
  }
};

// @desc    Update an existing payee
// @route   PUT /api/bulkpay/payees/:id
// @access  Private
export const updatePayee = async (req, res) => {
  try {
    let {
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider, utilityType,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    } = req.body;

    if ((mobileMoneyType === 'Paybill' || mobileMoneyType === 'Buy Goods') && !isLipaNaMpesaBetaMerchant(req.merchant._id)) {
      return res.status(403).json({ message: LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE });
    }

    // See addPayee's matching comment — '' isn't a valid enum value on this
    // field, only null or one of the three real providers. Without this,
    // editing any non-Utility payee (Employee/Supplier/Contractor) threw a
    // ValidatorError and the save silently "failed" from the merchant's
    // point of view.
    utilityProvider = utilityProvider || null;

    kraPin = kraPin ? normalizeKraPin(kraPin) : kraPin;
    if (kraPin && !isValidKraPin(kraPin)) {
      return res.status(400).json({ message: `Invalid KRA PIN format. ${KRA_PIN_FORMAT_HINT}` });
    }

    // See addPayee's comment — neither Employees nor Suppliers require
    // KRA PIN/ID Number/eTIMS Invoice/CU Number anymore.

    // Ownership check + update collapsed into one atomic, merchantId-scoped
    // call (was a separate findOne ownership check followed by an unscoped
    // findByIdAndUpdate(req.params.id, ...) — not exploitable as written
    // since both calls targeted the same id within one request, but it's a
    // TOCTOU-shaped anti-pattern; this matches deletePayee's already-correct
    // single-scoped-query pattern). Found during a security review of the
    // bulk-pay flow.
    const updatedPayee = await Payee.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.merchant._id },
      {
        name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
        businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider, utilityType,
        kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount,
        updatedAt: new Date()
      },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedPayee) {
      return res.status(404).json({ message: 'Payee not found' });
    }

    res.json(updatedPayee);
  } catch (error) {
    serverError(res, 500, 'Failed to update payee', error);
  }
};

// @desc    Delete a payee
// @route   DELETE /api/bulkpay/payees/:id
// @access  Private
export const deletePayee = async (req, res) => {
  try {
    const payee = await Payee.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!payee) {
      return res.status(404).json({ message: 'Payee not found' });
    }
    await Payee.deleteOne({ _id: req.params.id, merchantId: req.merchant._id });
    res.status(200).json({ message: 'Payee removed successfully' });
  } catch (error) {
    serverError(res, 500, 'Failed to delete payee', error);
  }
};

// @desc    Verify a KPLC meter number + confirm balance due before saving a
//          Utility/KPLC payee. Pure lookup — does not persist anything and
//          does not return the validationId to the client: NCBA's own
//          Payment Rules require a *fresh* validationId at actual payment
//          time ("Payments processed with generated validation ID only"),
//          so authorizeBatch below re-validates immediately before paying
//          rather than trusting a validationId minted at Add-Payee time,
//          which could be minutes, days or weeks stale by the time a batch
//          actually runs.
// @route   POST /api/bulkpay/validate-kplc-meter
// @access  Private (merchant)
export const validateKplcMeter = async (req, res) => {
  try {
    const { meterNumber, msisdn } = req.body;
    if (!meterNumber || !msisdn) {
      return res.status(400).json({ message: 'meterNumber and msisdn are required.' });
    }
    // NCBA's validate/pay calls reject an msisdn that starts with 0, requiring
    // 254XXXXXXXXX instead — same normalization authorizeBatch already
    // applies at actual payout time. Without it, this preview rejected every
    // meter number for a phone typed in the normal 07... local format, even
    // when the meter itself was perfectly valid.
    let normalizedMsisdn;
    try {
      normalizedMsisdn = validatePhoneNumber(msisdn);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ message: 'Enter a valid Kenyan phone number.' });
      throw e;
    }
    const result = await validateKplcAccount({ meterNumber, msisdn: normalizedMsisdn });
    res.json({
      meterNumber: result.meterNumber,
      customerName: result.customerName,
      serviceName: result.serviceName,
      balance: result.balance,
    });
  } catch (err) {
    if (err instanceof NcbaOpenBankingValidationError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(502).json({ message: 'Failed to verify KPLC meter number. Please try again.' });
  }
};

// @desc    Verify an NCWSC (Nairobi Water) meter number + confirm balance
//          due before saving a Utility/Water payee. Same "don't return the
//          validationId" reasoning as validateKplcMeter above.
// @route   POST /api/bulkpay/validate-ncwsc-meter
// @access  Private (merchant)
export const validateNcwscMeter = async (req, res) => {
  try {
    const { meterNumber, msisdn } = req.body;
    if (!meterNumber || !msisdn) {
      return res.status(400).json({ message: 'meterNumber and msisdn are required.' });
    }
    // See validateKplcMeter's identical normalization comment above.
    let normalizedMsisdn;
    try {
      normalizedMsisdn = validatePhoneNumber(msisdn);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ message: 'Enter a valid Kenyan phone number.' });
      throw e;
    }
    const result = await validateNcwscAccount({ meterNumber, msisdn: normalizedMsisdn });
    res.json({
      meterNumber: result.meterNumber,
      customerName: result.customerName,
      serviceName: result.serviceName,
      balance: result.balance,
    });
  } catch (err) {
    if (err instanceof NcbaOpenBankingValidationError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(502).json({ message: 'Failed to verify NCWSC meter number. Please try again.' });
  }
};

// @desc    Verify a KPLC PREPAID meter number before saving a Utility
//          payee — separate from validateKplcMeter above since NCBA treats
//          postpaid and prepaid as distinct products with their own
//          validate/pay endpoint pairs.
// @route   POST /api/bulkpay/validate-kplc-prepaid-meter
// @access  Private (merchant)
export const validateKplcPrepaidMeter = async (req, res) => {
  try {
    const { meterNumber, msisdn } = req.body;
    if (!meterNumber || !msisdn) {
      return res.status(400).json({ message: 'meterNumber and msisdn are required.' });
    }
    // See validateKplcMeter's identical normalization comment above.
    let normalizedMsisdn;
    try {
      normalizedMsisdn = validatePhoneNumber(msisdn);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ message: 'Enter a valid Kenyan phone number.' });
      throw e;
    }
    const result = await validateKplcPrepaidAccount({ meterNumber, msisdn: normalizedMsisdn });
    res.json({
      meterNumber: result.meterNumber,
      customerName: result.customerName,
      serviceName: result.serviceName,
      balance: result.balance,
    });
  } catch (err) {
    if (err instanceof NcbaOpenBankingValidationError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(502).json({ message: 'Failed to verify KPLC prepaid meter number. Please try again.' });
  }
};

// setBulkPayPin / resetBulkPayPin used to live here as a separate PIN just
// for bulk-pay authorization. Removed — bulk pay now authorizes against the
// same single Payment PIN as every other money-movement flow (see
// authorizeBatch below), set/changed via POST /api/auth/merchant/set-app-pin
// and PUT /api/auth/merchant/reset-app-pin (merchantAuthController.js).

// @desc    Authorize and process the finalized batch
// @route   POST /api/bulkpay/authorize
// @access  Private
export const authorizeBatch = async (req, res) => {
  try {
    const { batchRows, fundingSource, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: 'Bulk Pay PIN is required to authorize the batch' });
    }

    if (!batchRows || !batchRows.length) {
      return res.status(400).json({ message: 'No transactions to process' });
    }

    // batchRows is client-supplied — a negative netAmount here would make
    // totalNet negative below, which
    // would pass the kesBalance >= totalNet check for free and then credit
    // the merchant via $inc: { kesBalance: -totalNet }. Every row's amounts
    // must be validated as positive before they're allowed anywhere near
    // the balance math.
    for (const row of batchRows) {
      const netAmount = Number(row.netAmount);
      const grossAmount = Number(row.grossAmount);
      if (!Number.isFinite(netAmount) || netAmount <= 0 || !Number.isFinite(grossAmount) || grossAmount <= 0) {
        return res.status(400).json({ message: `Invalid amount for payee "${row.name || 'unknown'}" — amounts must be positive numbers.` });
      }
    }

    // Bulk-pay authorization uses the same single Payment PIN as every other
    // money-movement flow (sendMoney, B2C/B2B) — there is no separate
    // "Bulk Pay PIN" anymore, same as an M-Pesa or bank card PIN confirms
    // every transaction rather than having a different PIN per feature.
    const merchant = await Merchant.findById(req.merchant._id).select('+appPin');
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

    if (!merchant.appPin) {
      return res.status(400).json({ message: 'Please set up your Payment PIN first' });
    }

    try {
      await assertPinNotLocked(req.merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ message: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(pin, merchant.appPin);
    if (!isMatch) {
      await recordFailedPinAttempt(req.merchant._id);
      return res.status(401).json({ message: 'Invalid PIN' });
    }
    await resetPinAttempts(req.merchant._id);

    // Correct PIN alone doesn't stop a double-click or a client retrying a
    // slow/timed-out request from submitting the exact same batch twice —
    // reject an identical batch (same payees + amounts, in the same order)
    // landing within a short window of the last one.
    try {
      await claimPayoutSubmission(
        req.merchant._id,
        ['bulk-authorize', ...batchRows.map((r) => `${r.payeeId || r.name}:${r.netAmount}`)]
      );
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ message: e.message });
      throw e;
    }

    // 1. Resolve/create each row's Payee up front, and calculate totals —
    // needed before the balance debit below, since a Mobile Money row paid
    // to a personal M-Pesa number now also owes Safaricom's own B2C tariff
    // plus PayChain's flat markup (getB2cTariff, config/mpesaB2cTariffCard.js),
    // same model as a standalone B2C withdrawal (initiateB2C in
    // mpesaController.js). That has to be known and folded into the single
    // atomic "does the merchant have enough" check below, not added
    // afterward where a race could leave the debit short. Bank/utility rows
    // route via NCBA, which has its own separate (currently zero-fee) model
    // untouched by this; B2B (Paybill/Till) rows aren't priced here —
    // Safaricom's B2B tariff isn't modeled in this codebase yet.
    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalB2cFee = 0;
    let totalUtilityFee = 0;
    let totalLnmFee = 0;
    let totalBankFee = 0;

    for (const row of batchRows) {
      // payeeMatch is a client-supplied Payee _id — without the merchantId
      // scope here, a merchant could authorize a payout against another
      // merchant's Payee record
      // just by guessing/enumerating its _id, redirecting funds to (and
      // leaking the PII of) a payee they were never given.
      let payee = row.payeeMatch
        ? await Payee.findOne({ _id: row.payeeMatch, merchantId: req.merchant._id })
        : null;
      if (!payee) {
        payee = new Payee({
          merchantId: req.merchant._id,
          name: row.name,
          type: row.type || 'employee',
          paymentMethod: 'Mobile Money',
          mobileMoneyType: 'Personal Number',
          phone: row.phone,
          defaultAmount: row.grossAmount,
        });
        await payee.save();
      }
      row._payee = payee;

      // Employees are paid the full stated amount, same as any other payee —
      // no PAYE/NSSF/SHIF withheld (see uploadCSV's matching removal above).

      totalGross += row.grossAmount;
      totalNet += row.netAmount;
      if (row.taxDeductions) {
        totalTax += (row.taxDeductions.paye + row.taxDeductions.nssf + row.taxDeductions.shif);
      }

      row.isB2cRow = payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number';
      if (row.isB2cRow) {
        try {
          const tariff = getB2cTariff(row.netAmount);
          row.b2cFee = tariff.totalFee;
          row.b2cSafaricomFee = tariff.safaricomFee;
          row.b2cMarkup = tariff.markup;
        } catch (e) {
          if (e instanceof B2cTariffBoundsError) {
            return res.status(400).json({ message: `Payout to "${payee.name}" — ${e.message}` });
          }
          throw e;
        }
        totalB2cFee += row.b2cFee;
      } else {
        row.b2cFee = 0;
      }

      // Bill Payment tariff (config/billPaymentTariffCard.js) — KPLC
      // (postpaid/prepaid) and NCWSC rows previously charged the merchant
      // nothing beyond the bill principal; the flat fee constants that used
      // to live in revenueRateCard.js were only ever stamped on the
      // Transaction for dashboard reporting, never actually reserved here.
      // Folded into totalDebit below, same pattern as totalB2cFee above.
      row.isKplcRow = payee.type === 'utility' && payee.utilityProvider === 'KPLC';
      row.isKplcPrepaidRow = payee.type === 'utility' && payee.utilityProvider === 'KPLC_PREPAID';
      row.isNcwscRow = payee.type === 'utility' && payee.utilityProvider === 'WATER';
      if (row.isKplcRow) {
        ({ totalFee: row.utilityFee } = getKplcPostpaidTariff());
      } else if (row.isKplcPrepaidRow) {
        ({ totalFee: row.utilityFee } = getKplcPrepaidTariff(row.netAmount));
      } else if (row.isNcwscRow) {
        ({ totalFee: row.utilityFee } = getNcwscTariff());
      } else {
        row.utilityFee = 0;
      }
      totalUtilityFee += row.utilityFee;

      // B2B PayBill & Till Payout tariff (config/lipaNaMpesaTariffCard.js)
      // — same "never actually charged" gap as KPLC/NCWSC above: this row
      // type (Mobile Money, Paybill/Buy Goods) previously reserved nothing
      // for its fee at all, unlike the standalone initiateB2B endpoint
      // (mpesaController.js), which already charged its old flat KES 30.
      row.isLnmRow = payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType !== 'Personal Number';
      if (row.isLnmRow) {
        ({ totalFee: row.lnmFee } = getLipaNaMpesaTariff(row.netAmount));
      } else {
        row.lnmFee = 0;
      }
      totalLnmFee += row.lnmFee;

      // Interbank Transfer tariff (config/bankTransferTariffCard.js) — Bank
      // rows previously charged nothing beyond the transfer principal, same
      // gap as the other rails above. Bulk Pay never requests RTGS
      // explicitly (submitNcbaBankTransfer defaults to 'pesalink'), so
      // every Bank row prices as PesaLink — except a destination that's
      // NCBA's own bank code, which gets forced onto the (unpriced) IFT
      // rail regardless (see submitNcbaBankTransfer), so it's excluded here
      // too rather than over-reserving a fee that won't actually apply.
      row.isBankRow = payee.paymentMethod === 'Bank';
      if (row.isBankRow && payee.bankCode !== NCBA_OWN_BANK_CODE) {
        ({ totalFee: row.bankFee } = getBankTransferTariff('pesalink', row.netAmount));
      } else {
        row.bankFee = 0;
      }
      totalBankFee += row.bankFee;
    }

    const totalDebit = Math.round((totalNet + totalB2cFee + totalUtilityFee + totalLnmFee + totalBankFee) * 100) / 100;

    // 2 & 3. Atomic conditional deduct — avoids two concurrent batch
    // submissions both passing a stale in-memory balance check. Debits
    // totalDebit (recipient payouts + B2C fees + bill payment fees + B2B
    // PayBill/Till fees + bank transfer fees), not just totalNet, so the
    // merchant needs enough balance to cover the fees too, upfront.
    // debitAvailableBalance also holds back money credited in the last 2
    // minutes (see utils/availableBalance.js) so a bad/duplicate credit
    // can't be withdrawn before it's had a chance to be caught.
    const debitedMerchant = await debitAvailableBalance(merchant._id, totalDebit);
    if (!debitedMerchant) {
      return res.status(400).json({ message: 'Insufficient available funds to process this batch, including the applicable B2C, bill payment, B2B PayBill/Till, and bank transfer charges — a recent credit may still be briefly held.' });
    }
    merchant.kesBalance = debitedMerchant.kesBalance;

    // NCBA's Lipa na M-Pesa endpoint needs reqMobileNumber in 254XXXXXXXXX
    // form, not merchant.phone's stored 07XXXXXXXX (per Rose, NCBA support)
    // — same normalization the KPLC/NCWSC/Mobile B2W branches below already
    // apply per-payee via ncbaMsisdn. merchant is fixed for the whole batch,
    // so this is computed once rather than per row. Falls back to the raw
    // value on a malformed phone rather than blocking the payout over a
    // notification-only field.
    let merchantNotifyMobileNumber = merchant.phone;
    try { merchantNotifyMobileNumber = validatePhoneNumber(merchant.phone); } catch { /* left as raw */ }

    const transactions = [];
    let refundAmount = 0;
    // Rows whose local bookkeeping (Transaction.create, the fee-correction
    // update, or the transactions[] push below) threw after the row's own
    // NCBA call already ran — see the per-row catch below for how each is
    // handled. Surfaced in the response/notification rather than silently
    // vanishing from the batch.
    const recordingFailures = [];

    // 4. Process each row (payee already resolved in the pass above)
    for (const row of batchRows) {
      const payee = row._payee;

      let payoutStatus = 'pending';
      let payoutRef = `BULK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Payee.phone is stored/entered in the standard local format
      // (0XXXXXXXXX) — NCBA's Open Banking validate/pay calls (KPLC, NCWSC,
      // Mobile B2W below) reject an msisdn that starts with 0, requiring
      // 254XXXXXXXXX instead. Normalize once here; left as raw on failure so
      // each branch's own try/catch surfaces a clear per-row rejection
      // instead of throwing before payoutStatus bookkeeping is set up.
      let ncbaMsisdn = payee.phone;
      if (payee.phone) {
        try { ncbaMsisdn = validatePhoneNumber(payee.phone); } catch { /* left as raw; NCBA will reject and the branch below records the failure */ }
      }

      if (payee.type === 'utility' && payee.utilityProvider === 'KPLC') {
        // KPLC goes through NCBA's Open Banking KPLC Payment API (confirmed
        // endpoints, validate-then-pay), not the generic Bulk H2H BILLPAY
        // rail below — accountNumber doubles as the meter number and phone
        // as the notification msisdn, same convention as the BILLPAY branch.
        if (!payee.accountNumber || !payee.phone) {
          payoutStatus = 'failed';
          row.failureReason = 'Meter number or notification phone is missing for this KPLC payee.';
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this KPLC payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-KPLC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // No pre-payment meter validation — kept off even though the
            // KPLC integration itself is back, per Brandon's explicit call.
            await submitKplcPayment({
              transactionId,
              customerName: payee.name,
              meterNumber: payee.accountNumber,
              msisdn: ncbaMsisdn,
              amount: row.netAmount,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Async rail — payoutStatus stays 'pending' (its default
            // above), resolved later via handlePesaLinkCallback.
            payoutRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA KPLC payment rejected for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this KPLC bill payment.';
            refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          }
        }
      } else if (payee.type === 'utility' && payee.utilityProvider === 'KPLC_PREPAID') {
        // KPLC prepaid token purchase — a genuinely different NCBA product
        // from postpaid above (own validate/pay endpoint pair), not just a
        // flag. Same accountNumber/phone convention.
        if (!payee.accountNumber || !payee.phone) {
          payoutStatus = 'failed';
          row.failureReason = 'Meter number or notification phone is missing for this KPLC Prepaid payee.';
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this KPLC prepaid payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-KPLCPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // No pre-purchase meter validation — same as postpaid KPLC above.
            await submitKplcPrepaidPayment({
              transactionId,
              customerName: payee.name,
              meterNumber: payee.accountNumber,
              msisdn: ncbaMsisdn,
              amount: row.netAmount,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Async rail — payoutStatus stays 'pending' (its default
            // above), resolved later via handlePesaLinkCallback.
            payoutRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA KPLC prepaid token purchase rejected for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this KPLC Prepaid token purchase.';
            refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          }
        }
      } else if (payee.type === 'utility' && payee.utilityProvider === 'WATER') {
        // Nairobi Water (NCWSC) goes through NCBA's Open Banking NWSC
        // Payment API (confirmed endpoints, validate-then-pay), not the
        // generic Bulk H2H BILLPAY rail below — same convention as KPLC
        // above (accountNumber = meter number, phone = notification msisdn).
        if (!payee.accountNumber || !payee.phone) {
          payoutStatus = 'failed';
          row.failureReason = 'Meter number or notification phone is missing for this NCWSC payee.';
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this NCWSC payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-NCWSC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // No pre-payment meter validation — NCBA's NCWSC validation
            // service isn't confirmed ready either, same as KPLC above.
            await submitNcwscPayment({
              transactionId,
              customerName: payee.name,
              meterNumber: payee.accountNumber,
              msisdn: ncbaMsisdn,
              amount: row.netAmount,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Async rail — payoutStatus stays 'pending' (its default
            // above), resolved later via handlePesaLinkCallback.
            payoutRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA NCWSC payment rejected for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this NCWSC bill payment.';
            refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          }
        }
      } else if (payee.type === 'utility' && payee.utilityProvider) {
        if (!payee.accountNumber) {
          payoutStatus = 'failed';
          row.failureReason = 'No meter/account number on file for this utility payee.';
          refundAmount += row.netAmount + row.b2cFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: no meter/account number on file for this utility payee.`);
        } else {
          try {
            const { transactionId } = await submitNcbaUtilityPayment({
              utilityProvider: payee.utilityProvider,
              accountNumber: payee.accountNumber,
              amount: row.netAmount,
              name: payee.name,
            });
            // Unlike PesaLink below, NCBA's Bulk H2H "BILLPAY" rail is
            // asynchronous — a successful submission only means NCBA
            // accepted the instruction, not that the bill is paid yet.
            // payoutStatus stays 'pending' (its default above).
            payoutRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA BillPay rejected payout for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this bill payment.';
            refundAmount += row.netAmount + row.b2cFee;
          }
        }
      } else if (payee.paymentMethod === 'Bank') {
        if (!payee.bankCode || !payee.accountNumber) {
          payoutStatus = 'failed';
          row.failureReason = 'No bank code or account number is on file for this payee.';
          refundAmount += row.netAmount + row.b2cFee + row.bankFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: no bank code on file for this payee.`);
        } else {
          try {
            const { transactionId, rail: actualRail } = await submitNcbaBankTransfer({
              businessName: merchant.businessName,
              bankCode: payee.bankCode,
              accountNumber: payee.accountNumber,
              accountName: payee.name,
              amount: row.netAmount,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Actual rail (may be forced to 'ift' for an NCBA-own-bank-code
            // destination — see submitNcbaBankTransfer) — stamped onto the
            // Transaction below so utils/feeCalculator.js's pre-save hook
            // prices it correctly, matching how executeNcbaBankPayout
            // already handles its own single-payout equivalent.
            row.settlementRail = actualRail;
            // Unlike the Mobile Money branches below (which only get an
            // "accepted" ack here and confirm completion later via
            // handlePesaLinkCallback), NCBA PesaLink resolves synchronously
            // — submitNcbaBankTransfer already throws on rejection, so
            // reaching this line means the transfer succeeded. Send this
            // row's own completion SMS now rather than waiting for the
            // batch-level summary SMS below, since that one only says
            // "N recipients" and never confirms this specific payout —
            // the same per-row confirmation an async row gets later from
            // handlePesaLinkCallback once NCBA resolves it.
            payoutRef = transactionId;
            payoutStatus = 'completed';
            if (merchant.phone) {
              const { date: rowDate, time: rowTime } = formatTransactionDateTime();
              const { message: rowSmsMessage } = buildPayoutSentSms({
                ref: payoutRef,
                label: 'Bank Payout',
                amount: row.netAmount,
                recipientName: payee.name,
                date: rowDate,
                time: rowTime,
              });
              safeSendSMS({ to: merchant.phone, message: rowSmsMessage }).then((result) => {
                if (!result.success) console.error(`Bulk bank payout row SMS failed for merchant ${merchant._id}:`, result.error);
              });
            }
          } catch (err) {
            console.error(`❌ NCBA PesaLink rejected payout for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this bank transfer.';
            refundAmount += row.netAmount + row.b2cFee + row.bankFee;
          }
        }
      } else if (payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number') {
        // NCBA Mobile B2W. Reaching past submitMobileB2wPayment without it
        // throwing means its own broadened success check actually
        // confirmed the transfer — NCBA's documented "resolves later via
        // callback" has never been observed arriving for this rail in
        // practice, so this is treated as synchronously resolved
        // (payoutStatus = 'completed' below), not left 'pending' — a real
        // success left 'pending' would otherwise get auto-marked 'failed'
        // and refunded by the reconciliation sweep purely for lack of a
        // callback that was never coming.
        const mobileB2wTransactionId = `PAYOUT-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        try {
          await submitMobileB2wPayment({
            transactionId: mobileB2wTransactionId,
            beneficiaryName: payee.name,
            amount: row.netAmount,
            recipientNumber: ncbaMsisdn,
            narration: `Bulk Payout to ${payee.name}`,
          });
          payoutRef = mobileB2wTransactionId;
          payoutStatus = 'completed';
        } catch (err) {
          console.error(`❌ NCBA Mobile B2W rejected payout for ${payee.name}:`, err.message);
          if (err instanceof NcbaOpenBankingRequestError) {
            // NCBA actually received and processed the request — same
            // reasoning as initiateB2C (mpesaController.js): refunding on
            // top of a transfer that may have already completed would
            // double-cost PayChain with no record of what happened, so
            // this row is left 'pending' under the same reference NCBA
            // actually received, rather than marked failed/refunded here.
            payoutRef = mobileB2wTransactionId;
          } else {
            payoutStatus = 'failed';
            row.failureReason = err.message || 'NCBA rejected this Mobile Money transfer.';
            refundAmount += row.netAmount + row.b2cFee;
          }
        }
      } else if (payee.paymentMethod === 'Mobile Money') {
        // Paybill/Till, via NCBA's Lipa na M-Pesa Payment API — NCBA's
        // replacement for Daraja B2B. Same async shape as Mobile B2W above.
        // No hyphens — NCBA's Lipa na M-Pesa endpoint rejects reqChnlId/
        // reqTransactionReferenceNo values containing special characters
        // (per Rose, NCBA support, 2026-08-27).
        // Defense in depth — addPayee/updatePayee already refuse to save a
        // Paybill/Buy Goods payee for anyone outside the beta allowlist, so
        // this should be unreachable in practice; kept here so a payee
        // saved before that restriction existed can't still slip a real
        // payout through. Same fall-through-to-shared-bookkeeping shape as
        // every other failure branch above (no early `continue`).
        if (!isLipaNaMpesaBetaMerchant(merchant._id)) {
          payoutStatus = 'failed';
          row.failureReason = LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE;
          refundAmount += row.netAmount;
          console.error(`❌ Blocked Lipa na M-Pesa payout for non-beta merchant ${merchant._id} — payee ${payee.name}`);
        } else {
          const lnmTransactionId = `PAYOUTBULK${Date.now()}${Math.floor(Math.random() * 1000)}`;
          try {
            const payBillTillNo = payee.paybillNumber || payee.tillNumber;
            // No pre-payout Till/Paybill validation — takes the saved payee's
            // own mobileMoneyType selection as given.
            const paymentType = payee.mobileMoneyType === 'Paybill' ? 'Paybill' : 'Till';
            await submitLipaNaMpesaPayment({
              transactionId: lnmTransactionId,
              paymentType,
              payBillTillNo,
              amount: row.netAmount,
              accountReference: paymentType === 'Paybill' ? payee.businessAccount : undefined,
              recipientName: payee.name,
              notifyMobileNumber: merchantNotifyMobileNumber,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Async rail — payoutStatus stays 'pending' (its default above),
            // resolved later via handlePesaLinkCallback / the reconciliation
            // sweep, same as KPLC/NCWSC above (no evidence yet that this
            // rail's callback is as unreliable as Mobile B2W's proved to be).
            payoutRef = lnmTransactionId;
          } catch (err) {
            console.error(`❌ NCBA Lipa na M-Pesa rejected payout for ${payee.name}:`, err.message);
            if (err instanceof NcbaOpenBankingRequestError) {
              // Same reasoning as the Mobile B2W branch above: NCBA actually
              // received this request, and an NCBA rejection response has
              // already been shown live not to reliably mean the transfer
              // never landed. Left 'pending' under the reference NCBA
              // actually received rather than refunded here — the
              // reconciliation sweep still resolves it (refund included) if
              // no success callback arrives.
              payoutRef = lnmTransactionId;
            } else {
              payoutStatus = 'failed';
              row.failureReason = err.message || 'NCBA rejected this Lipa na M-Pesa payment.';
              refundAmount += row.netAmount + row.b2cFee + row.lnmFee;
            }
          }
        }
      }

      // Record standard Transaction ledger entry. KPLC (postpaid/prepaid),
      // NCWSC, and Lipa na M-Pesa (Paybill/Till) rows get their own types
      // ('ncba_kplc'/'ncba_kplc_prepaid'/'ncba_ncwsc'/'ncba_lipa_na_mpesa',
      // each fee-mapped to their own revenue stream) so the webhook and
      // dashboard can tell them apart from bank payouts; Bank rows (and any
      // future utilityProvider not yet on a dedicated rail) share
      // 'ncba_outbound' (fee-mapped to ncba_disbursement_fee in
      // revenueRateCard.js), matching services/ncbaBulkPaymentService.js's
      // convention, rather than 'bulk_pay' which earns no fee for those.
      // isKplcRow/isKplcPrepaidRow/isNcwscRow/isLnmRow were already computed
      // in the resolve pass above (where they also drove the fee reserved
      // into totalDebit) — reused here rather than re-derived, so the two
      // can never disagree.
      const isNcbaRouted = payee.paymentMethod === 'Bank' || (payee.type === 'utility' && payee.utilityProvider);
      try {
        const transaction = await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
          type: row.isKplcRow ? 'ncba_kplc' : row.isKplcPrepaidRow ? 'ncba_kplc_prepaid' : row.isNcwscRow ? 'ncba_ncwsc' : row.isLnmRow ? 'ncba_lipa_na_mpesa' : (isNcbaRouted ? 'ncba_outbound' : 'bulk_pay'),
          amount: row.netAmount,
          kesAmount: row.netAmount,
          currency: 'KES',
          status: payoutStatus,
          reference: payoutRef,
          sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
          recipient: { name: payee.name, id: (payee.type === 'utility' && payee.utilityProvider) ? payee.accountNumber : (payee.phone || payee.paybillNumber || payee.tillNumber) },
          mobileNetwork: (payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number')
            ? (payee.mobileNetwork === 'airtel' ? 'airtel' : 'safaricom')
            : null,
          // See models/Transaction.js's doc comment — lets a stuck Lipa na
          // M-Pesa payout into PayChain's own shared paybill be
          // auto-resolved by cross-matching the real ncba_inbound credit,
          // instead of always needing a manual admin check.
          paybillAccountReference: row.isLnmRow ? (payee.businessAccount || null) : null,
          // Only Bank rows ever set this (captured from submitNcbaBankTransfer's
          // return above) — utils/feeCalculator.js's pre-save hook uses it to
          // price 'ncba_outbound' per-rail. undefined for every other row,
          // which Mongoose leaves at the schema default (null).
          settlementRail: row.settlementRail,
        });

        // The pre-save hook above stamps a generic 0.5% fee for 'bulk_pay' —
        // replace it with the real Safaricom B2C tariff + PayChain's flat
        // markup for rows that actually carry it (reserved from the merchant
        // in the resolve pass above), so the persisted figures match what
        // was really charged. Skipped for rows that failed synchronously —
        // their fee was refunded above, so PayChain kept nothing.
        // handlePesaLinkCallback later flips status pending → completed/failed
        // for rows still pending here; it only touches `status`, so this
        // reconciliation isn't clobbered by that follow-up save.
        if (row.isB2cRow && payoutStatus !== 'failed') {
          await Transaction.updateOne(
            { _id: transaction._id },
            { $set: { paychainFee: row.b2cMarkup, safaricomFee: row.b2cSafaricomFee, revenueStream: 'mpesa_b2c_fee' } }
          );
        }

        transactions.push({
          payeeId: payee._id,
          name: payee.name,
          amount: row.netAmount,
          grossAmount: row.grossAmount,
          taxDeductions: row.taxDeductions || { paye: 0, nssf: 0, shif: 0 },
          method: payee.paymentMethod,
          accountReference: payee.phone || payee.paybillNumber || payee.tillNumber || payee.accountNumber || 'N/A',
          receiptNumber: payoutRef,
          status: payoutStatus,
          failureReason: payoutStatus === 'failed' ? (row.failureReason || null) : null,
          b2cFee: payoutStatus !== 'failed' ? row.b2cFee : 0,
          utilityFee: payoutStatus !== 'failed' ? row.utilityFee : 0,
          lnmFee: payoutStatus !== 'failed' ? row.lnmFee : 0,
          bankFee: payoutStatus !== 'failed' ? row.bankFee : 0,
        });
      } catch (recordErr) {
        // The row's own NCBA outcome (payoutStatus, above) already happened
        // and is final — only the local bookkeeping for it failed. If NCBA
        // was never actually contacted for this row (payoutStatus ===
        // 'failed'), it's safe to refund like any other synchronous
        // failure. Otherwise NCBA already has it (or already sent it) —
        // refunding would risk paying the merchant back for money that
        // moved, so this is left unrefunded and flagged loudly for manual
        // reconciliation instead of silently vanishing from the batch.
        console.error(`❌ Bulk Pay row bookkeeping failed for ${payee.name} (payoutStatus was '${payoutStatus}'):`, recordErr.message);
        if (payoutStatus === 'failed') {
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee + row.lnmFee + row.bankFee;
        } else {
          console.error(JSON.stringify({
            level: 'error',
            event: 'bulk_pay_row_confirmed_but_recording_failed',
            merchantId: String(merchant._id), payeeName: payee.name, payoutRef, payoutStatus,
            netAmount: row.netAmount, error: recordErr.message,
          }));
        }
        recordingFailures.push({ payeeName: payee.name, payoutRef, payoutStatus, netAmount: row.netAmount });
      }
    }

    // Refund whatever was rejected synchronously so the batch deduction stays accurate
    if (refundAmount > 0) {
      const refundedMerchant = await Merchant.findByIdAndUpdate(
        merchant._id,
        { $inc: { kesBalance: refundAmount } },
        { returnDocument: 'after' }
      );
      merchant.kesBalance = refundedMerchant.kesBalance;
    }

    // Batch status reflects reality: rows still 'pending' await
    // handlePesaLinkCallback, which will flip the batch to
    // Processed/Partial once resolved.
    const rowStatuses = transactions.map((t) => t.status);
    const batchStatus = rowStatuses.every((s) => s === 'failed')
      ? 'Failed'
      : rowStatuses.some((s) => s === 'failed')
      ? 'Partial'
      : rowStatuses.some((s) => s === 'pending')
      ? 'Pending'
      : 'Processed';

    // 5. Record Batch
    const totalB2cFeesKept = transactions.reduce((sum, t) => sum + (t.b2cFee || 0), 0);
    const batch = new PayoutBatch({
      merchantId: req.merchant._id,
      batchReference: generateBatchReference(),
      totalGrossAmount: totalGross,
      totalTaxDeductions: totalTax,
      totalNetAmount: totalNet,
      totalB2cFees: totalB2cFeesKept,
      payeeCount: transactions.length,
      status: batchStatus,
      fundingSource: fundingSource || 'Main Business Account',
      transactions,
    });

    let savedBatch;
    try {
      savedBatch = await batch.save();
    } catch (batchSaveErr) {
      // Every row above is already resolved and accounted for (refunded if
      // it failed synchronously, or has its own Transaction record if NCBA
      // has it) — only this batch-level summary document failed to
      // persist. Money is not at risk here, but responding with the
      // generic "Failed to authorize batch" message below would wrongly
      // suggest nothing happened and invite a resubmit, double-sending
      // every row that actually went out. Log loudly and tell the merchant
      // the truth instead.
      console.error(JSON.stringify({
        level: 'error',
        event: 'bulk_pay_batch_save_failed',
        merchantId: String(merchant._id), rowCount: transactions.length, totalNet, error: batchSaveErr.message,
      }));
      return res.status(202).json({
        message: `Your ${transactions.length}-payout batch (KES ${totalNet.toLocaleString()}) was processed, but we hit an error saving the batch summary. Check your transaction history for each payout — do not resubmit this batch.`,
        recordingFailures,
      });
    }

    createNotification({
      merchantId: req.merchant._id,
      kind: 'payment',
      title: 'Bulk payout submitted',
      message: `Batch of ${transactions.length} payout${transactions.length === 1 ? '' : 's'} (KES ${totalNet.toLocaleString()}) has been submitted${refundAmount > 0 ? `; KES ${refundAmount.toLocaleString()} was refunded for payouts that failed to send.` : '.'}${recordingFailures.length > 0 ? ` ${recordingFailures.length} payout(s) need manual reconciliation.` : ''}`,
    });

    // Non-blocking — a pending row here still gets its own resolution SMS
    // later from handlePesaLinkCallback once NCBA confirms it, same as a
    // standalone B2C payout. This one is just the submission acknowledgment.
    if (merchant.phone) {
      const failedCount = rowStatuses.filter((s) => s === 'failed').length;
      const { date, time } = formatTransactionDateTime();
      safeSendSMS({
        to: merchant.phone,
        message: `${savedBatch.batchReference} Bulk Payout Submitted. Ksh ${formatKes(totalNet)} to ${transactions.length} recipient${transactions.length === 1 ? '' : 's'} on ${date} at ${time}.${failedCount > 0 ? ` ${failedCount} failed and were refunded.` : ''} New balance: Ksh ${formatKes(merchant.kesBalance)}.`,
      }).then((result) => {
        if (!result.success) console.error(`Bulk payout SMS failed for merchant ${merchant._id}:`, result.error);
      });
    }

    // Trigger Email Receipt in the background if email exists
    if (merchant.email) {
      sendBatchReceiptEmail(
        merchant.email,
        merchant.businessName,
        transactions,
        totalGross,
        totalNet,
        totalTax
      ).catch(e => console.error("Batch Email Error:", e));
    }

    res.status(200).json({
      message: 'Batch authorized and processed successfully.',
      batch: savedBatch,
      ...(recordingFailures.length > 0 ? { recordingFailures } : {}),
    });

  } catch (error) {
    console.error('Bulk Pay Error:', error.response?.data || error);
    // Was: message: error.response?.data?.errorMessage — echoing NCBA's own
    // raw upstream error text straight to the client, not just error.message.
    // Full detail (including error.response.data) is already logged above
    // for debugging; only a generic message + (non-prod only) error.message
    // goes to the client now, matching serverError()'s pattern used
    // elsewhere in this file.
    const body = { message: 'Failed to authorize batch' };
    if (process.env.NODE_ENV !== 'production') {
      body.error = error.response?.data?.errorMessage || error.message;
    }
    res.status(500).json(body);
  }
};

// @desc    Get all batch history for a merchant
// @route   GET /api/bulkpay/batches
// @access  Private
const VALID_BATCH_STATUSES = ['Pending', 'Processed', 'Partial', 'Failed'];

export const getBatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, fromDate, toDate } = req.query;

    let query = { merchantId: req.merchant._id };

    // status must be a plain string from a fixed enum — req.query can
    // otherwise carry a parsed object (e.g. ?status[$ne]=x becomes
    // { $ne: 'x' } under Express's default query parser), which would let a
    // caller inject a Mongo operator into this field. server.js's
    // stripMongoOperators only covers req.body, not req.query, so this
    // needed its own whitelist. Scoped by merchantId regardless, so this
    // was never a cross-merchant data leak — but it could still corrupt
    // query semantics or throw on a crafted operator. Found during a
    // security review of the bulk-pay flow.
    if (status && typeof status === 'string' && VALID_BATCH_STATUSES.includes(status)) {
      query.status = status;
    }

    // Filter by date range if provided
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate && typeof fromDate === 'string') {
        const parsed = new Date(fromDate);
        if (!Number.isNaN(parsed.getTime())) query.createdAt.$gte = parsed;
      }
      if (toDate && typeof toDate === 'string') {
        const parsed = new Date(toDate);
        if (!Number.isNaN(parsed.getTime())) query.createdAt.$lte = parsed;
      }
      if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
    }

    // Clamp page/limit to sane bounds — unbounded values let a caller pull
    // arbitrarily large result sets (or a negative skip) in one request.
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const batches = await PayoutBatch.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PayoutBatch.countDocuments(query);

    res.json({
      batches,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    serverError(res, 500, 'Error fetching batches', error);
  }
};

// @desc    Get a specific batch by ID
// @route   GET /api/bulkpay/batches/:id
// @access  Private
export const getBatchById = async (req, res) => {
  try {
    const batch = await PayoutBatch.findOne({
      _id: req.params.id,
      merchantId: req.merchant._id
    });
    
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    
    res.json(batch);
  } catch (error) {
    serverError(res, 500, 'Error fetching batch', error);
  }
};

// @desc    Get a single payee by ID
// @route   GET /api/bulkpay/payees/:id
// @access  Private
export const getPayeeById = async (req, res) => {
  try {
    const payee = await Payee.findOne({
      _id: req.params.id,
      merchantId: req.merchant._id
    });
    
    if (!payee) {
      return res.status(404).json({ message: 'Payee not found' });
    }
    
    res.json(payee);
  } catch (error) {
    serverError(res, 500, 'Error fetching payee', error);
  }
};
