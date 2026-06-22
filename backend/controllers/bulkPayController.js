import Payee from '../models/Payee.js';
import PayoutBatch from '../models/PayoutBatch.js';
import { calculatePAYE } from '../utils/kraCalculator.js';
import csv from 'csv-parser';
import fs from 'fs';

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
    
    if (!batchRows || !batchRows.length) {
      return res.status(400).json({ message: 'No transactions to process' });
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    
    const transactions = [];

    // Process each row
    for (const row of batchRows) {
      totalGross += row.grossAmount;
      totalNet += row.netAmount;
      if (row.taxDeductions) {
        totalTax += (row.taxDeductions.paye + row.taxDeductions.nssf + row.taxDeductions.shif);
      }

      // If it's a new payee, create them on the fly
      let payeeId = row.payeeMatch;
      if (!payeeId) {
        const newPayee = new Payee({
          merchantId: req.merchant._id,
          name: row.name,
          type: row.type || 'employee',
          paymentMethod: 'Mobile Money',
          mobileMoneyType: 'Personal Number',
          phone: row.phone,
          defaultAmount: row.grossAmount,
        });
        const saved = await newPayee.save();
        payeeId = saved._id;
      }

      transactions.push({
        payeeId,
        name: row.name,
        amount: row.netAmount,
        grossAmount: row.grossAmount,
        taxDeductions: row.taxDeductions || { paye: 0, nssf: 0, shif: 0 },
        method: row.phone ? 'Mobile Money' : 'Bank',
        accountReference: row.phone || 'N/A',
        receiptNumber: `TX${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      });
    }

    // Record Batch
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
    
    res.status(200).json({
      message: 'Batch authorized and processed successfully.',
      batch: savedBatch,
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to authorize batch', error: error.message });
  }
};
