import * as StellarSdk from '@stellar/stellar-sdk';
import Merchant from '../models/Merchant.js';
import { HORIZON_URL, USDC_ASSET_CODE, USDC_ISSUER_ADDRESS, STELLAR_NETWORK } from '../utils/stellarHelper.js';

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// Discrepancies smaller than this are floating-point noise, not a real
// mismatch between MongoDB's recorded balance and the on-chain balance.
const DISCREPANCY_EPSILON = 0.0001;

/**
 * Audits a single merchant's public key against the live Stellar Horizon ledger,
 * and reconciles the on-chain USDC balance against what MongoDB has recorded —
 * that comparison is the actual point of an "audit" and was previously missing
 * entirely (the page only ever showed the live chain number, never checked it
 * against our own records).
 * @param {object} merchant - Mongoose merchant document
 * @returns {object} Structured audit record
 */
const auditSingleWallet = async (merchant) => {
  const dbUsdcBalance = merchant.usdcBalance || 0;

  const baseRecord = {
    name: merchant.businessName || 'N/A',
    email: merchant.email || 'N/A',
    publicKey: merchant.stellarPublicKey || null,
    status: 'No Wallet',
    xlmBalance: '0.0000000',
    usdcBalance: '0.0000000',
    dbUsdcBalance,
    usdcDiscrepancy: -dbUsdcBalance,
    hasDiscrepancy: Math.abs(dbUsdcBalance) > DISCREPANCY_EPSILON,
    lastActiveTime: null,
    registeredAt: merchant.createdAt,
  };

  // If merchant has never activated a wallet, return immediately
  if (!merchant.stellarPublicKey) {
    return baseRecord;
  }

  try {
    const account = await server.loadAccount(merchant.stellarPublicKey);

    // Extract XLM (native) balance
    const xlmEntry = account.balances.find(b => b.asset_type === 'native');
    const xlmBalance = xlmEntry ? xlmEntry.balance : '0.0000000';

    // Extract USDC balance if trustline exists
    const usdcEntry = account.balances.find(
      b =>
        b.asset_type === 'credit_alphanum4' &&
        b.asset_code === USDC_ASSET_CODE &&
        b.asset_issuer === USDC_ISSUER_ADDRESS
    );

    const usdcBalance = usdcEntry ? usdcEntry.balance : '0.0000000';
    const chainUsdcBalance = parseFloat(usdcBalance) || 0;
    const usdcDiscrepancy = chainUsdcBalance - dbUsdcBalance;

    // A wallet is "Active" if it has XLM gas AND an open USDC trustline
    const isFullyActive = !!xlmEntry && !!usdcEntry;

    return {
      ...baseRecord,
      status: isFullyActive ? 'Active' : 'Inactive',
      xlmBalance,
      usdcBalance,
      usdcDiscrepancy,
      hasDiscrepancy: Math.abs(usdcDiscrepancy) > DISCREPANCY_EPSILON,
      lastActiveTime: account.last_modified_time || null,
    };
  } catch (err) {
    // Stellar Horizon returns 404 for unfunded/nonexistent accounts
    if (err.response?.status === 404) {
      return { ...baseRecord, status: 'Unfunded' };
    }
    console.error(`⚠️ Audit error for ${merchant.stellarPublicKey}: ${err.message}`);
    // Unknown chain state — don't claim a discrepancy we can't actually verify.
    return { ...baseRecord, status: 'Error', hasDiscrepancy: false };
  }
};

