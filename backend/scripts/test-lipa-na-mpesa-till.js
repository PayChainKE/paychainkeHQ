// One-off live test: submits a real Lipa na M-Pesa (Till) payout of
// KES 50 through the actual submitLipaNaMpesaPayment() service function —
// same code path production payouts use, not a hand-rolled payload — with
// notifyMobileNumber populated (Rose/NCBA's suggestion, 2026-08-27, after
// prior Till attempts with an empty reqMobileNumber failed/were rejected).
//
// THIS MOVES REAL MONEY if NCBA accepts it: KES 50 debited from PayChain's
// live NCBA operating account (1010837186) to Till 3305603. Not a
// validation-only probe like the other scripts in this directory.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/test-lipa-na-mpesa-till.js
import { submitLipaNaMpesaPayment } from '../services/ncbaOpenBankingService.js';

const transactionId = `TEST-B2B-${Date.now()}`;

console.log(`Submitting Lipa na M-Pesa Till payout, ref=${transactionId} ...`);

try {
  const result = await submitLipaNaMpesaPayment({
    transactionId,
    paymentType: 'Till',
    payBillTillNo: '3305603',
    amount: 50,
    recipientName: 'PayChain Merchant',
    notifyMobileNumber: '090889066',
    narration: 'PayChain Payout',
  });
  console.log('✅ NCBA accepted the payout. Raw response:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nreqChnlId/reference to track: ${transactionId}`);
} catch (err) {
  console.error('❌ NCBA rejected/errored on the payout.');
  console.error('Message:', err?.message);
  if (err?.isInsufficientFunds) console.error('(flagged as an insufficient-funds rejection)');
  process.exit(1);
}

process.exit(0);
