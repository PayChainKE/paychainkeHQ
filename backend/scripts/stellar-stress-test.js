// Stellar Instaward round two — pilot stress test.
//
// Runs 50 operations across 5 separate Stellar pilot merchants against the
// real backend code (creditNcbaCollection -> settlement split, and the
// Request Payout / redemption service), injects the failure cases the
// deliverable calls out (low balance, RPC timeout, an underfunded master
// wallet), then checks the money invariants and writes a report with the
// StellarExpert links.
//
//   Usage (from repo root):
//     MONGO_URI=mongodb://127.0.0.1:27017/stellar_stress?replicaSet=rs \
//       node backend/scripts/stellar-stress-test.js --mode=mock
//     ... --mode=live --out=stress-report.md      (real Stellar TESTNET)
//
//   --mode=mock  (default) in-memory fake ledger, no network
//   --mode=live  real Stellar testnet: provisions 5 fresh wallets (Friendbot),
//                needs PAYCHAIN_MASTER_SECRET_KEY / USDC_ISSUER_ADDRESS /
//                ENCRYPTION_MASTER_KEY in the environment
//
// SAFETY: it creates and modifies merchants, so it refuses to run against any
// database that is not on localhost. It never sends SMS, never touches NCBA,
// and the M-Pesa B2C leg is the simulated payload only.
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const MODE = args.mode === 'live' ? 'live' : 'mock';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

// Refuse anything but a local database — .env may point at production.
const mongoUri = process.env.STRESS_MONGO_URI || process.env.MONGO_URI || '';
const host = (mongoUri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/:?,]+)/) || [])[1];
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`REFUSING to run: the database host "${host || 'unknown'}" is not localhost. ` +
    'Point STRESS_MONGO_URI at a throwaway local database (a replica set is needed for transactions).');
  process.exit(1);
}
process.env.MONGO_URI = mongoUri;

const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');
const { default: StellarLedgerEntry } = await import('../models/StellarLedgerEntry.js');
const { default: Transaction } = await import('../models/Transaction.js');
const settlement = await import('../services/stellarSettlementService.js');
const { creditNcbaCollection, DuplicateCollectionError } = await import('../services/ncbaLedgerService.js');
const stellar = await import('../utils/stellarHelper.js');
const { encryptKey } = await import('../utils/cryptoHelper.js');

