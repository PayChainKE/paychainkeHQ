// One-off manual test: fires a live sample of every distinct SMS shape
// PayChain actually sends across the platform (every collection/payout
// rail, both the merchant-facing and the customer-facing side), so the
// real wording/formatting can be verified end-to-end on a real device.
// Not wired into any route — run directly with node, wherever AT_API_KEY /
// AT_USERNAME / AT_LIVE_ENABLED are already configured (local dev has none
// of these — use Render's Shell tab).
//
// Usage:
//   node scripts/testTransactionSms.js 0790889066
//
// Kept in sync with the real senders — when you change a template in
// paymentSmsTemplates.js or a controller's inline SMS string, update the
// matching entry below too, otherwise this stops being a trustworthy check.
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { buildCustomerPaidSms, buildPaymentReceivedSms, buildPayoutSentSms, buildPayoutFailedSms } from '../utils/paymentSmsTemplates.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testTransactionSms.js <phoneNumber>');
  process.exit(1);
}

const { date, time } = formatTransactionDateTime();

const messages = [
  // --- Auth / OTP ---
  {
    label: 'Login / password-reset OTP (merchantAuthController.js)',
    message: `Your PayChain verification code is 482913. It expires in 10 minutes. Do not share this code.`,
  },
  {
    label: 'Phone verification OTP (merchantSmsAuthController.js)',
    message: `Your PayChain verification code is 482913. It expires in 5 minutes. Do not share this code.`,
  },

  // --- Customer-facing (payer) — identical output on every collection
  // rail: C2B, NCBA reconciliation, NCBA account-notification, STK
  // Payment Links/Invoices, STK request-money/pay-account ---
  {
    label: 'Customer payment confirmation (all collection rails, via buildCustomerPaidSms)',
    message: buildCustomerPaidSms({
      ref: 'TFC26080TEST',
      amount: 1500,
      businessName: 'PayChain Demo Store',
      accountRef: '12345678',
      date,
      time,
    }).message,
  },

  // --- Merchant-facing "you were paid" — identical output on every
  // collection rail: C2B, NCBA reconciliation, NCBA account-notification,
  // STK Payment Links/Invoices, STK request-money/pay-account ---
  {
    label: 'Merchant payment-received alert (all collection rails, via buildPaymentReceivedSms)',
    message: buildPaymentReceivedSms({
      ref: 'TFC26080TEST',
      amount: 1500,
      payerName: 'JANE CUSTOMER',
      payerPhone: '0740621805',
      date,
      time,
      balance: 24500,
    }).message,
  },
  {
    label: 'Wallet self-top-up confirmation (mpesaController.js resolveStkOutcome, kind=topup)',
    message: `TESTREC1 Confirmed. KES 1,000 added to your PayChain wallet via M-PESA on ${date} at ${time}. Your updated available balance is KES 25,500.`,
  },

  // --- Payouts (merchant-facing) ---
  {
    label: 'NCBA payout succeeded (ncbaOpenBankingController.js handlePesaLinkCallback, via buildPayoutSentSms)',
    message: buildPayoutSentSms({
      ref: 'TFB26080TEST',
      label: 'Payout',
      amount: 2000,
      recipientName: 'JOHN SUPPLIER',
      date,
      time,
      balance: 21490,
    }).message,
  },
  {
    label: 'NCBA payout failed & refunded (ncbaOpenBankingController.js handlePesaLinkCallback, via buildPayoutFailedSms)',
    message: buildPayoutFailedSms({
      ref: 'TFB26080FAIL',
      label: 'Payout',
      amount: 2000,
      recipientName: 'JOHN SUPPLIER',
      date,
      time,
      balance: 23500,
    }).message,
  },
  {
    label: 'Bulk payout submission ack (bulkPayController.js)',
    message: `BAT-TEST-1 Bulk Payout Submitted. KES 45,000 to 6 recipients on ${date} at ${time}. New balance: KES 180,000.`,
  },
  {
    label: 'Bulk payout batch resolved (ncbaOpenBankingController.js handlePesaLinkCallback)',
    message: `BAT-TEST-1 Bulk Payout Processed on ${date} at ${time}. 6 of 6 payout(s) completed (KES 45,000 total).`,
  },
  {
    label: 'NCBA H2H bulk payout submitted (ncbaController.js)',
    message: `NCBA-BAT-TEST-1 NCBA Bulk Payout Submitted. KES 8,000 to 2 recipients on ${date} at ${time}. New balance: KES 160,000.`,
  },
  {
    label: 'NCBA PesaLink/EFT bank payout sent (ncbaOpenBankingController.js handleBankPayout)',
    message: `TESTREF1 Bank Payout Sent. KES 12,000 paid to Jane Supplier Ltd on ${date} at ${time}. New balance: KES 168,000.`,
  },
  {
    label: 'Internal send-money debit (transactionController.js sendMoney)',
    message: `OUT-TEST-1 Sent. KES 2,000 sent to 0722123456 on ${date} at ${time}. New balance: KES 23,500.`,
  },

  // --- FX swap ---
  {
    label: 'KES to USDC swap (transactionController.js)',
    message: `Swap Confirmed. KES 5,000 converted to 38.4600000 USDC on ${date} at ${time}. New KES balance: KES 18,500.`,
  },
  {
    label: 'USDC to KES swap (transactionController.js)',
    message: `Swap Confirmed. 50 USDC converted to KES 6,500.00 on ${date} at ${time}. New KES balance: KES 25,000.`,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sending many texts to the same number within the same second is what got
// several stuck at Africa's Talking's "Sent" (submitted, no delivery
// receipt yet) instead of "Success" (confirmed delivered) in an earlier
// run — Safaricom's network throttles same-sender-to-same-recipient
// bursts. A few seconds of real spacing avoids that; real production
// traffic never hits this since one merchant's transactions aren't
// machine-gunned like this test script does.
const DELAY_MS = 4000;

const run = async () => {
  console.log(`Sending ${messages.length} test SMS to ${to}...\n`);
  for (let i = 0; i < messages.length; i++) {
    const { label, message } = messages[i];
    process.stdout.write(`[${i + 1}/${messages.length}] ${label}... `);
    const result = await safeSendSMS({ to, message });
    console.log(result.success ? `OK (messageId=${result.messageId || 'n/a'}, ${message.length} chars)` : `FAILED — ${result.error}`);
    if (i < messages.length - 1) await sleep(DELAY_MS);
  }
  console.log('\nDone. Check SmsLog / the delivery-report webhook for final AT delivery status on each messageId.');
};

run();
