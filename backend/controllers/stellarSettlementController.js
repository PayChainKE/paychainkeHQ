import * as settlement from '../services/stellarSettlementService.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';

// Stellar Instaward round two endpoints. Pilot merchants only (the
// isDemoMerchant accounts) — anyone else gets the same 403 as the other
// Stellar endpoints in transactionController.js. Testnet + simulated B2C.

const notAvailable = (res) => res.status(403).json({ error: 'This feature is not available on your account.' });

const sendError = (res, err, fallback) => {
  if (err instanceof settlement.SettlementError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof DuplicateSubmissionError) return res.status(409).json({ error: err.message });
  console.error(`❌ ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
};

// @route   GET /api/transactions/settlement-rule
export const getRule = async (req, res) => {
  if (!req.merchant.isDemoMerchant) return notAvailable(res);
  res.json({
    success: true,
    rule: settlement.getSettlementRule(req.merchant),
    hasWallet: !!req.merchant.stellarPublicKey,
  });
};

// @route   PUT /api/transactions/settlement-rule   { enabled, stellarSharePercent }
export const updateRule = async (req, res) => {
  try {
    const rule = await settlement.saveSettlementRule(req.merchant._id, {
      enabled: req.body?.enabled,
      stellarSharePercent: req.body?.stellarSharePercent,
    });
    res.json({ success: true, rule });
  } catch (err) {
    sendError(res, err, 'Failed to save settlement rule');
  }
};

// @route   POST /api/transactions/wallet/redeem   { usdcAmount }
export const redeem = async (req, res) => {
  try {
    if (!req.merchant.isDemoMerchant) return notAvailable(res);
    // Same double-click/retry guard as every other money-movement endpoint.
    await claimPayoutSubmission(req.merchant._id, ['stellar-redeem', Number(req.body?.usdcAmount)]);
    const receipt = await settlement.redeemToMpesa({ merchantId: req.merchant._id, usdcAmount: req.body?.usdcAmount });
    res.status(200).json({ success: true, receipt });
  } catch (err) {
    sendError(res, err, 'Failed to process payout');
  }
};

// @route   GET /api/transactions/wallet/reconciliation
export const getReconciliation = async (req, res) => {
  try {
    if (!req.merchant.isDemoMerchant) return notAvailable(res);
    const entries = await settlement.listLedgerEntries(req.merchant._id);
    const completed = entries.filter((e) => e.status === 'completed');
    const sum = (kind, field) => completed.filter((e) => e.kind === kind).reduce((t, e) => t + (e[field] || 0), 0);
    res.json({
      success: true,
      entries,
      totals: {
        settledToStellarUsdc: sum('split_settlement', 'usdcAmount'),
        settledToStellarKes: sum('split_settlement', 'kesAmount'),
        redeemedUsdc: sum('redemption', 'usdcAmount'),
        redeemedKes: sum('redemption', 'kesAmount'),
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to load reconciliation');
  }
};

// @route   GET /api/transactions/wallet/reconciliation.csv
export const downloadReconciliationCsv = async (req, res) => {
  try {
    if (!req.merchant.isDemoMerchant) return notAvailable(res);
    const entries = await settlement.listLedgerEntries(req.merchant._id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paychain-stellar-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(settlement.ledgerToCsv(entries));
  } catch (err) {
    sendError(res, err, 'Failed to export reconciliation');
  }
};