const RUN_ID = crypto.randomBytes(3).toString('hex');
const results = [];       // per-operation log
const failures = [];      // invariant failures
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`); return ok; };

// ── Fault injection (both modes) ────────────────────────────────────────
const inject = { settle: null, sweep: null };

// ── Chain layer ─────────────────────────────────────────────────────────
const fake = { masterUsdc: 1_000_000, wallets: new Map(), keyToPub: new Map(), txs: 0 };
const fakeHash = () => crypto.randomBytes(32).toString('hex');
const never = () => new Promise(() => {});

const realDeps = { settle: stellar.settleInflationShield, sweep: stellar.swapUsdcToKesOnChain, balance: stellar.getWalletBalance };
const mockDeps = {
  rate: async () => 1 / 130,
  settle: async (pub, amount) => {
    await sleep(20);
    if (Number(amount) > fake.masterUsdc) throw new Error('Master wallet has insufficient USDC balance.');
    fake.masterUsdc -= Number(amount);
    fake.wallets.set(pub, (fake.wallets.get(pub) || 0) + Number(amount));
    fake.txs++;
    return fakeHash();
  },
  sweep: async (encKey, amount) => {
    await sleep(20);
    const pub = fake.keyToPub.get(encKey);
    if ((fake.wallets.get(pub) || 0) < Number(amount)) throw new Error('Merchant wallet has insufficient USDC to sweep.');
    fake.wallets.set(pub, fake.wallets.get(pub) - Number(amount));
    fake.masterUsdc += Number(amount);
    fake.txs++;
    return fakeHash();
  },
  balance: async (pub) => fake.wallets.get(pub) || 0,
};

const base = MODE === 'live' ? realDeps : mockDeps;
settlement.__setStellarDeps({
  ...(MODE === 'live' ? { rate: async () => 1 / 130 } : {}),   // fixed rate: reproducible statements
  ...base,
  settle: async (...a) => {
    if (inject.settle === 'timeout') { inject.settle = null; return never(); }
    if (inject.settle === 'underfunded') { inject.settle = null; throw new Error('Master wallet has insufficient USDC balance.'); }
    return base.settle(...a);
  },
  sweep: async (...a) => {
    if (inject.sweep === 'timeout') { inject.sweep = null; return never(); }
    return base.sweep(...a);
  },
});

// ── Setup: 5 pilot merchants ────────────────────────────────────────────
console.log(`\nStellar stress test — mode=${MODE}, run=${RUN_ID}, db=${host}\n`);
await mongoose.connect(mongoUri);
await Promise.all([Merchant.init(), StellarLedgerEntry.init(), Transaction.init()]);

const PLAN = [ // [pct, enabled]
  { pct: 20, enabled: true },
  { pct: 50, enabled: true },
  { pct: 80, enabled: true },
  { pct: 20, enabled: true },
  { pct: 0, enabled: false }, // control: rule off, must never settle
];

if (MODE === 'live') {
  const masterPub = stellar.STELLAR_NETWORK && process.env.PAYCHAIN_MASTER_SECRET_KEY
    ? (await import('@stellar/stellar-sdk')).Keypair.fromSecret(process.env.PAYCHAIN_MASTER_SECRET_KEY).publicKey()
    : null;
  if (!masterPub) { console.error('Live mode needs PAYCHAIN_MASTER_SECRET_KEY.'); process.exit(1); }
  const masterUsdc = await stellar.getWalletBalance(masterPub);
  console.log(`Master wallet USDC: ${masterUsdc}`);
  if (masterUsdc < 500) { console.error('Master wallet holds too little testnet USDC for the run (need ~500).'); process.exit(1); }
}

const merchants = [];
for (let i = 0; i < PLAN.length; i++) {
  let publicKey; let enc;
  if (MODE === 'live') {
    const w = await stellar.provisionMerchantWallet();
    publicKey = w.publicKey; enc = encryptKey(w.secretKey);
  } else {
    publicKey = `G${RUN_ID.toUpperCase()}MOCKWALLET${i}`.padEnd(56, 'X');
    enc = `ENC_${publicKey}`;
    fake.keyToPub.set(enc, publicKey);
  }
  const m = await Merchant.create({
    name: `Stress Pilot ${i + 1}`, email: `stress-${RUN_ID}-${i}@example.test`,
    phone: `+25470${RUN_ID.replace(/[^0-9]/g, '1').padEnd(3, '1').slice(0, 3)}${String(i).padStart(4, '0')}`,
    password: 'Str3ss!Passw0rd-long', businessName: `Stress Pilot Ltd ${i + 1}`,
    isDemoMerchant: true, stellarPublicKey: publicKey, stellarEncryptedSecretKey: enc,
    settlementRule: { enabled: PLAN[i].enabled, stellarSharePercent: PLAN[i].pct },
  });
  merchants.push({ id: m._id, doc: m, plan: PLAN[i], netCredits: 0 });
  console.log(`  pilot ${i + 1}: rule ${PLAN[i].enabled ? PLAN[i].pct + '% to Stellar' : 'OFF'}  wallet ${publicKey.slice(0, 8)}…  code ${m.ncbaMerchantCode}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────
async function waitTerminal(sourceReference, ms = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = await StellarLedgerEntry.findOne({ kind: 'split_settlement', sourceReference }).lean();
    if (e && e.status !== 'pending') return e;
    await sleep(50);
  }
  return StellarLedgerEntry.findOne({ kind: 'split_settlement', sourceReference }).lean();
}

let opNo = 0;
const log = (type, merchantIdx, outcome, extra = {}) => {
  opNo++;
  results.push({ n: opNo, type, merchant: merchantIdx + 1, outcome, ...extra });
  console.log(`  #${String(opNo).padStart(2)} ${type.padEnd(28)} pilot ${merchantIdx + 1}  ${outcome}${extra.txHash ? '  ' + extra.txHash.slice(0, 10) + '…' : ''}`);
};

