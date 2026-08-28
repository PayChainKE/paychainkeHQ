// One-off: manually resolves specific ncba_lipa_na_mpesa Transactions that
// are stuck 'pending' (NCBA's callback + status-query API are both
// confirmed broken for this rail — see
// services/ncbaOpenBankingReconciliationService.js's doc comment) but have
// been confirmed, by checking the recipient till directly, to have actually
// landed. Routes through the exact same resolution path a real NCBA
// callback would use (resolvePendingOpenBankingTransaction), so it flips
// the Transaction to 'completed', pushes the live dashboard update, and
// sends the merchant the normal "payout sent" SMS.
//
// Run on Render: node scripts/resolve-stuck-lnm-payouts.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { resolvePendingOpenBankingTransaction } from '../controllers/ncbaOpenBankingController.js';
import Transaction from '../models/Transaction.js';

// Confirmed landed on the recipient till as of 2026-08-28.
const REFERENCES = [
  'PAYOUTB2B1787930322517NCW1J', // KES 20, 15:18:46
  'PAYOUTB2B178792940952583B30', // KES 10, 15:03:32
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const reference of REFERENCES) {
    console.log(`Resolving ${reference} as succeeded...`);
    await resolvePendingOpenBankingTransaction({ reference, succeeded: true });
  }

  const after = await Transaction.find({ reference: { $in: REFERENCES } })
    .select('reference status pendingReason')
    .lean();
  console.log(JSON.stringify(after, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
