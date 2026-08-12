import Payee from '../models/Payee.js';
import PayoutBatch from '../models/PayoutBatch.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { calculatePAYE } from '../utils/kraCalculator.js';
import { submitNcbaBankTransfer, NCBA_OWN_BANK_CODE } from './ncbaOpenBankingController.js';
import { getBankTransferTariff } from '../config/bankTransferTariffCard.js';
import { submitNcbaUtilityPayment } from '../services/ncbaBulkPaymentService.js';
import csv from 'csv-parser';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { sendBatchReceiptEmail } from '../utils/resend.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { getB2cTariff, B2cTariffBoundsError } from '../config/mpesaB2cTariffCard.js';
import { getKplcPostpaidTariff, getKplcPrepaidTariff, getNcwscTariff } from '../config/billPaymentTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { validatePhoneNumber } from '../utils/ncbaValidators.js';
import { validateMobileWalletNumber, submitMobileB2wPayment, validateLipaNaMpesaAccount, submitLipaNaMpesaPayment, validateKplcAccount, submitKplcPayment, validateKplcPrepaidAccount, submitKplcPrepaidPayment, validateNcwscAccount, submitNcwscPayment, NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { buildPayoutSentSms } from '../utils/paymentSmsTemplates.js';

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

// @desc    Add a new payee (with KRA validation)
// @route   POST /api/bulkpay/payees
// @access  Private
export const addPayee = async (req, res) => {
  try {
    const {
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    } = req.body;

    // Strict KRA validations (Simulated for real-world robustness)
    if (type === 'employee') {
      if (!kraPin || !idNumber) {
        return res.status(400).json({ message: 'KRA PIN and ID Number are strictly required for Employees.' });
      }
    } else if (type === 'supplier') {
      if (!kraPin || !etimsInvoiceNumber || !cuNumber) {
        return res.status(400).json({ message: 'KRA PIN, eTIMS Invoice Number, and CU Number are strictly required for Suppliers.' });
      }
    }

    const payee = new Payee({
      merchantId: req.merchant._id,
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
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
    const {
      name, type, paymentMethod, mobileMoneyType, mobileNetwork, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    } = req.body;

    // KRA validations for updated type
    if (type === 'employee' && (!kraPin || !idNumber)) {
      return res.status(400).json({ message: 'KRA PIN and ID Number are required for Employees.' });
    } else if (type === 'supplier' && (!kraPin || !etimsInvoiceNumber || !cuNumber)) {
      return res.status(400).json({ message: 'KRA PIN, eTIMS Invoice Number, and CU Number are required for Suppliers.' });
    }

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
        businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
        kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount,
        updatedAt: new Date()
      },
      { returnDocument: 'after' }
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
    const result = await validateKplcAccount({ meterNumber, msisdn });
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
    const result = await validateNcwscAccount({ meterNumber, msisdn });
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
    const result = await validateKplcPrepaidAccount({ meterNumber, msisdn });
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

// @desc    Upload and parse CSV for bulk payout preview
// @route   POST /api/bulkpay/upload-csv
// @access  Private
export const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a CSV file' });
    }

    const results = [];
    const filePath = req.file.path;

    // Fetch existing payees to match against
    const existingPayees = await Payee.find({ merchantId: req.merchant._id });

    // Guards against a malformed/non-CSV upload leaving the temp file on
    // disk forever and the request hanging with no response — previously
    // only the 'end' event cleaned up or replied at all.
    let responded = false;
    const cleanupAndFail = (error) => {
      if (responded) return;
      responded = true;
      fs.unlink(filePath, () => {});
      console.error('CSV parse error:', error.message);
      res.status(400).json({ message: 'Could not read the uploaded file. Please check it is a valid CSV.' });
    };

    fs.createReadStream(filePath)
      .on('error', cleanupAndFail)
      .pipe(csv())
      .on('error', cleanupAndFail)
      .on('data', (data) => {
        // Expected CSV Columns: name, type, phone, amount
        // If type is employee, amount is considered Gross Pay
        
        const type = data.type?.toLowerCase() || 'employee';
        const rawAmount = parseFloat(data.amount) || 0;
        
        let processedRow = {
          rawRow: data,
          name: data.name,
          type: type,
          phone: data.phone,
          status: 'Valid',
          grossAmount: rawAmount,
          netAmount: rawAmount,
          taxDeductions: null,
          payeeMatch: null,
        };

        // Attempt to find a matching payee in the DB by name or phone
        const matchedPayee = existingPayees.find(
          p => (p.phone && p.phone === data.phone) || (p.name.toLowerCase() === data.name?.toLowerCase())
        );
        
        if (matchedPayee) {
          processedRow.payeeMatch = matchedPayee._id;
        } else {
          processedRow.status = 'Warning: New Payee (Will be created)';
        }

        // Apply KRA Calculations if Employee
        if (type === 'employee') {
          const taxes = calculatePAYE(rawAmount);
          processedRow.grossAmount = taxes.grossPay;
          processedRow.netAmount = taxes.netPay;
          processedRow.taxDeductions = {
            paye: taxes.paye,
            nssf: taxes.nssf,
            shif: taxes.shif,
          };
        }

        results.push(processedRow);
      })
      .on('end', () => {
        if (responded) return; // already replied via cleanupAndFail
        responded = true;
        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Summarize
        const summary = results.reduce((acc, curr) => {
          acc.totalGross += curr.grossAmount;
          acc.totalNet += curr.netAmount;
          if (curr.taxDeductions) {
            acc.totalPaye += curr.taxDeductions.paye;
          }
          return acc;
        }, { totalGross: 0, totalNet: 0, totalPaye: 0 });

        res.json({
          message: 'CSV parsed successfully',
          summary,
          rows: results,
        });
      });

  } catch (error) {
    serverError(res, 500, 'Error processing CSV', error);
  }
};

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

    // batchRows is client-supplied (round-tripped from the upload-csv preview) —
    // a negative netAmount here would make totalNet negative below, which
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
      // payeeMatch is a client-supplied Payee _id round-tripped from the
      // upload-csv preview — without the merchantId scope here, a merchant
      // could authorize a payout against another merchant's Payee record
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
      // gap as the other rails above. Bulk Pay never requests EFT/RTGS
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
    const debitedMerchant = await Merchant.findOneAndUpdate(
      { _id: merchant._id, kesBalance: { $gte: totalDebit } },
      { $inc: { kesBalance: -totalDebit } },
      { returnDocument: 'after' }
    );
    if (!debitedMerchant) {
      return res.status(400).json({ message: 'Insufficient funds to process this batch, including the applicable B2C, bill payment, B2B PayBill/Till, and bank transfer charges' });
    }
    merchant.kesBalance = debitedMerchant.kesBalance;

    const transactions = [];
    let refundAmount = 0;

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
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this KPLC payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-KPLC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // Fresh validationId required at payment time — see
            // validateKplcMeter's doc comment for why an Add-Payee-time one
            // can't be reused here.
            const validation = await validateKplcAccount({ meterNumber: payee.accountNumber, msisdn: ncbaMsisdn });
            await submitKplcPayment({
              transactionId,
              validationId: validation.validationId,
              customerName: validation.customerName || payee.name,
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
            refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          }
        }
      } else if (payee.type === 'utility' && payee.utilityProvider === 'KPLC_PREPAID') {
        // KPLC prepaid token purchase — a genuinely different NCBA product
        // from postpaid above (own validate/pay endpoint pair), not just a
        // flag. Same accountNumber/phone convention.
        if (!payee.accountNumber || !payee.phone) {
          payoutStatus = 'failed';
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this KPLC prepaid payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-KPLCPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const validation = await validateKplcPrepaidAccount({ meterNumber: payee.accountNumber, msisdn: ncbaMsisdn });
            await submitKplcPrepaidPayment({
              transactionId,
              validationId: validation.validationId,
              customerName: validation.customerName || payee.name,
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
          refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          console.error(`❌ Bulk payout to ${payee.name} failed: meter number or notification phone missing for this NCWSC payee.`);
        } else {
          try {
            const transactionId = `PAYOUT-NCWSC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // Fresh validationId required at payment time — see
            // validateNcwscMeter's doc comment.
            const validation = await validateNcwscAccount({ meterNumber: payee.accountNumber, msisdn: ncbaMsisdn });
            await submitNcwscPayment({
              transactionId,
              validationId: validation.validationId,
              customerName: validation.customerName || payee.name,
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
            refundAmount += row.netAmount + row.b2cFee + row.utilityFee;
          }
        }
      } else if (payee.type === 'utility' && payee.utilityProvider) {
        if (!payee.accountNumber) {
          payoutStatus = 'failed';
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
            // Unlike PesaLink/EFT below, NCBA's Bulk H2H "BILLPAY" rail is
            // asynchronous — a successful submission only means NCBA
            // accepted the instruction, not that the bill is paid yet.
            // payoutStatus stays 'pending' (its default above).
            payoutRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA BillPay rejected payout for ${payee.name}:`, err.message);
            payoutStatus = 'failed';
            refundAmount += row.netAmount + row.b2cFee;
          }
        }
      } else if (payee.paymentMethod === 'Bank') {
        if (!payee.bankCode || !payee.accountNumber) {
          payoutStatus = 'failed';
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
            refundAmount += row.netAmount + row.b2cFee + row.bankFee;
          }
        }
      } else if (payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number') {
        // NCBA Mobile B2W. Async rail — payoutStatus stays 'pending' (its
        // default above), resolved later via handlePesaLinkCallback
        // (ncbaOpenBankingController.js), keyed by the reference this row is
        // stamped with below.
        try {
          const network = payee.mobileNetwork === 'airtel' ? 'airtel' : 'safaricom';
          const transactionId = `PAYOUT-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const { validationId } = await validateMobileWalletNumber({ provider: network, msisdn: ncbaMsisdn });
          await submitMobileB2wPayment({
            transactionId,
            validationId,
            provider: network,
            amount: row.netAmount,
            recipientNumber: ncbaMsisdn,
            narration: `Bulk Payout to ${payee.name}`,
          });
          payoutRef = transactionId;
        } catch (err) {
          console.error(`❌ NCBA Mobile B2W rejected payout for ${payee.name}:`, err.message);
          payoutStatus = 'failed';
          refundAmount += row.netAmount + row.b2cFee;
        }
      } else if (payee.paymentMethod === 'Mobile Money') {
        // Paybill/Till, via NCBA's Lipa na M-Pesa Payment API — NCBA's
        // replacement for Daraja B2B. Same async shape as Mobile B2W above.
        try {
          const paymentType = payee.mobileMoneyType === 'Paybill' ? 'Paybill' : 'Till';
          const payBillTillNo = payee.paybillNumber || payee.tillNumber;
          const transactionId = `PAYOUT-BULK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const destination = await validateLipaNaMpesaAccount({ paymentType, payBillTillNo });
          await submitLipaNaMpesaPayment({
            transactionId,
            paymentType,
            payBillTillNo,
            amount: row.netAmount,
            accountReference: paymentType === 'Paybill' ? payee.businessAccount : undefined,
            recipientName: destination.organizationName || payee.name,
            notifyMobileNumber: merchant.phone,
            narration: `Bulk Payout to ${payee.name}`,
          });
          payoutRef = transactionId;
        } catch (err) {
          console.error(`❌ NCBA Lipa na M-Pesa rejected payout for ${payee.name}:`, err.message);
          payoutStatus = 'failed';
          refundAmount += row.netAmount + row.b2cFee + row.lnmFee;
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
      const transaction = await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: row.isKplcRow ? 'ncba_kplc' : row.isKplcPrepaidRow ? 'ncba_kplc_prepaid' : row.isNcwscRow ? 'ncba_ncwsc' : row.isLnmRow ? 'ncba_lipa_na_mpesa' : (isNcbaRouted ? 'ncba_outbound' : 'bulk_pay'),
        amount: row.netAmount,
        kesAmount: row.netAmount,
        currency: 'KES',
        status: payoutStatus,
        reference: payoutRef,
        sender: { name: merchant.businessName, id: merchant.paybillAccount },
        recipient: { name: payee.name, id: (payee.type === 'utility' && payee.utilityProvider) ? payee.accountNumber : (payee.phone || payee.paybillNumber || payee.tillNumber) },
        mobileNetwork: (payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number')
          ? (payee.mobileNetwork === 'airtel' ? 'airtel' : 'safaricom')
          : null,
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
        b2cFee: payoutStatus !== 'failed' ? row.b2cFee : 0,
        utilityFee: payoutStatus !== 'failed' ? row.utilityFee : 0,
        lnmFee: payoutStatus !== 'failed' ? row.lnmFee : 0,
        bankFee: payoutStatus !== 'failed' ? row.bankFee : 0,
      });
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
      batchReference: `BAT-${Date.now()}`,
      totalGrossAmount: totalGross,
      totalTaxDeductions: totalTax,
      totalNetAmount: totalNet,
      totalB2cFees: totalB2cFeesKept,
      payeeCount: transactions.length,
      status: batchStatus,
      fundingSource: fundingSource || 'Main Business Account',
      transactions,
    });

    const savedBatch = await batch.save();

    createNotification({
      merchantId: req.merchant._id,
      kind: 'payment',
      title: 'Bulk payout submitted',
      message: `Batch of ${transactions.length} payout${transactions.length === 1 ? '' : 's'} (KES ${totalNet.toLocaleString()}) has been submitted${refundAmount > 0 ? `; KES ${refundAmount.toLocaleString()} was refunded for payouts that failed to send.` : '.'}`,
    });

    // Non-blocking — a pending row here still gets its own resolution SMS
    // later from handlePesaLinkCallback once NCBA confirms it, same as a
    // standalone B2C payout. This one is just the submission acknowledgment.
    if (merchant.phone) {
      const failedCount = rowStatuses.filter((s) => s === 'failed').length;
      const { date, time } = formatTransactionDateTime();
      safeSendSMS({
        to: merchant.phone,
        message: `${savedBatch.batchReference} Bulk Payout Submitted. KES ${totalNet.toLocaleString()} to ${transactions.length} recipient${transactions.length === 1 ? '' : 's'} on ${date} at ${time}.${failedCount > 0 ? ` ${failedCount} failed and were refunded.` : ''} New balance: KES ${merchant.kesBalance.toLocaleString()}.`,
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
