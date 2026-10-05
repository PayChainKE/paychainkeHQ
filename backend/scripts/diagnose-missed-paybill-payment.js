// Diagnoses "customer paid our paybill directly via the M-Pesa menu, but
// the merchant never got notified and it's not showing in any dashboard"
// for one or more merchants by business name — read-only, writes nothing.
//
// Checks, per merchant:
//   1. Their ncbaMerchantCode / virtual account (so you can cross-check
//      against what the customer actually typed into the M-Pesa menu).
//   2. MissedNcbaCollectionCandidate — the hourly statement-reconciliation
//      sweep's own queue (ncbaCollectionReconciliationService.js). If a
//      candidate is sitting here, it's visible right now on the admin
//      Pool Reconciliation page under "Missed Collections" and can be
//      credited from there directly — no code fix needed for that specific
//      payment.
//   3. Recent real transactions (so you can see what DID land, for timing
//      context).
//   4. NcbaPhoneExtractionMiss — a different thing (merchant code WAS
//      found, but no payer phone could be extracted for the SMS) — only
//      relevant if the payment did land but no SMS went out.
//
// Run it where the real MONGO_URI is set (e.g. the Render shell):
//   node backend/scripts/diagnose-missed-paybill-payment.js "Opulent Fits" "Brantech Solutions"
import dotenv from 'dotenv';
dotenv.config();

const names = process.argv.slice(2);
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!process.env.MONGO_URI) die('MONGO_URI is not set.');
if (names.length === 0) die('Pass one or more business names, e.g.:\n    node backend/scripts/diagnose-missed-paybill-payment.js "Opulent Fits" "Brantech Solutions"');

const { default: mongoose } = await import('mongoose');
const { default: Merchant } = await import('../models/Merchant.js');
const { default: Transaction } = await import('../models/Transaction.js');
const { default: MissedNcbaCollectionCandidate } = await import('../models/MissedNcbaCollectionCandidate.js');
const { default: NcbaPhoneExtractionMiss } = await import('../models/NcbaPhoneExtractionMiss.js');
const { getNcbaVirtualAccountNumber } = await import('../utils/ncbaValidators.js');

await mongoose.connect(process.env.MONGO_URI);
const dbHost = (process.env.MONGO_URI.match(/@?([a-z0-9.-]+)(?::\d+)?\//i) || [])[1] || 'unknown';
console.log(`\nConnected to ${dbHost}\n`);

for (const name of names) {
  console.log('='.repeat(70));
  console.log(`  ${name}`);
  console.log('='.repeat(70));

  const merchant = await Merchant.findOne({ businessName: new RegExp(name.trim(), 'i') })
    .select('_id businessName email phone status ncbaMerchantCode createdAt');
  if (!merchant) {
    console.log(`  No merchant found matching "${name}". Check spelling, or it may be under a different registered business name.\n`);
    continue;
  }

  const virtualAccount = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode);
  console.log(`  Merchant:        ${merchant.businessName} (${merchant._id})`);
  console.log(`  Status:          ${merchant.status}`);
  console.log(`  Merchant code:   ${merchant.ncbaMerchantCode || '(none — not yet assigned)'}`);
  console.log(`  Virtual account: ${virtualAccount || '(not resolvable — check NCBA_INSTITUTION_PREFIX)'}  <-- this is what the customer should have typed as the Account Number`);
  console.log('');

  const candidates = await MissedNcbaCollectionCandidate.find({ matchedMerchantId: merchant._id }).sort('-createdAt').limit(10);
  if (candidates.length) {
    console.log(`  ⚠ ${candidates.length} missed-collection candidate(s) found — visible on admin Pool Reconciliation → "Missed Collections":`);
    candidates.forEach((c) => {
      console.log(`    - ref ${c.statementReference} · KES ${c.amount} · ${c.statementDate || '?'} · status: ${c.status}${c.resolutionNote ? ` (${c.resolutionNote})` : ''}`);
    });
  } else {
    console.log('  No missed-collection candidates found for this merchant (the statement-reconciliation sweep has not flagged anything).');
    console.log('  This either means: (a) the payment genuinely has not landed on NCBA\'s statement at all yet, or');
    console.log('  (b) it landed but could not be attributed to this merchant even by the sweep\'s own statement-text matching —');
    console.log('      in which case it needs a manual NCBA-statement lookup, since nothing here will have caught it automatically.');
  }
  console.log('');

  const recentTxns = await Transaction.find({ merchantId: merchant._id, type: { $in: ['ncba_inbound', 'inbound', 'top_up'] } })
    .sort('-createdAt').limit(5).select('type status kesAmount amount reference sender createdAt');
  console.log(`  Last ${recentTxns.length} inbound transaction(s) that DID land, for timing context:`);
  if (recentTxns.length === 0) console.log('    (none)');
  recentTxns.forEach((t) => {
    console.log(`    - ${t.createdAt.toISOString()} · KES ${t.kesAmount || t.amount} · ${t.type}/${t.status} · ref ${t.reference || '—'} · from ${t.sender?.name || t.sender?.phone || 'unknown'}`);
  });
  console.log('');

  const phoneMisses = await NcbaPhoneExtractionMiss.find({ merchantId: merchant._id }).sort('-createdAt').limit(5);
  if (phoneMisses.length) {
    console.log(`  Note: ${phoneMisses.length} payment(s) landed and credited fine, but the customer's phone couldn't be extracted (so only the merchant SMS went out, not a customer receipt):`);
    phoneMisses.forEach((m) => console.log(`    - ${m.createdAt.toISOString()} · txnType ${m.rawTransType} · customerName field: "${m.rawCustomerName || ''}"`));
  }
  console.log('');
}

process.exit(0);
