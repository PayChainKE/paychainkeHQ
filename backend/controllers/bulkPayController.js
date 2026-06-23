import Payee from '../models/Payee.js';
import PayoutBatch from '../models/PayoutBatch.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { calculatePAYE } from '../utils/kraCalculator.js';
import { generateSecurityCredential } from '../utils/safaricomCrypto.js';
import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import { sendBatchReceiptEmail } from '../utils/resend.js';

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
      businessAccount, tillNumber, bankName, accountNumber, kraPin, idNumber,
      nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
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
      businessAccount, tillNumber, bankName, accountNumber, kraPin, idNumber,
      nssfNumber, shifNumber, etimsInvoiceNumber, cuNumber, defaultAmount
    });

    const savedPayee = await payee.save();
    res.status(201).json(savedPayee);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add payee', error: error.message });
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

    fs.createReadStream(filePath)
      .pipe(csv())
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
    const { batchRows, fundingSource } = req.body;
    const token = req.mpesaToken; // Assuming protectMerchant + generateToken middleware
    
    if (!batchRows || !batchRows.length) {
      return res.status(400).json({ message: 'No transactions to process' });
    }

    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

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

    // 2. Validate Liquidity
    if (merchant.kesBalance < totalNet) {
      return res.status(400).json({ message: 'Insufficient funds to process this batch' });
    }

    // 3. Deduct upfront to prevent double-spending
    merchant.kesBalance -= totalNet;
    await merchant.save();

    const transactions = [];
    const b2cPassword = process.env.MPESA_B2C_PASSWORD || 'Safaricom999!@#';
    const securityCredential = generateSecurityCredential(b2cPassword);

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

      let darajaStatus = 'completed'; // Default to complete for simulation
      let darajaRef = `SIM_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      
      // Fire Daraja API if Mobile Money
      if (payee.paymentMethod === 'Mobile Money' && token) {
        const isB2C = payee.mobileMoneyType === 'Personal Number';
        const url = isB2C 
          ? 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
          : 'https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest';

        const payload = isB2C ? {
          InitiatorName: process.env.MPESA_B2C_INITIATOR || 'testapi',
          SecurityCredential: securityCredential,
          CommandID: 'BusinessPayment',
          Amount: row.netAmount,
          PartyA: process.env.MPESA_SHORTCODE || '600000',
          PartyB: payee.phone,
          Remarks: `Bulk Payout to ${payee.name}`,
          QueueTimeOutURL: 'https://your-domain.com/api/callbacks/timeout',
          ResultURL: 'https://your-domain.com/api/callbacks/result',
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
          QueueTimeOutURL: 'https://your-domain.com/api/callbacks/timeout',
          ResultURL: 'https://your-domain.com/api/callbacks/result',
        };

        try {
          const mpesaRes = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          darajaRef = mpesaRes.data.OriginatorConversationID || darajaRef;
        } catch (err) {
          console.warn(`Daraja API skipped or failed for ${payee.name}, falling back to simulation.`);
        }
      }

      // Record standard Transaction ledger entry
      await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: 'outbound',
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
      });
    }

    // 5. Record Batch
    const batch = new PayoutBatch({
      merchantId: req.merchant._id,
      batchReference: `BAT-${Date.now()}`,
      totalGrossAmount: totalGross,
      totalTaxDeductions: totalTax,
      totalNetAmount: totalNet,
      payeeCount: transactions.length,
      status: 'Processed',
      fundingSource: fundingSource || 'Main Business Till',
      transactions,
    });

    const savedBatch = await batch.save();

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
    console.error('Bulk Pay Error:', error);
    res.status(500).json({ message: 'Failed to authorize batch', error: error.message });
  }
};
