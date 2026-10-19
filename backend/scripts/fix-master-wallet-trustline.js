// Diagnoses and fixes "op_src_no_trust" on settlement splits — the master
// treasury wallet (PAYCHAIN_MASTER_SECRET_KEY) that sends USDC out to every
// pilot merchant doesn't currently have a trustline to the USDC asset, so
// it can never hold or send USDC at all. Surfaced 2026-10-19 running
// generate-pilot-demo-activity.js against production for real for the
// first time since the 2026-09-21 stress test, which ran its own separate
// local master wallet — this is the first time the REAL production
// PAYCHAIN_MASTER_SECRET_KEY account has been exercised end-to-end.
//
// Establishing a trustline is safe and idempotent (skipped if one already
// exists) and costs a small XLM reserve, nothing else. It does NOT give
// the wallet any USDC balance — a trustline is just permission to hold the
// asset. If the balance comes back 0 after this, the wallet still needs
// real testnet USDC sent to it from somewhere (however it was funded for
// the original Round One build) before any split/redeem will actually
// move USDC.
//
// Run it where the real PAYCHAIN_MASTER_SECRET_KEY is set (e.g. the Render
// shell): node backend/scripts/fix-master-wallet-trustline.js
import dotenv from 'dotenv';
dotenv.config();

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.PAYCHAIN_MASTER_SECRET_KEY) die('PAYCHAIN_MASTER_SECRET_KEY is not set.');

const StellarSdk = await import('@stellar/stellar-sdk');
const {
  STELLAR_NETWORK, HORIZON_URL, USDC_ASSET_CODE, USDC_ISSUER_ADDRESS, getWalletBalance,
} = await import('../utils/stellarHelper.js');

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const usdcAsset = new StellarSdk.Asset(USDC_ASSET_CODE, USDC_ISSUER_ADDRESS);
const networkPassphrase = STELLAR_NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;
if (STELLAR_NETWORK === 'PUBLIC') die('Refusing to run: STELLAR_NETWORK is PUBLIC. This is a testnet-only tool.');

const masterKeypair = StellarSdk.Keypair.fromSecret(process.env.PAYCHAIN_MASTER_SECRET_KEY);
const masterPub = masterKeypair.publicKey();
console.log(`\nMaster wallet: ${masterPub}`);
console.log(`USDC issuer:   ${USDC_ISSUER_ADDRESS}`);
console.log(`Network:       ${STELLAR_NETWORK} (${HORIZON_URL})\n`);

let account;
try {
  account = await server.loadAccount(masterPub);
} catch (err) {
  die(`Could not load the master account from Horizon: ${err.message}. It may not exist/be funded on this network.`);
}

const hasTrustline = account.balances.some(
  (b) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER_ADDRESS
);

if (hasTrustline) {
  console.log('✔ Trustline already exists — this was not the problem, or it has already been fixed.');
} else {
  console.log('✖ No USDC trustline found. Establishing one now...');
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: await server.fetchBaseFee(),
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(30)
    .build();
  tx.sign(masterKeypair);
  try {
    await server.submitTransaction(tx);
    console.log('✔ Trustline established.');
  } catch (err) {
    const codes = err.response?.data?.extras?.result_codes;
    die(`Trustline transaction failed: ${JSON.stringify(codes) || err.message}`);
  }
}

const xlmBalance = account.balances.find((b) => b.asset_type === 'native')?.balance || '0';
const usdcBalance = await getWalletBalance(masterPub);
console.log(`\nXLM balance:  ${xlmBalance}`);
console.log(`USDC balance: ${usdcBalance}`);

if (usdcBalance <= 0) {
  console.log(
    '\n⚠ USDC balance is 0. The trustline fix alone does NOT give it any USDC — nothing can be settled/redeemed ' +
    'until this wallet actually holds testnet USDC. If you know how the Round One wallet was originally funded ' +
    '(a testnet USDC faucet, or a transfer from an account you control), repeat that for this address: ' + masterPub
  );
}

process.exit(0);
