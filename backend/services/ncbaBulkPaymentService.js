import axios from 'axios';
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import PayoutBatch from '../models/PayoutBatch.js';

// ── NCBA Bulk Payments (Host-to-Host) configuration ───────────────────────
// Same "never derive from NODE_ENV" rule as mpesaController.js — hosting
// platforms set NODE_ENV=production even for staging, which would otherwise
// silently point a demo deploy at NCBA's live rail.
const ncbaEnv     = (process.env.NCBA_ENVIRONMENT || 'sandbox').toLowerCase();
const isLive      = ncbaEnv === 'live';
const ncbaBaseUrl = isLive
  ? (process.env.NCBA_BASE_URL || 'https://api.ncbagroup.com')
  : (process.env.NCBA_SANDBOX_BASE_URL || 'https://sandbox-api.ncbagroup.com');

const ncbaApiKey           = process.env.NCBA_API_KEY;
const ncbaDebitAccount     = process.env.NCBA_SETTLEMENT_ACCOUNT;

// NCBA H2H biller codes for supported utility rails. Real codes are assigned
// per-merchant/per-integration by NCBA during onboarding — these env-backed
// defaults exist so the payload shape is correct even before that's wired up.
const UTILITY_BILLER_CODES = {
  KPLC:  process.env.NCBA_BILLER_CODE_KPLC  || 'KPLC01',
  WATER: process.env.NCBA_BILLER_CODE_WATER || 'WATER01',
};

