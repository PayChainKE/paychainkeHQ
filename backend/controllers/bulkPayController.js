import Payee from '../models/Payee.js';
import PayoutBatch from '../models/PayoutBatch.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { calculatePAYE } from '../utils/kraCalculator.js';
import { generateSecurityCredential } from '../utils/safaricomCrypto.js';
import { submitNcbaBankTransfer } from './ncbaOpenBankingController.js';
import { submitNcbaUtilityPayment } from '../services/ncbaBulkPaymentService.js';
import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { sendBatchReceiptEmail } from '../utils/resend.js';
import { createNotification } from './notificationController.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';

// @desc    Get all payees for a merchant
// @route   GET /api/bulkpay/payees
// @access  Private
export const getPayees = async (req, res) => {
  try {
    const payees = await Payee.find({ merchantId: req.merchant._id }).sort({ createdAt: -1 });
    res.json(payees);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching payees', error: error.message });
  }
};

// @desc    Add a new payee (with KRA validation)
// @route   POST /api/bulkpay/payees
// @access  Private
export const addPayee = async (req, res) => {
  try {
    const {
      name, type, paymentMethod, mobileMoneyType, phone, paybillNumber,
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
      name, type, paymentMethod, mobileMoneyType, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    });

    const savedPayee = await payee.save();
    res.status(201).json(savedPayee);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add payee', error: error.message });
  }
};

// @desc    Update an existing payee
// @route   PUT /api/bulkpay/payees/:id
// @access  Private
export const updatePayee = async (req, res) => {
  try {
    const {
      name, type, paymentMethod, mobileMoneyType, phone, paybillNumber,
      businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
      kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    } = req.body;

    // Validate ownership
    const payee = await Payee.findOne({ _id: req.params.id, merchantId: req.merchant._id });
    if (!payee) {
      return res.status(404).json({ message: 'Payee not found' });
    }

    // KRA validations for updated type
    if (type === 'employee' && (!kraPin || !idNumber)) {
      return res.status(400).json({ message: 'KRA PIN and ID Number are required for Employees.' });
    } else if (type === 'supplier' && (!kraPin || !etimsInvoiceNumber || !cuNumber)) {
      return res.status(400).json({ message: 'KRA PIN, eTIMS Invoice Number, and CU Number are required for Suppliers.' });
    }

    // Update payee
    const updatedPayee = await Payee.findByIdAndUpdate(
      req.params.id,
      {
        name, type, paymentMethod, mobileMoneyType, phone, paybillNumber,
        businessAccount, tillNumber, bankName, accountNumber, bankCode, utilityProvider,
        kraPin, idNumber, nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount,
        updatedAt: new Date()
      },
      { returnDocument: 'after' }
    );

    res.json(updatedPayee);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update payee', error: error.message });
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
    await Payee.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Payee removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete payee', error: error.message });
  }
};

// @desc    Set Bulk Pay PIN
// @route   POST /api/bulkpay/set-pin
// @access  Private
export const setBulkPayPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    await Merchant.findByIdAndUpdate(req.merchant._id, { bulkPayPin: hashedPin });
    res.status(200).json({ message: 'Bulk Pay PIN set successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to set PIN', error: error.message });
  }
};

// @desc    Reset Bulk Pay PIN
// @route   PUT /api/bulkpay/reset-pin
// @access  Private
export const resetBulkPayPin = async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    
    if (!currentPin || !newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ message: 'Invalid PIN provided. New PIN must be exactly 4 digits.' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+bulkPayPin');
    if (!merchant || !merchant.bulkPayPin) {
      return res.status(400).json({ message: 'No existing PIN found to reset.' });
    }

    try {
      await assertPinNotLocked(req.merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ message: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(currentPin, merchant.bulkPayPin);
    if (!isMatch) {
      await recordFailedPinAttempt(req.merchant._id);
      return res.status(401).json({ message: 'Current PIN is incorrect.' });
    }
    await resetPinAttempts(req.merchant._id);

    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(newPin, salt);

    await Merchant.findByIdAndUpdate(req.merchant._id, { bulkPayPin: hashedPin });
    res.status(200).json({ message: 'Bulk Pay PIN reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset PIN', error: error.message });
  }
};

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
    res.status(500).json({ message: 'Error processing CSV', error: error.message });
  }
};

