// Read-only diagnostic: lists the most recent real (non-test) Lipa na
// M-Pesa/Till payouts and their status, to confirm whether real merchant
// B2B/Till payouts are succeeding now that reqMobileNumber is populated
// (per Rose/NCBA, 2026-08-27) and the notifyMobileNumber fix is deployed.
// Makes NO writes.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node scripts/check-recent-lipa-na-mpesa.js
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';

await mongoose.connect(process.env.MONGO_URI);

const txs = await Transaction.find({
  type: 'ncba_lipa_na_mpesa',
  reference: { $not: /^TEST-/ },
})
  .sort({ createdAt: -1 })
  .limit(10)
  .populate('merchantId', 'businessName email')
  .lean();

if (txs.length === 0) {
  console.log('No real (non-test) ncba_lipa_na_mpesa transactions found.');
  process.exit(0);
}

console.log(`Most recent ${txs.length} real Lipa na M-Pesa/Till payout(s):\n`);
for (const tx of txs) {
  console.log(
    `${tx.createdAt?.toISOString?.() || tx.createdAt}  ` +
    `merchant=${tx.merchantId?.businessName || tx.merchantId}  ` +
    `status=${tx.status}  pendingReason=${tx.pendingReason || '-'}  ` +
    `amount=${tx.amount}  recipient=${tx.recipient?.id}  ref=${tx.reference}`
  );
}

process.exit(0);
