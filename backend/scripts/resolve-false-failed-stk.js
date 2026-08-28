// Manually corrects an STKRequest that resolved 'failed' (NCBA's own
// status-check API gave a transient/decline-looking response) but the
// customer has since produced a real M-Pesa confirmation code proving the
// payment actually landed. Routes through the exact same allowFailedRetry
// path ncbaAccountNotificationController.js's findFalselyFailedStkRequest
// uses when NCBA's account-notification webhook itself catches this case —
// same atomic claim, same balance-crediting logic, same SMS/notification —
// so this is not a special case, just doing by hand what that webhook does
// automatically when it manages to fire.
//
// Usage (run on Render, from backend/):
//   node scripts/resolve-false-failed-stk.js <checkoutRequestId> <mpesaReceiptCode>
//
// checkoutRequestId comes from the STKRequest record (visible in the admin
// STK Monitor). mpesaReceiptCode is the real M-Pesa confirmation code the
// customer received (e.g. "QGH7XYZ123") — only proceed if you've actually
// seen this from the customer, not just taken their word that it worked.
import 'dotenv/config';
import mongoose from 'mongoose';
import STKRequest from '../models/STKRequest.js';
import { resolveStkOutcome } from '../controllers/mpesaController.js';

async function main() {
  const [checkoutRequestId, mpesaReceiptCode] = process.argv.slice(2);
  if (!checkoutRequestId || !mpesaReceiptCode) {
    console.error('Usage: node scripts/resolve-false-failed-stk.js <checkoutRequestId> <mpesaReceiptCode>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const stkReq = await STKRequest.findOne({ checkoutRequestId }).lean();
  if (!stkReq) {
    console.error(`No STKRequest found with checkoutRequestId ${checkoutRequestId}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  if (stkReq.status !== 'failed') {
    console.error(`This STKRequest is currently '${stkReq.status}', not 'failed' — nothing to correct.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Found:', JSON.stringify({ phone: stkReq.phone, amount: stkReq.amount, resultDesc: stkReq.resultDesc, createdAt: stkReq.createdAt }, null, 2));
  console.log(`Correcting to success, receipt ${mpesaReceiptCode}...`);

  await resolveStkOutcome(stkReq, {
    succeeded: true,
    receipt: mpesaReceiptCode,
    resultDesc: 'Corrected: merchant confirmed via real M-Pesa receipt code (manual verification)',
    allowFailedRetry: true,
  });

  const after = await STKRequest.findOne({ checkoutRequestId }).select('status resultDesc').lean();
  console.log('Result:', JSON.stringify(after, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
