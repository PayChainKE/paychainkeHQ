// Step 3 of 4 (see generate-usdc-issuer.js) — issues real testnet USDC
// from the new issuer account to the master treasury wallet
// (PAYCHAIN_MASTER_SECRET_KEY). This is what actually gives the master
// wallet a spendable balance; establishing a trustline (step 2,
// fix-master-wallet-trustline.js) only grants permission to hold the
// asset, not any units of it.
//
// Issuing a custom Stellar asset is just the issuer account paying out
// units of its own asset code — uncapped, since the issuer is definitionally
// the source of supply. No real money changes hands; this is testnet only.
//
// Run it where USDC_ISSUER_SECRET_KEY and PAYCHAIN_MASTER_SECRET_KEY are
// both set (e.g. the Render shell, once the new issuer's env vars from
// generate-usdc-issuer.js are in place):
//   node backend/scripts/fund-master-wallet-usdc.js [amount]   (default 2000)
import dotenv from 'dotenv';
dotenv.config();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.USDC_ISSUER_SECRET_KEY) die('USDC_ISSUER_SECRET_KEY is not set — run generate-usdc-issuer.js first and set it on this environment.');
if (!process.env.PAYCHAIN_MASTER_SECRET_KEY) die('PAYCHAIN_MASTER_SECRET_KEY is not set.');

const amount = (Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 2000).toFixed(7);

const StellarSdk = await import('@stellar/stellar-sdk');
const { STELLAR_NETWORK, HORIZON_URL, USDC_ASSET_CODE, USDC_ISSUER_ADDRESS, getWalletBalance } = await import('../utils/stellarHelper.js');
if (STELLAR_NETWORK === 'PUBLIC') die('Refusing to run: STELLAR_NETWORK is PUBLIC. This is a testnet-only tool.');

const issuerKeypair = StellarSdk.Keypair.fromSecret(process.env.USDC_ISSUER_SECRET_KEY);
if (issuerKeypair.publicKey() !== USDC_ISSUER_ADDRESS) {
  die(`USDC_ISSUER_SECRET_KEY does not match USDC_ISSUER_ADDRESS (${USDC_ISSUER_ADDRESS}). Double-check both env vars are the new issuer's matching pair.`);
}
const masterPub = StellarSdk.Keypair.fromSecret(process.env.PAYCHAIN_MASTER_SECRET_KEY).publicKey();

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const usdcAsset = new StellarSdk.Asset(USDC_ASSET_CODE, USDC_ISSUER_ADDRESS);
const networkPassphrase = StellarSdk.Networks.TESTNET;

console.log(`\nIssuer:        ${USDC_ISSUER_ADDRESS}`);
console.log(`Master wallet: ${masterPub}`);
console.log(`Amount:        ${amount} ${USDC_ASSET_CODE}\n`);

let issuerAccount;
try {
  issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
} catch (err) {
  die(`Could not load the issuer account: ${err.message}`);
}

let masterAccount;
try {
  masterAccount = await server.loadAccount(masterPub);
} catch (err) {
  die(`Could not load the master account: ${err.message}`);
}
const masterHasTrustline = masterAccount.balances.some(
  (b) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER_ADDRESS
);
if (!masterHasTrustline) {
  die('Master wallet has no trustline to this issuer yet — run fix-master-wallet-trustline.js first.');
}

const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: await server.fetchBaseFee(),
  networkPassphrase,
})
  .addOperation(StellarSdk.Operation.payment({ destination: masterPub, asset: usdcAsset, amount: String(amount) }))
  .setTimeout(30)
  .build();
tx.sign(issuerKeypair);

try {
  await server.submitTransaction(tx);
  console.log('✔ Issued.');
} catch (err) {
  const codes = err.response?.data?.extras?.result_codes;
  die(`Payment failed: ${JSON.stringify(codes) || err.message}`);
}

const balance = await getWalletBalance(masterPub);
console.log(`\nMaster wallet USDC balance is now: ${balance}\n`);
process.exit(0);