// ── 30 incoming payments (6 per merchant) ───────────────────────────────
console.log('\nIncoming payments (settlement split):');
const AMOUNTS = [1500, 3200, 7800, 12000, 950, 20000];
for (let round = 0; round < 6; round++) {
  for (let i = 0; i < merchants.length; i++) {
    const mm = merchants[i];
    const gross = AMOUNTS[(round + i) % AMOUNTS.length];
    const ref = `STRESS-${RUN_ID}-${i}-${round}`;

    // Injected faults on two specific payments.
    let fault = null;
    if (round === 2 && i === 2) { fault = 'settle-timeout'; inject.settle = 'timeout'; settlement.__setStellarTimeoutMs(1500); }
    if (round === 4 && i === 1) { fault = 'master-underfunded'; inject.settle = 'underfunded'; }

    const credited = await creditNcbaCollection({ merchant: await Merchant.findById(mm.id), grossAmount: gross, bankRef: ref });
    mm.netCredits = round2(mm.netCredits + credited.netAmount);

    if (!mm.plan.enabled) {
      await sleep(150);
      const stray = await StellarLedgerEntry.countDocuments({ merchantId: mm.id });
      check(`pilot ${i + 1} (rule off) must have no settlement entries`, stray === 0, `found ${stray}`);
      log('payment (rule off)', i, `net KES ${credited.netAmount} kept liquid`);
      continue;
    }

    const entry = await waitTerminal(ref);
    settlement.__setStellarTimeoutMs(Number(process.env.STELLAR_CALL_TIMEOUT_MS) || 25_000);
    if (fault === 'settle-timeout') {
      check('injected RPC timeout -> status unconfirmed (no auto-refund)', entry?.status === 'unconfirmed', `got ${entry?.status}`);
      log('payment + RPC TIMEOUT', i, `handled: ${entry?.status}`);
    } else if (fault === 'master-underfunded') {
      check('underfunded master -> failed and KES refunded', entry?.status === 'failed', `got ${entry?.status}`);
      log('payment + master underfunded', i, `handled: ${entry?.status}, KES refunded`);
    } else {
      check(`payment ${ref} settled`, entry?.status === 'completed', `got ${entry?.status} ${entry?.errorMessage || ''}`);
      log('payment (split)', i, `${entry?.status} ${mm.plan.pct}% = KES ${entry?.kesAmount} -> ${entry?.usdcAmount} USDC`, { txHash: entry?.stellarTxHash });
    }
  }
}

// Replaying the same webhook must never split twice.
{
  const ref = `STRESS-${RUN_ID}-0-0`;
  let dupBlocked = false;
  try { await creditNcbaCollection({ merchant: await Merchant.findById(merchants[0].id), grossAmount: 1500, bankRef: ref }); }
  catch (e) { dupBlocked = e instanceof DuplicateCollectionError; }
  const replay = await settlement.applySettlementSplit({ merchantId: merchants[0].id, netAmount: 1000, sourceReference: ref });
  check('duplicate webhook is rejected by the ledger', dupBlocked);
  check('replayed split is a no-op', replay.skipped === 'already_split', JSON.stringify(replay));
}

