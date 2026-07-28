import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';

// Pure calculation, reused by the /api/trust-score endpoint and by the cash
// advance application flow (both need the same eligibility number).
export async function calculateTrustScore(merchant) {
  const merchantId = merchant._id;
  const createdAt = new Date(merchant.createdAt || Date.now());
  const now = new Date();

  // 1. Fetch all completed inbound transactions — 'inbound' (legacy M-Pesa
  // Paybill path) and 'ncba_inbound' (real NCBA virtual account collections,
  // the live production path) both count as revenue the merchant received.
  const transactions = await Transaction.find({
    merchantId,
    type: { $in: ['inbound', 'ncba_inbound'] },
    status: 'completed'
  }).sort({ createdAt: 1 });

  // === CALCULATE TENURE (Max 20 Points) ===
  // 90 days active = 20 points
  const daysSinceRegistration = Math.max(1, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
  const tenureScoreRaw = (daysSinceRegistration / 90) * 20;
  const tenureScore = Math.min(20, Math.floor(tenureScoreRaw));

  // === CALCULATE FREQUENCY (Max 20 Points) ===
  // Deliberately slow build: every 800 completed transactions adds 5
  // points, capped at the same 20-point ceiling as before (full marks at
  // 3,200 transactions) — real merchant trust should take real volume to
  // earn, not a handful of test payments.
  const totalTransactions = transactions.length;
  const frequencyScore = Math.min(20, Math.floor(totalTransactions / 800) * 5);

  // === CALCULATE VOLUME (Max 30 Points) ===
  // KES 50,000 total volume = 30 points
  const totalVolume = transactions.reduce((sum, tx) => sum + (tx.kesAmount || tx.amount || 0), 0);
  const volumeScoreRaw = (totalVolume / 50000) * 30;
  const volumeScore = Math.min(30, Math.floor(volumeScoreRaw));

  // === CALCULATE CONSISTENCY (Max 30 Points) ===
  // Daily active rate. How many distinct days had transactions?
  const distinctDays = new Set(
    transactions.map(tx => tx.createdAt.toISOString().split('T')[0])
  ).size;

  // To prevent a low score for brand new users who had 1 transaction today (1/1 = 100%),
  // we require at least 7 days of tenure to get consistency points, or we scale it.
  let consistencyScore = 0;
  if (daysSinceRegistration > 0) {
    const activeRate = distinctDays / daysSinceRegistration;
    const consistencyScoreRaw = activeRate * 30;
    consistencyScore = Math.min(30, Math.floor(consistencyScoreRaw));
  }

  // === FINAL SCORE ===
  const totalScore = tenureScore + frequencyScore + volumeScore + consistencyScore;
  // Add a base of 10 points just for registering and KYC (assuming they are here)
  const finalScore = Math.min(100, totalScore + 10);

  const isEligible = finalScore >= 60;

  return {
    current: finalScore,
    eligibleForAdvance: isEligible,
    factors: {
      transactionVolume: Math.round((volumeScore / 30) * 100),
      consistency: Math.round((consistencyScore / 30) * 100),
      revenueGrowth: Math.round((frequencyScore / 20) * 100), // reusing freq for growth metric
      tenure: Math.round((tenureScore / 20) * 100),
    },
    rawMetrics: {
      daysActive: daysSinceRegistration,
      totalTransactions,
      totalVolume
    }
  };
}

// @desc    Get dynamic trust score
// @route   GET /api/trust-score
// @access  Private
export const getTrustScore = async (req, res) => {
  try {
    const result = await calculateTrustScore(req.merchant);
    res.json(result);
  } catch (error) {
    console.error('❌ Error calculating Trust Score:', error);
    res.status(500).json({ error: 'Server Error: Failed to calculate trust score' });
  }
};
