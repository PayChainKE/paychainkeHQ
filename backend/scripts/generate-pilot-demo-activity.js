// Generates a small amount of REAL activity (real Stellar testnet
// transactions, real StellarExpert hashes) tied to the actual five named
// Instaward pilot merchants created by create-stellar-pilot-merchants.js —
// not the stress test's throwaway local accounts. Run this once those five
// exist, so an evaluator looking up e.g. "Wanjiku Fresh Greens" by name has
// real on-chain history, not an empty new account.
//
// Reuses the exact same production code paths real traffic uses —
// creditNcbaCollection (the real ledger credit function; this is what
// triggers the settlement split automatically, via the same hook a real
// NCBA webhook fires) and redeemToMpesa (the same function the demo app's
// "Request Payout" button calls) — nothing here is a separate mock/fake
// path. Hardcoded to the five known pilot business names only; refuses to
// touch anything else, by construction, so this can never be pointed at a
// real merchant by mistake.
//
//   Preview (writes nothing):
//     node backend/scripts/generate-pilot-demo-activity.js
//   Actually run it:
//     node backend/scripts/generate-pilot-demo-activity.js --yes
import dotenv from 'dotenv';
dotenv.config();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');
if (String(process.env.STELLAR_NETWORK || 'TESTNET').toUpperCase() === 'PUBLIC') die('Refusing to run: STELLAR_NETWORK is PUBLIC. This is testnet-only.');

// businessName must match create-stellar-pilot-merchants.js's PILOTS array
// exactly. payAmount is a realistic incoming M-Pesa collection to credit
// before the split; redeemUsdc (if set) is a payout attempted afterward —
// modest amounts, this is evidence, not another stress test.
const PLAN = [
  { businessName: 'Wanjiku Fresh Greens Ltd',             payAmount: 2500, redeemUsdc: 3 },
  { businessName: 'Kilimani Brew House',                  payAmount: 4800, redeemUsdc: 10 },
  { businessName: 'Pwani Fresh Fish Traders',              payAmount: 6200, redeemUsdc: null },
  { businessName: 'Rift Valley Dairy Cooperative',          payAmount: 3100, redeemUsdc: null },
  { businessName: 'Lakeside Hardware & Building Supplies', payAmount: 1800, redeemUsdc: null }, // control: rule is off
];

const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');
const { default: StellarLedgerEntry } = await import('../models/StellarLedgerEntry.js');
const { creditNcbaCollection } = await import('../services/ncbaLedgerService.js');
const { redeemToMpesa, explorerTxUrl } = await import('../services/stellarSettlementService.js');

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';

const merchants = [];
for (const p of PLAN) {
  const m = await Merchant.findOne({ businessName: p.businessName, isDemoMerchant: true });
  if (!m) { console.log(`  ✖ "${p.businessName}" not found (isDemoMerchant: true) — run create-stellar-pilot-merchants.js --yes first.`); continue; }
  merchants.push({ plan: p, merchant: m });
}
if (merchants.length === 0) die('None of the five pilot merchants exist yet.');

console.log(`\n${args.yes ? 'RUNNING' : 'PREVIEW (nothing will be written)'} on ${dbHost}\n`);
merchants.forEach(({ plan, merchant }) => {
  console.log(`  ${merchant.businessName} — credit KES ${plan.payAmount}${plan.redeemUsdc ? `, then redeem ${plan.redeemUsdc} USDC` : ''} (rule: ${merchant.settlementRule?.enabled ? `${merchant.settlementRule.stellarSharePercent}%` : 'OFF — control'})`);
});
if (!args.yes) { console.log('\nPreview only. Re-run with --yes to actually send these.\n'); process.exit(0); }

async function waitTerminal(sourceReference, ms = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = await StellarLedgerEntry.findOne({ kind: 'split_settlement', sourceReference }).lean();
    if (e && e.status !== 'pending') return e;
    await new Promise((r) => setTimeout(r, 500));
  }
  return StellarLedgerEntry.findOne({ kind: 'split_settlement', sourceReference }).lean();
}

const evidenceRows = [];
for (const { plan, merchant } of merchants) {
  const bankRef = `PILOT-DEMO-${merchant._id}-${Date.now()}`;
  console.log(`\n→ ${merchant.businessName}: crediting KES ${plan.payAmount} (ref ${bankRef})`);
  let credited;
  try {
    credited = await creditNcbaCollection({ merchant, grossAmount: plan.payAmount, bankRef });
  } catch (err) {
    console.log(`  ✖ credit failed: ${err.message}`);
    continue;
  }
  console.log(`  net credited: KES ${credited.netAmount}`);

  if (!merchant.settlementRule?.enabled) {
    console.log('  rule is off — control account, no split expected.');
    continue;
  }

  const entry = await waitTerminal(bankRef);
  if (!entry) { console.log('  ✖ no settlement entry appeared within 60s.'); continue; }
  console.log(`  split: ${entry.status} — KES ${entry.kesAmount} -> ${entry.usdcAmount} USDC${entry.stellarTxHash ? ` — ${entry.stellarTxHash}` : ''}`);
  if (entry.status === 'completed' && entry.stellarTxHash) {
    evidenceRows.push({ business: merchant.businessName, kind: 'split_settlement', usdc: entry.usdcAmount, hash: entry.stellarTxHash });
  }

  if (plan.redeemUsdc && entry.status === 'completed') {
    console.log(`  redeeming ${plan.redeemUsdc} USDC to M-Pesa (simulated)...`);
    try {
      const redemption = await redeemToMpesa({ merchantId: merchant._id, usdcAmount: plan.redeemUsdc });
      console.log(`  redemption: KES ${redemption.kesEquivalent} — ${redemption.stellarTxHash}`);
      evidenceRows.push({ business: merchant.businessName, kind: 'redemption', usdc: plan.redeemUsdc, hash: redemption.stellarTxHash });
    } catch (err) {
      console.log(`  ✖ redemption failed: ${err.message}`);
    }
  }
}

console.log('\n\n--- Paste below into docs/stellar-instaward-round2.md ---\n');
console.log('## Named pilot merchant activity\n');
evidenceRows.forEach((r) => {
  console.log(`- ${r.business} · ${r.kind} · ${r.usdc} USDC · [${r.hash}](${explorerTxUrl(r.hash)})`);
});

process.exit(0);
