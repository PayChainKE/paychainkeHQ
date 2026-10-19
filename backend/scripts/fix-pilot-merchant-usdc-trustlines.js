// Step 4 of 4 (see generate-usdc-issuer.js) — every demo/pilot merchant
// wallet already has a trustline to the OLD USDC issuer (established when
// create-stellar-pilot-merchants.js provisioned it), which is now a
// different asset entirely from the new issuer's "USDC" — same asset code,
// different issuer, not fungible with each other on Stellar. A settlement
// split paying out the new issuer's USDC to a pilot wallet that only
// trusts the old issuer would fail with op_no_trust on the destination
// side, the mirror image of the master wallet's own op_src_no_trust.
//
// This re-trusts every isDemoMerchant wallet to whatever USDC_ISSUER_ADDRESS
// currently points at. Idempotent — a wallet that already trusts the
// current issuer is skipped. Scoped to isDemoMerchant only, by construction
// (real merchants don't have Stellar wallets in this feature at all).
//
// Run it where the real MONGO_URI is set (e.g. the Render shell), after
// USDC_ISSUER_ADDRESS has been updated to the new issuer and deployed:
//   node backend/scripts/fix-pilot-merchant-usdc-trustlines.js
import dotenv from 'dotenv';
dotenv.config();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');

const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');
const { decryptKey } = await import('../utils/cryptoHelper.js');
const StellarSdk = await import('@stellar/stellar-sdk');
const { STELLAR_NETWORK, HORIZON_URL, USDC_ASSET_CODE, USDC_ISSUER_ADDRESS } = await import('../utils/stellarHelper.js');
if (STELLAR_NETWORK === 'PUBLIC') die('Refusing to run: STELLAR_NETWORK is PUBLIC. This is a testnet-only tool.');

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const usdcAsset = new StellarSdk.Asset(USDC_ASSET_CODE, USDC_ISSUER_ADDRESS);
const networkPassphrase = StellarSdk.Networks.TESTNET;

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';
console.log(`\nConnected to ${dbHost}. Target issuer: ${USDC_ISSUER_ADDRESS}\n`);

const merchants = await Merchant.find({ isDemoMerchant: true, stellarPublicKey: { $exists: true, $ne: null } })
  .select('+stellarEncryptedSecretKey businessName stellarPublicKey');

if (merchants.length === 0) { console.log('No demo merchants with a Stellar wallet found.'); process.exit(0); }

for (const m of merchants) {
  if (!m.stellarEncryptedSecretKey) { console.log(`  ✖ ${m.businessName}: no secret key on record, skipping`); continue; }
  try {
    const account = await server.loadAccount(m.stellarPublicKey);
    const alreadyTrusts = account.balances.some(
      (b) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER_ADDRESS
    );
    if (alreadyTrusts) { console.log(`  ✔ ${m.businessName}: already trusts this issuer`); continue; }

    const keypair = StellarSdk.Keypair.fromSecret(decryptKey(m.stellarEncryptedSecretKey));
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: await server.fetchBaseFee(),
      networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);
    await server.submitTransaction(tx);
    console.log(`  ✔ ${m.businessName}: trustline established`);
  } catch (err) {
    const codes = err.response?.data?.extras?.result_codes;
    console.log(`  ✖ ${m.businessName}: ${JSON.stringify(codes) || err.message}`);
  }
}

process.exit(0);
