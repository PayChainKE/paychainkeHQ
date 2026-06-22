/**
 * check-activations.js
 * Standalone CLI audit script — run with: node check-activations.js
 * Cross-references all registered PayChain merchants against the live Stellar Testnet ledger.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import * as StellarSdk from '@stellar/stellar-sdk';
import Merchant from './models/Merchant.js';

const USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET_CODE = 'USDC';
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

const auditWallet = async (merchant) => {
  if (!merchant.stellarPublicKey) {
    return {
      Name: merchant.businessName,
      'Public Key': 'N/A',
      Status: 'No Wallet',
      'XLM Balance': '-',
      'USDC Balance': '-',
    };
  }

  try {
    const account = await server.loadAccount(merchant.stellarPublicKey);
    const xlm = account.balances.find(b => b.asset_type === 'native');
    const usdc = account.balances.find(
      b => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_TESTNET_ISSUER
    );

    return {
      Name: merchant.businessName,
      'Public Key': `${merchant.stellarPublicKey.slice(0, 6)}...${merchant.stellarPublicKey.slice(-4)}`,
      Status: xlm && usdc ? '✅ Active' : '⚠️  Inactive',
      'XLM Balance': xlm?.balance ?? '0',
      'USDC Balance': usdc?.balance ?? '0',
    };
  } catch (err) {
    return {
      Name: merchant.businessName,
      'Public Key': `${merchant.stellarPublicKey.slice(0, 6)}...${merchant.stellarPublicKey.slice(-4)}`,
      Status: err.response?.status === 404 ? '❌ Unfunded' : '🔴 Error',
      'XLM Balance': '-',
      'USDC Balance': '-',
    };
  }
};

const run = async () => {
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected.\n');

  const merchants = await Merchant.find({}).select('businessName stellarPublicKey');
  console.log(`🌐 Auditing ${merchants.length} merchants against Stellar Testnet Horizon...\n`);

  const rows = await Promise.all(merchants.map(auditWallet));

  console.table(rows);

  const active = rows.filter(r => r.Status.includes('Active')).length;
  const totalUsdc = rows.reduce((sum, r) => {
    const balance = r['USDC Balance'];
    return sum + (balance === '-' ? 0 : parseFloat(balance || 0));
  }, 0);

  console.log(`\n📊 Summary:`);
  console.log(`   Total Merchants  : ${merchants.length}`);
  console.log(`   Active Wallets   : ${active}`);
  console.log(`   Platform USDC    : ${totalUsdc.toFixed(7)} USDC`);
  console.log(`\n✅ Audit complete.\n`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Fatal audit error:', err.message);
  process.exit(1);
});
