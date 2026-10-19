// Step 1 of 4 in recovering from the master wallet's USDC problem
// (2026-10-19): the previously-configured USDC_ISSUER_ADDRESS
// (GD5V4BJ75GLB...) is a custom test asset, not Circle's official testnet
// USDC — and nobody has a record of that issuer's secret key anywhere in
// this codebase or its history, so there's no way to mint more of it. This
// generates a brand-new issuer account PayChain fully controls going
// forward, funded with testnet XLM via Friendbot so it can actually submit
// transactions (issuing a custom asset itself costs no XLM beyond normal
// fees — issuance is just the issuer account paying out units of its own
// asset code, uncapped).
//
// Run it anywhere with network access — no MONGO_URI or other PayChain env
// vars needed, this never touches the database. Safe to run from this
// sandbox or the Render shell.
//
//   node backend/scripts/generate-usdc-issuer.js

const StellarSdk = await import('@stellar/stellar-sdk');

const pair = StellarSdk.Keypair.random();
const publicKey = pair.publicKey();
const secretKey = pair.secret();

console.log(`\nNew USDC issuer keypair generated.\n`);
console.log(`  Public key (USDC_ISSUER_ADDRESS):      ${publicKey}`);
console.log(`  Secret key (USDC_ISSUER_SECRET_KEY):   ${secretKey}\n`);

console.log('Funding via Friendbot (testnet XLM, so this account can submit transactions)...');
try {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`Friendbot returned ${res.status}`);
  console.log('✔ Funded.\n');
} catch (err) {
  console.error(`✖ Friendbot funding failed: ${err.message}`);
  console.error('  The account still exists as a keypair, but has no XLM yet — fund it manually at https://friendbot.stellar.org before continuing.\n');
}

console.log('Next steps:');
console.log('  1. In Render, set these two environment variables on the backend service:');
console.log(`       USDC_ISSUER_ADDRESS=${publicKey}`);
console.log(`       USDC_ISSUER_SECRET_KEY=${secretKey}`);
console.log('     (USDC_ISSUER_SECRET_KEY is new — only this one issuer account needs it, to mint/send USDC later.)');
console.log('  2. Wait for Render to redeploy with the new env vars.');
console.log('  3. Run: node backend/scripts/fix-master-wallet-trustline.js   (re-establishes the master wallet\'s trustline, now against this new issuer)');
console.log('  4. Run: node backend/scripts/fund-master-wallet-usdc.js       (issues real testnet USDC to the master wallet)');
console.log('  5. Run: node backend/scripts/fix-pilot-merchant-usdc-trustlines.js   (re-trusts the 5 pilot wallets to this new issuer)');
console.log('  6. Retry: node backend/scripts/generate-pilot-demo-activity.js --yes\n');

process.exit(0);