// ── 20 redemption attempts ──────────────────────────────────────────────
console.log('\nRedemptions (Request Payout):');
let redemptions = 0;
for (let i = 0; i < merchants.length; i++) {
  const mm = merchants[i];
  for (let k = 0; k < 3; k++) {
    const bal = await settlement.__setStellarTimeoutMs && (await (MODE === 'live' ? realDeps.balance(mm.doc.stellarPublicKey) : mockDeps.balance(mm.doc.stellarPublicKey)));
    const amount = Math.max(0.01, Math.round(bal * 0.25 * 1e4) / 1e4);
    try {
      const r = await settlement.redeemToMpesa({ merchantId: mm.id, usdcAmount: amount });
      const ok = check(`pilot ${i + 1} redemption ${k + 1} completed`, r.status === 'completed' && r.stellarTxHash && r.receiptHash);
      check('simulated B2C is flagged simulated', r.simulatedB2C?.simulated === true && r.simulatedB2C.request.ResultURL.includes('.invalid'));
      if (!mm.plan.enabled) check('control merchant should have had no USDC', false, 'redeemed successfully');
      log('redeem -> simulated M-Pesa', i, `KES ${r.kesEquivalent} to ${r.destinationPhoneMasked}`, { txHash: r.stellarTxHash });
      redemptions++;
      void ok;
    } catch (e) {
      if (!mm.plan.enabled) {
        check('control merchant redemption rejected for low balance', e.code === 'INSUFFICIENT_USDC', `${e.code}: ${e.message}`);
        log('redeem (no USDC)', i, `rejected: ${e.code}`);
      } else {
        check(`pilot ${i + 1} redemption ${k + 1} should succeed`, false, `${e.code}: ${e.message}`);
        log('redeem', i, `UNEXPECTED ${e.code}`);
      }
    }
  }
}
// Low balance (over-request) x2, and an RPC timeout on the debit.
for (const i of [0, 1]) {
  const bal = MODE === 'live' ? await realDeps.balance(merchants[i].doc.stellarPublicKey) : await mockDeps.balance(merchants[i].doc.stellarPublicKey);
  try {
    await settlement.redeemToMpesa({ merchantId: merchants[i].id, usdcAmount: bal + 1000 });
    check('over-balance redemption must be rejected', false);
  } catch (e) {
    check('over-balance redemption -> INSUFFICIENT_USDC', e.code === 'INSUFFICIENT_USDC', e.code);
    log('redeem over balance', i, `rejected: ${e.code}`);
  }
}
{
  inject.sweep = 'timeout';
  settlement.__setStellarTimeoutMs(1500);
  const i = 3;
  const bal = MODE === 'live' ? await realDeps.balance(merchants[i].doc.stellarPublicKey) : await mockDeps.balance(merchants[i].doc.stellarPublicKey);
  try {
    await settlement.redeemToMpesa({ merchantId: merchants[i].id, usdcAmount: Math.max(0.01, bal * 0.1) });
    check('sweep timeout must surface an error', false);
  } catch (e) {
    check('sweep RPC timeout -> STELLAR_UNCONFIRMED / RPC_TIMEOUT (no fake success)', ['RPC_TIMEOUT', 'STELLAR_UNCONFIRMED'].includes(e.code), e.code);
    log('redeem + RPC TIMEOUT', i, `handled: ${e.code}`);
  }
  settlement.__setStellarTimeoutMs(Number(process.env.STELLAR_CALL_TIMEOUT_MS) || 25_000);
}
// (Remaining ops to reach 50: 30 payments + 15 redemptions + 2 low-balance + 1 timeout = 48; two more normal redemptions.)
for (const i of [0, 2]) {
  const bal = MODE === 'live' ? await realDeps.balance(merchants[i].doc.stellarPublicKey) : await mockDeps.balance(merchants[i].doc.stellarPublicKey);
  try {
    const r = await settlement.redeemToMpesa({ merchantId: merchants[i].id, usdcAmount: Math.max(0.01, Math.round(bal * 0.1 * 1e4) / 1e4) });
    check('extra redemption completed', r.status === 'completed');
    log('redeem -> simulated M-Pesa', i, `KES ${r.kesEquivalent} to ${r.destinationPhoneMasked}`, { txHash: r.stellarTxHash });
  } catch (e) { check('extra redemption should succeed', false, `${e.code}: ${e.message}`); log('redeem', i, `UNEXPECTED ${e.code}`); }
}

