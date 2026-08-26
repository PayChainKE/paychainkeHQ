// Read-only diagnostic: confirms whether a failed B2B (Lipa na M-Pesa)
// transfer's debit was actually refunded. Prints the merchant's current
// balance plus recent transaction history (each with balanceAfter) so the
// refund (a raw $inc, never its own Transaction record) can be verified by
// comparing current balance to the last known-good balanceAfter.
// Makes NO writes.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/check-b2b-refund.js
import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';

const TARGET_EMAIL = 'brandonomutiti05@gmail.com';

await mongoose.connect(process.env.MONGO_URI);

const merchant = await Merchant.findOne({ email: TARGET_EMAIL });
if (!merchant) {
  console.error(`No merchant found for ${TARGET_EMAIL}`);
  process.exit(1);
}

console.log(`Merchant: ${merchant.businessName} (${merchant._id})`);
console.log(`Current kesBalance: ${merchant.kesBalance}`);
console.log('\nMost recent 15 transactions (newest first):\n');

const txs = await Transaction.find({ merchantId: merchant._id })
  .sort({ createdAt: -1 })
  .limit(15)
  .lean();

for (const tx of txs) {
  console.log(
    `${tx.createdAt?.toISOString?.() || tx.createdAt}  ` +
    `type=${tx.type}  status=${tx.status}  ` +
    `amount=${tx.amount}  kesAmount=${tx.kesAmount}  ` +
    `balanceAfter=${tx.balanceAfter}  ref=${tx.reference}`
  );
}

console.log('\nCompare current kesBalance above to the balanceAfter of the last legitimate transaction before the failed B2B attempt — if they match, the refund landed; if current balance is short by the debited amount, it did not.');
process.exit(0);