// @desc    Cross-reference all merchant wallets against the live Stellar Horizon ledger
// @route   GET /api/admin/wallet-audit
// @access  Private (Admin)
export const runWalletAudit = async (req, res) => {
  try {
    // 1. Pull all merchants from MongoDB (exclude sensitive fields)
    const merchants = await Merchant.find({})
      .select('businessName email stellarPublicKey createdAt usdcBalance')
      .sort('-createdAt');

    console.log(`\n🔍 Starting Stellar Wallet Audit for ${merchants.length} merchants...\n`);

    // 2. Audit each wallet against the live Horizon API in parallel
    const auditResults = await Promise.all(
      merchants.map(merchant => auditSingleWallet(merchant))
    );

    // 3. Build summary statistics
    const totalMerchants = auditResults.length;
    const activeWallets = auditResults.filter(r => r.status === 'Active').length;
    const inactiveWallets = auditResults.filter(r => r.status === 'Inactive').length;
    const noWallet = auditResults.filter(r => r.status === 'No Wallet').length;
    const errorCount = auditResults.filter(r => r.status === 'Error').length;
    const discrepancyCount = auditResults.filter(r => r.hasDiscrepancy).length;
    // 4-decimal precision matches the on-chain USDC display convention.
    const totalUsdcFloat = auditResults
      .reduce((sum, r) => sum + parseFloat(r.usdcBalance || 0), 0)
      .toFixed(4);

    // Fetch aggregate transaction volumes
    const { default: Transaction } = await import('../models/Transaction.js');
    const KES_VOL_REAL = {
      $ifNull: ['$kesAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, 0, '$amount'] }]
    };
    
    const USDC_VOL_REAL = {
      $ifNull: ['$usdcAmount', { $cond: [{ $eq: ['$currency', 'USDC'] }, '$amount', 0] }]
    };

    const volumeAgg = await Transaction.aggregate([
      { $match: { status: { $in: ['completed', 'verified'] } } },
      { $group: { _id: null, kesVolume: { $sum: KES_VOL_REAL }, usdcVolume: { $sum: USDC_VOL_REAL } } }
    ]);

    const totalKesVolume = volumeAgg[0]?.kesVolume || 0;
    const totalUsdcVolume = volumeAgg[0]?.usdcVolume || 0;

    // Fetch lifetime volumes per merchant
    const merchantVols = await Transaction.aggregate([
      { $match: { status: { $in: ['completed', 'verified'] }, merchantId: { $ne: null } } },
      { $group: { _id: '$merchantId', kesVolume: { $sum: KES_VOL_REAL }, usdcVolume: { $sum: USDC_VOL_REAL } } }
    ]);
    const volMap = new Map();
    merchantVols.forEach(v => volMap.set(v._id.toString(), v));

    // Map volumes back into auditResults
    const enrichedAuditResults = auditResults.map((r, i) => {
      const merchantId = merchants[i]._id.toString();
      const vols = volMap.get(merchantId) || { kesVolume: 0, usdcVolume: 0 };
      return {
        ...r,
        merchantId,
        lifetimeKesVolume: vols.kesVolume,
        lifetimeUsdcVolume: vols.usdcVolume
      };
    });

    // 4. Emit clean console.table for CLI script usage
    console.table(
      enrichedAuditResults.map(r => ({
        Name: r.name,
        'Public Key': r.publicKey ? `${r.publicKey.slice(0, 6)}...${r.publicKey.slice(-4)}` : 'N/A',
        Status: r.status,
        'XLM Balance': r.xlmBalance,
        'USDC Balance': r.usdcBalance,
      }))
    );

    console.log(`\n✅ Audit Complete. Active: ${activeWallets} | Inactive: ${inactiveWallets} | No Wallet: ${noWallet}\n`);

    res.status(200).json({
      success: true,
      summary: {
        totalMerchants,
        activeWallets,
        inactiveWallets,
        noWallet,
        errorCount,
        discrepancyCount,
        totalUsdcFloat,
        totalKesVolume,
        totalUsdcVolume,
        // 'PUBLIC' -> mainnet explorer path, anything else -> testnet.
        network: STELLAR_NETWORK === 'PUBLIC' ? 'public' : 'testnet',
        auditedAt: new Date().toISOString(),
      },
      data: enrichedAuditResults,
    });
  } catch (error) {
    console.error('❌ Wallet Audit Controller Error:', error.message);
    res.status(500).json({ error: 'Server Error: Wallet audit failed.' });
  }
};
