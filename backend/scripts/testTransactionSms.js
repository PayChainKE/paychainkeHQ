// One-off manual test: fires a sample SMS for every transaction-type
// template in the app to a single phone number, so the actual wording/
// formatting can be eyeballed on a real device before relying on it in
// production. Not wired into any route — run directly with node.
//
// Usage:
//   node scripts/testTransactionSms.js 0790889066
//
// Requires AT_API_KEY / AT_USERNAME (and, to actually leave sandbox
// simulation, AT_LIVE_ENABLED=true) to already be set in the environment
// this runs in — e.g. Render's Shell tab, where they're already configured.
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testTransactionSms.js <phoneNumber>');
  process.exit(1);
}

const { date, time } = formatTransactionDateTime();

const messages = [
  {
    label: 'Customer payment confirmation (NCBA inbound)',
    message: `TEST123 Confirmed. KES 1,500 paid to PayChain Demo Store for account 12345678 on ${date} at ${time}. Thank you for your payment.`,
  },
  {
    label: 'Merchant NCBA deposit received',
    message: `TEST123 Payment Received. KES 1,500 received via NCBA on ${date} at ${time}. New balance: KES 24,500.`,
  },
  {
    label: 'M-Pesa wallet top-up',
    message: `TESTREC1 Confirmed. KES 1,000 added to your PayChain wallet via M-PESA on ${date} at ${time}. Your updated available balance is KES 25,500.`,
  },
  {
    label: 'Send money (internal transfer debit)',
    message: `OUT-TEST-1 Sent. KES 2,000 sent to 0722123456 on ${date} at ${time}. New balance: KES 23,500.`,
  },
  {
    label: 'KES to USDC swap',
    message: `Swap Confirmed. KES 5,000 converted to 38.4600000 USDC on ${date} at ${time}. New KES balance: KES 18,500.`,
  },
  {
    label: 'USDC to KES swap',
    message: `Swap Confirmed. 50 USDC converted to KES 6,500.00 on ${date} at ${time}. New KES balance: KES 25,000.`,
  },
  {
    label: 'Bulk payout submitted',
    message: `BAT-TEST-1 Bulk Payout Submitted. KES 45,000 to 6 recipients on ${date} at ${time}. New balance: KES 180,000.`,
  },
  {
    label: 'NCBA bank payout (PesaLink/EFT)',
    message: `TESTREF1 Bank Payout Sent. KES 12,000 paid to Jane Supplier Ltd on ${date} at ${time}. New balance: KES 168,000.`,
  },
  {
    label: 'NCBA H2H bulk payment submitted',
    message: `NCBA-BAT-TEST-1 NCBA Bulk Payout Submitted. KES 8,000 to 2 recipients on ${date} at ${time}. New balance: KES 160,000.`,
  },
];

const run = async () => {
  for (const { label, message } of messages) {
    process.stdout.write(`Sending "${label}"... `);
    const result = await safeSendSMS({ to, message });
    console.log(result.success ? `OK (${message.length} chars)` : `FAILED — ${result.error}`);
  }
};

run();