export class InsufficientFundsError extends Error {
  constructor(merchantId, requested, available) {
    super(`Merchant ${merchantId} has insufficient balance: requested ${requested}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

export class NcbaPayoutValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NcbaPayoutValidationError';
  }
}

/**
 * @typedef {Object} PayoutItem
 * @property {string} name
 * @property {'supplier'|'utility'} type
 * @property {'bank'|'mobile'} routing
 * @property {string} accountNumber   - Bank account number, or the KPLC meter
 *                                      number / water account number for utility payouts.
 * @property {string} [bankCode]      - Required when routing === 'bank' and type === 'supplier'.
 * @property {'KPLC'|'WATER'} [utilityProvider] - Required when type === 'utility'.
 * @property {number} amount
 */

function validatePayoutItem(item, index) {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new NcbaPayoutValidationError(`Payout item #${index}: amount must be a positive number`);
  }
  if (!item.accountNumber || String(item.accountNumber).trim().length === 0) {
    throw new NcbaPayoutValidationError(`Payout item #${index}: accountNumber is required`);
  }
  if (!['supplier', 'utility'].includes(item.type)) {
    throw new NcbaPayoutValidationError(`Payout item #${index}: type must be "supplier" or "utility"`);
  }
  if (item.type === 'utility' && !UTILITY_BILLER_CODES[item.utilityProvider]) {
    throw new NcbaPayoutValidationError(`Payout item #${index}: utilityProvider must be one of ${Object.keys(UTILITY_BILLER_CODES).join(', ')}`);
  }
  if (item.type === 'supplier' && item.routing === 'bank' && !item.bankCode) {
    throw new NcbaPayoutValidationError(`Payout item #${index}: bankCode is required for bank-routed supplier payouts`);
  }
  return amount;
}

/**
 * Route a KPLC prepaid-token or water-bill payout to its NCBA H2H "BILLPAY"
 * instruction shape. Kept separate from the supplier/EFT branch because
 * utility payments settle against a biller code + meter/account number
 * rather than a bank account + bank code.
 */
function routeUtilityPayout(item) {
  const billerCode = UTILITY_BILLER_CODES[item.utilityProvider];
  if (!billerCode) {
    throw new NcbaPayoutValidationError(`No NCBA biller code configured for utility provider "${item.utilityProvider}"`);
  }

  return {
    PaymentType: 'BILLPAY',
    BillerCode: billerCode,
    BillerAccountNumber: String(item.accountNumber).trim(),
  };
}

function buildPaymentInstruction(item, index) {
  const reference = `NCBA-BULK-${Date.now()}-${index}`;

  const routingFields = item.type === 'utility'
    ? routeUtilityPayout(item)
    : {
        PaymentType: item.routing === 'mobile' ? 'MOBILE_WALLET' : 'EFT',
        BankCode: item.bankCode || null,
        BeneficiaryAccountNumber: String(item.accountNumber).trim(),
      };

  return {
    PaymentReference: reference,
    BeneficiaryName: item.name,
    Amount: Number(item.amount),
    Narrative: `PayChain Bulk Payout - ${item.type}`,
    ...routingFields,
  };
}

/**
 * Builds the dynamic payload shape ready to POST to NCBA's Bulk Payments
 * Host-to-Host API and, when NCBA_LIVE_ENABLED=true, submits it. In sandbox
 * (default) it simulates acceptance so the pipeline can be exercised without
 * live bank credentials.
 */
async function submitToNcbaHostToHost(payload) {
  if (!isLive || process.env.NCBA_LIVE_ENABLED !== 'true') {
    console.log(`🧪 [NCBA SANDBOX] Simulating Bulk H2H submission — batch ${payload.BatchReference}, ${payload.TotalCount} item(s), KES ${payload.TotalAmount}`);
    return { BatchReference: payload.BatchReference, AcceptanceStatus: 'ACCEPTED', HostReference: `SIM-${payload.BatchReference}` };
  }

  if (!ncbaApiKey || !ncbaDebitAccount) {
    throw new Error('NCBA is not fully configured (NCBA_API_KEY / NCBA_SETTLEMENT_ACCOUNT missing)');
  }

  const response = await axios.post(
    `${ncbaBaseUrl}/corporate/v1/bulk-payments`,
    payload,
    { headers: { Authorization: `Bearer ${ncbaApiKey}` }, timeout: 20000 }
  );

  return response.data;
}

/**
 * Initiates an NCBA bulk disbursement for a merchant.
 *
 * Balance safety: the merchant's ledger balance is checked and debited in a
 * single atomic conditional update (`kesBalance: { $gte: total }` guarding
 * the `$inc`), so two concurrent bulk-payment requests can never both pass
 * the balance check and jointly overdraw the account.
 *
 * @param {string} merchantId
 * @param {PayoutItem[]} payoutItems
 */
export async function initiateBulkPayment(merchantId, payoutItems) {
  if (!Array.isArray(payoutItems) || payoutItems.length === 0) {
    throw new NcbaPayoutValidationError('payoutItems must be a non-empty array');
  }

  const validatedAmounts = payoutItems.map(validatePayoutItem);
  const totalAmount = Math.round(validatedAmounts.reduce((sum, a) => sum + a, 0) * 100) / 100;

  // Atomically reserve funds — the $gte guard means this either fully
  // succeeds (balance was sufficient) or matches zero documents (it wasn't).
  // No read-then-write gap for a concurrent request to race through.
  const reservedMerchant = await Merchant.findOneAndUpdate(
    { _id: merchantId, kesBalance: { $gte: totalAmount } },
    { $inc: { kesBalance: -totalAmount } },
    { new: true }
  );

  if (!reservedMerchant) {
    const merchant = await Merchant.findById(merchantId);
    throw new InsufficientFundsError(merchantId, totalAmount, merchant?.kesBalance ?? 0);
  }

  const batchReference = `NCBA-BAT-${Date.now()}`;
  const paymentInstructions = payoutItems.map((item, index) => buildPaymentInstruction(item, index));

  const payload = {
    BatchReference: batchReference,
    ValueDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    DebitAccountNumber: ncbaDebitAccount || 'PAYCHAIN_SETTLEMENT_ACCOUNT',
    TotalAmount: totalAmount,
    TotalCount: paymentInstructions.length,
    Payments: paymentInstructions,
  };

  let hostResponse;
  try {
    hostResponse = await submitToNcbaHostToHost(payload);
  } catch (err) {
    // Submission never reached (or was rejected outright by) NCBA — refund
    // the reservation in full since nothing was disbursed.
    await Merchant.findByIdAndUpdate(merchantId, { $inc: { kesBalance: totalAmount } });
    throw err;
  }

  // Persist the ledger rows and the batch summary atomically — either both
  // land or neither does, so the batch total always reconciles against its
  // constituent Transaction rows.
  const session = await mongoose.startSession();
  let batch;
  try {
    await session.withTransaction(async () => {
      const transactionDocs = payoutItems.map((item, index) => ({
        merchantId,
        accountNumber: item.accountNumber,
        type: 'ncba_outbound',
        amount: item.amount,
        kesAmount: item.amount,
        currency: 'KES',
        status: 'pending', // Confirmed asynchronously once NCBA's H2H callback lands.
        reference: paymentInstructions[index].PaymentReference,
        sender: { name: reservedMerchant.businessName, id: ncbaDebitAccount || 'PAYCHAIN_SETTLEMENT_ACCOUNT' },
        recipient: { name: item.name, id: item.accountNumber },
      }));

      const createdTransactions = await Transaction.create(transactionDocs, { session });

      const [createdBatch] = await PayoutBatch.create(
        [
          {
            merchantId,
            batchReference,
            totalGrossAmount: totalAmount,
            totalTaxDeductions: 0,
            totalNetAmount: totalAmount,
            payeeCount: payoutItems.length,
            status: 'Pending',
            fundingSource: 'NCBA Settlement Account',
            transactions: createdTransactions.map((tx, index) => ({
              name: payoutItems[index].name,
              amount: payoutItems[index].amount,
              grossAmount: payoutItems[index].amount,
              method: payoutItems[index].type === 'utility' ? 'NCBA Bill Pay' : 'NCBA Bank Transfer',
              accountReference: payoutItems[index].accountNumber,
              receiptNumber: tx.reference,
              status: 'pending',
            })),
          },
        ],
        { session }
      );

      batch = createdBatch;
    });
  } finally {
    await session.endSession();
  }

  return { batch, hostResponse, totalAmount, merchant: reservedMerchant };
}
