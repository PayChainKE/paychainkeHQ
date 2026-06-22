import * as StellarSdk from '@stellar/stellar-sdk';
import Merchant from '../models/Merchant.js';

// Circle's official USDC issuer on Stellar Testnet
const USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET_CODE = 'USDC';
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Audits a single merchant's public key against the live Stellar Horizon ledger.
 * Returns a structured audit record regardless of on-chain status.
 * @param {object} merchant - Mongoose merchant document
 * @returns {object} Structured audit record
 */
const auditSingleWallet = async (merchant) => {
  const baseRecord = {
    name: merchant.businessName || 'N/A',
    email: merchant.email || 'N/A',
    publicKey: merchant.stellarPublicKey || null,
    status: 'No Wallet',
    xlmBalance: '0.0000000',
    usdcBalance: '0.0000000',
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
        b.asset_issuer === USDC_TESTNET_ISSUER
    );

    const usdcBalance = usdcEntry ? usdcEntry.balance : '0.0000000';

    // A wallet is "Active" if it has XLM gas AND an open USDC trustline
    const isFullyActive = !!xlmEntry && !!usdcEntry;

    return {
      ...baseRecord,
      status: isFullyActive ? 'Active' : 'Inactive',
      xlmBalance,
      usdcBalance,
      lastActiveTime: account.last_modified_time || null,
    };
  } catch (err) {
    // Stellar Horizon returns 404 for unfunded/nonexistent accounts
    if (err.response?.status === 404) {
      return { ...baseRecord, status: 'Unfunded' };
    }
    console.error(`⚠️ Audit error for ${merchant.stellarPublicKey}: ${err.message}`);
    return { ...baseRecord, status: 'Error' };
  }
};

// @desc    Cross-reference all merchant wallets against the live Stellar Horizon ledger
// @route   GET /api/admin/wallet-audit
// @access  Private (Admin)
export const runWalletAudit = async (req, res) => {
  try {
    // 1. Pull all merchants from MongoDB (exclude sensitive fields)
    const merchants = await Merchant.find({})
      .select('businessName email stellarPublicKey createdAt')
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
    const totalUsdcFloat = auditResults
      .reduce((sum, r) => sum + parseFloat(r.usdcBalance || 0), 0)
      .toFixed(7);

    // 4. Emit clean console.table for CLI script usage
    console.table(
      auditResults.map(r => ({
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
        totalUsdcFloat,
        auditedAt: new Date().toISOString(),
      },
      data: auditResults,
    });
  } catch (error) {
    console.error('❌ Wallet Audit Controller Error:', error.message);
    res.status(500).json({ error: 'Server Error: Wallet audit failed.' });
  }
};