// @desc    Authorize and process the finalized batch
// @route   POST /api/bulkpay/authorize
// @access  Private
export const authorizeBatch = async (req, res) => {
  try {
    const { batchRows, fundingSource, pin } = req.body;
    const token = req.mpesaToken; // Assuming protectMerchant + generateToken middleware
    
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

    const merchant = await Merchant.findById(req.merchant._id).select('+bulkPayPin');
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

    if (!merchant.bulkPayPin) {
      return res.status(400).json({ message: 'Please set up your Bulk Pay PIN first' });
    }

    try {
      await assertPinNotLocked(req.merchant._id);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ message: e.message });
      throw e;
    }

    const isMatch = await bcrypt.compare(pin, merchant.bulkPayPin);
    if (!isMatch) {
      await recordFailedPinAttempt(req.merchant._id);
      return res.status(401).json({ message: 'Invalid PIN' });
    }
    await resetPinAttempts(req.merchant._id);

    // 1. Calculate Totals
    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    
    for (const row of batchRows) {
      totalGross += row.grossAmount;
      totalNet += row.netAmount;
      if (row.taxDeductions) {
        totalTax += (row.taxDeductions.paye + row.taxDeductions.nssf + row.taxDeductions.shif);
      }
    }

    // 2 & 3. Atomic conditional deduct — avoids two concurrent batch
    // submissions both passing a stale in-memory balance check.
    const debitedMerchant = await Merchant.findOneAndUpdate(
      { _id: merchant._id, kesBalance: { $gte: totalNet } },
      { $inc: { kesBalance: -totalNet } },
      { returnDocument: 'after' }
    );
    if (!debitedMerchant) {
      return res.status(400).json({ message: 'Insufficient funds to process this batch' });
    }
    merchant.kesBalance = debitedMerchant.kesBalance;

    const transactions = [];
    const b2cPassword = process.env.MPESA_B2C_PASSWORD || 'Safaricom999!@#';
    // Lazily computed and cached inside the Mobile Money branch below, not
    // upfront — the balance has already been atomically deducted by this
    // point, and this function throws when Safaricom's B2C certificate
    // isn't configured (see utils/safaricomCrypto.js). Generating it here
    // would let that throw escape to the outer catch, which never refunds
    // the deduction — treating a missing/invalid credential the same as
    // any other per-row Daraja failure (below) keeps the refund path intact.
    let cachedSecurityCredential = null;
    let securityCredentialError = null;
    const getSecurityCredential = () => {
      if (cachedSecurityCredential) return cachedSecurityCredential;
      if (securityCredentialError) throw securityCredentialError;
      try {
        cachedSecurityCredential = generateSecurityCredential(b2cPassword);
        return cachedSecurityCredential;
      } catch (err) {
        securityCredentialError = err;
        throw err;
      }
    };

    const mpesaEnv = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
    const isLiveMpesa = mpesaEnv === 'live';
    const liveBlocked = isLiveMpesa && process.env.MPESA_LIVE_ENABLED !== 'true';
    const callbackBase = (process.env.MPESA_CALLBACK_URL || '').replace(/\/$/, '');

    let refundAmount = 0;

    // 4. Process each row
    for (const row of batchRows) {
      let payee = null;
      if (row.payeeMatch) {
        payee = await Payee.findById(row.payeeMatch);
      }

      // If no payee found or it's a new one, create on the fly
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

      let darajaStatus = 'pending';
      let darajaRef = `BULK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      if (payee.type === 'utility' && payee.utilityProvider) {
        if (!payee.accountNumber) {
          darajaStatus = 'failed';
          refundAmount += row.netAmount;
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
            // darajaStatus stays 'pending' (its default above).
            darajaRef = transactionId;
          } catch (err) {
            console.error(`❌ NCBA BillPay rejected payout for ${payee.name}:`, err.message);
            darajaStatus = 'failed';
            refundAmount += row.netAmount;
          }
        }
      } else if (payee.paymentMethod === 'Bank') {
        if (!payee.bankCode || !payee.accountNumber) {
          darajaStatus = 'failed';
          refundAmount += row.netAmount;
          console.error(`❌ Bulk payout to ${payee.name} failed: no bank code on file for this payee.`);
        } else {
          try {
            const { transactionId } = await submitNcbaBankTransfer({
              businessName: merchant.businessName,
              bankCode: payee.bankCode,
              accountNumber: payee.accountNumber,
              accountName: payee.name,
              amount: row.netAmount,
              narration: `Bulk Payout to ${payee.name}`,
            });
            // Unlike the Mobile Money branch below (which only gets an
            // "accepted" ack here and confirms completion later via
            // Daraja's b2c-callback), NCBA PesaLink resolves synchronously
            // — submitNcbaBankTransfer already throws on rejection, so
            // reaching this line means the transfer succeeded.
            darajaRef = transactionId;
            darajaStatus = 'completed';
          } catch (err) {
            console.error(`❌ NCBA PesaLink rejected payout for ${payee.name}:`, err.message);
            darajaStatus = 'failed';
            refundAmount += row.netAmount;
          }
        }
      } else if (payee.paymentMethod === 'Mobile Money') {
        if (liveBlocked) {
          darajaStatus = 'failed';
          refundAmount += row.netAmount;
          console.error(`❌ Bulk payout to ${payee.name} blocked: live M-PESA is not enabled (set MPESA_LIVE_ENABLED=true).`);
        } else if (!token) {
          darajaStatus = 'failed';
          refundAmount += row.netAmount;
          console.error(`❌ Bulk payout to ${payee.name} failed: no Daraja auth token available.`);
        } else {
          try {
            const securityCredential = getSecurityCredential();

            const mpesaBaseUrl = isLiveMpesa ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
            const isB2C = payee.mobileMoneyType === 'Personal Number';
            const url = isB2C
              ? `${mpesaBaseUrl}/mpesa/b2c/v1/paymentrequest`
              : `${mpesaBaseUrl}/mpesa/b2b/v1/paymentrequest`;

            const payload = isB2C ? {
              InitiatorName: process.env.MPESA_B2C_INITIATOR || 'testapi',
              SecurityCredential: securityCredential,
              CommandID: 'BusinessPayment',
              Amount: row.netAmount,
              PartyA: process.env.MPESA_SHORTCODE || '600000',
              PartyB: payee.phone,
              Remarks: `Bulk Payout to ${payee.name}`,
              QueueTimeOutURL: callbackBase ? `${callbackBase}/api/callbacks/b2c-timeout` : 'https://sandbox.paychain.co.ke/api/callbacks/b2c-timeout',
              ResultURL: callbackBase ? `${callbackBase}/api/callbacks/b2c-callback` : 'https://sandbox.paychain.co.ke/api/callbacks/b2c-callback',
              Occasion: 'PayChain Settlement'
            } : {
              // B2B Payload
              Initiator: process.env.MPESA_B2C_INITIATOR || 'testapi',
              SecurityCredential: securityCredential,
              CommandID: payee.mobileMoneyType === 'Paybill' ? 'BusinessPayBill' : 'BusinessBuyGoods',
              SenderIdentifierType: '4',
              RecieverIdentifierType: '4',
              Amount: row.netAmount,
              PartyA: process.env.MPESA_SHORTCODE || '600000',
              PartyB: payee.paybillNumber || payee.tillNumber,
              AccountReference: payee.businessAccount || 'Settlement',
              Remarks: `Bulk B2B Payout to ${payee.name}`,
              QueueTimeOutURL: callbackBase ? `${callbackBase}/api/callbacks/b2c-timeout` : 'https://sandbox.paychain.co.ke/api/callbacks/b2c-timeout',
              ResultURL: callbackBase ? `${callbackBase}/api/callbacks/b2c-callback` : 'https://sandbox.paychain.co.ke/api/callbacks/b2c-callback',
            };

            const mpesaRes = await axios.post(url, payload, {
              headers: { Authorization: `Bearer ${token}` }
            });
            // Daraja only accepted the request — real completion is confirmed
            // asynchronously via the b2c-callback webhook.
            darajaRef = mpesaRes.data.OriginatorConversationID || darajaRef;
          } catch (err) {
            console.error(`❌ Daraja API rejected payout for ${payee.name}:`, err.response?.data?.errorMessage || err.message);
            darajaStatus = 'failed';
            refundAmount += row.netAmount;
          }
        }
      }

      // Record standard Transaction ledger entry. Bank- and utility-routed
      // rows both go through NCBA and use 'ncba_outbound' (fee-mapped to
      // ncba_disbursement_fee in revenueRateCard.js), matching
      // services/ncbaBulkPaymentService.js's convention, rather than
      // 'bulk_pay' which earns no fee for those.
      const isNcbaRouted = payee.paymentMethod === 'Bank' || (payee.type === 'utility' && payee.utilityProvider);
      await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: isNcbaRouted ? 'ncba_outbound' : 'bulk_pay',
        amount: row.netAmount,
        kesAmount: row.netAmount,
        currency: 'KES',
        status: darajaStatus,
        reference: darajaRef,
        sender: { name: merchant.businessName, id: merchant.paybillAccount },
        recipient: { name: payee.name, id: payee.phone || payee.paybillNumber || payee.tillNumber }
      });

      transactions.push({
        payeeId: payee._id,
        name: payee.name,
        amount: row.netAmount,
        grossAmount: row.grossAmount,
        taxDeductions: row.taxDeductions || { paye: 0, nssf: 0, shif: 0 },
        method: payee.paymentMethod,
        accountReference: payee.phone || payee.paybillNumber || payee.tillNumber || payee.accountNumber || 'N/A',
        receiptNumber: darajaRef,
        status: darajaStatus,
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

    // Batch status reflects reality: rows still 'pending' await the Daraja
    // callback, which will flip the batch to Processed/Partial once resolved.
    const rowStatuses = transactions.map((t) => t.status);
    const batchStatus = rowStatuses.every((s) => s === 'failed')
      ? 'Failed'
      : rowStatuses.some((s) => s === 'failed')
      ? 'Partial'
      : rowStatuses.some((s) => s === 'pending')
      ? 'Pending'
      : 'Processed';

    // 5. Record Batch
    const batch = new PayoutBatch({
      merchantId: req.merchant._id,
      batchReference: `BAT-${Date.now()}`,
      totalGrossAmount: totalGross,
      totalTaxDeductions: totalTax,
      totalNetAmount: totalNet,
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
    // later from b2cCallback once Daraja confirms it, same as a standalone
    // B2C payout. This one is just the submission acknowledgment.
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
      message: 'Batch authorized and processed successfully via Daraja M-PESA.',
      batch: savedBatch,
    });

  } catch (error) {
    console.error('Bulk Pay Error:', error.response?.data || error);
    res.status(500).json({ 
      message: error.response?.data?.errorMessage || 'Failed to authorize batch', 
      error: error.message 
    });
  }
};

// @desc    Get all batch history for a merchant
// @route   GET /api/bulkpay/batches
// @access  Private
export const getBatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, fromDate, toDate } = req.query;
    
    let query = { merchantId: req.merchant._id };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by date range if provided
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate);
      }
    }
    
    const skip = (page - 1) * limit;
    const batches = await PayoutBatch.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PayoutBatch.countDocuments(query);
    
    res.json({
      batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching batches', error: error.message });
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
    res.status(500).json({ message: 'Error fetching batch', error: error.message });
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
    res.status(500).json({ message: 'Error fetching payee', error: error.message });
  }
};
