import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';

// Pure calculation, reused by the /api/trust-score endpoint and by the cash
// advance application flow (both need the same eligibility number).
//
// Score is purely transaction-count-driven: 2 points for every 100
// completed transactions, capped at 80 (never reaches the full 100-point
// scale — building stops once a merchant hits the cap, however much more
// volume they process). Only 'inbound' (legacy M-Pesa Paybill path) and
// 'ncba_inbound' (real NCBA virtual account collections, the live
// production path) count — real revenue the merchant actually received,
// not any ledger entry.
export async function calculateTrustScore(merchant) {
  const merchantId = merchant._id;

  const totalTransactions = await Transaction.countDocuments({
    merchantId,
    type: { $in: ['inbound', 'ncba_inbound'] },
    status: 'completed'
  });

  const finalScore = Math.min(80, Math.floor(totalTransactions / 100) * 2);

  const isEligible = finalScore >= 60;

  return {
    current: finalScore,
    eligibleForAdvance: isEligible,
    rawMetrics: {
      totalTransactions
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