// ── Invariants ──────────────────────────────────────────────────────────
console.log('\nChecking invariants:');
const hashes = [];
for (let i = 0; i < merchants.length; i++) {
  const mm = merchants[i];
  const entries = await StellarLedgerEntry.find({ merchantId: mm.id }).lean();
  const completedSplits = entries.filter((e) => e.kind === 'split_settlement' && e.status === 'completed');
  const unconfirmedSplits = entries.filter((e) => e.kind === 'split_settlement' && e.status === 'unconfirmed');
  const completedRedemptions = entries.filter((e) => e.kind === 'redemption' && e.status === 'completed');

  // KES conservation: credits minus everything debited to Stellar (completed + unconfirmed stay debited).
  const debitedKes = round2([...completedSplits, ...unconfirmedSplits].reduce((t, e) => t + e.kesAmount, 0));
  const merchantNow = await Merchant.findById(mm.id).lean();
  check(`pilot ${i + 1} KES conserved`, Math.abs(merchantNow.kesBalance - round2(mm.netCredits - debitedKes)) < 0.01,
    `balance ${merchantNow.kesBalance} vs expected ${round2(mm.netCredits - debitedKes)}`);

  // USDC conservation against the chain.
  const expectedUsdc = completedSplits.reduce((t, e) => t + e.usdcAmount, 0) - completedRedemptions.reduce((t, e) => t + e.usdcAmount, 0);
  const chainUsdc = MODE === 'live' ? await realDeps.balance(mm.doc.stellarPublicKey) : await mockDeps.balance(mm.doc.stellarPublicKey);
  check(`pilot ${i + 1} on-chain USDC matches ledger`, Math.abs(chainUsdc - expectedUsdc) < 0.001, `chain ${chainUsdc} vs ledger ${expectedUsdc}`);

  // Receipt hashes recompute.
  for (const e of entries.filter((x) => x.status === 'completed')) {
    check(`receipt hash present ${e._id}`, !!e.receiptHash && !!e.stellarTxHash);
    if (e.kind === 'split_settlement') {
      const again = settlement.buildReceiptHash({
        entryId: String(e._id), merchantId: String(mm.id), kind: 'split_settlement',
        kesAmount: e.kesAmount, usdcAmount: e.usdcAmount, rate: e.rate, stellarTxHash: e.stellarTxHash, sourceReference: e.sourceReference || null,
      });
      check(`receipt hash verifies ${e._id}`, again === e.receiptHash);
    }
    hashes.push({ pilot: i + 1, kind: e.kind, txHash: e.stellarTxHash, usdc: e.usdcAmount, kes: e.kesAmount });
  }
  if (!mm.plan.enabled) check('control merchant has no entries', entries.length === 0);
  console.log(`  pilot ${i + 1}: ${completedSplits.length} settled, ${unconfirmedSplits.length} unconfirmed, ${completedRedemptions.length} redeemed, USDC ${chainUsdc}, KES ${merchantNow.kesBalance}`);
}

// Statement export.
const csv = settlement.ledgerToCsv(await settlement.listLedgerEntries(merchants[0].id));
check('CSV export has StellarExpert links', csv.includes('stellar.expert/explorer/testnet/tx/'));

// ── Report ──────────────────────────────────────────────────────────────
const total = results.length;
const uniqueHashes = [...new Set(hashes.map((h) => h.txHash))];
const lines = [];
lines.push(`# Stellar pilot stress test — ${MODE} mode (${new Date().toISOString()})`);
lines.push('');
lines.push(`- Operations run: **${total}** across **${merchants.length}** pilot merchants`);
lines.push(`- Confirmed Stellar testnet transactions: **${uniqueHashes.length}**`);
lines.push(`- Invariant failures: **${failures.length}**`);
lines.push('');
lines.push('| # | Operation | Pilot | Outcome |');
lines.push('|---|-----------|-------|---------|');
for (const r of results) lines.push(`| ${r.n} | ${r.type} | ${r.merchant} | ${r.outcome} |`);
lines.push('');
lines.push('## Transaction hashes');
lines.push('');
for (const h of hashes) lines.push(`- Pilot ${h.pilot} · ${h.kind} · ${h.usdc} USDC · [${h.txHash}](https://stellar.expert/explorer/testnet/tx/${h.txHash})`);
if (failures.length) { lines.push('', '## FAILURES', ...failures.map((f) => `- ${f}`)); }
const report = lines.join('\n');
if (args.out) { fs.writeFileSync(args.out, report); console.log(`\nReport written to ${args.out}`); }

console.log(`\n${failures.length === 0 ? '✅ ALL INVARIANTS HELD' : '❌ FAILURES:'}`);
failures.forEach((f) => console.log(`  - ${f}`));
console.log(`Operations: ${total} | confirmed testnet tx: ${uniqueHashes.length}\n`);

await mongoose.disconnect();
process.exit(failures.length ? 1 : 0);
