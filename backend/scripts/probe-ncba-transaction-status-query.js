// One-off diagnostic: check whether NCBA's TransactionStatusQuery endpoint
// actually works in production, and what it returns for the Lipa na M-Pesa
// transfers currently stuck 'pending' (Till 3305603, Brantech Solutions).
// Read-only — a status query, never a payment submission.
//
// Re-pointed 2026-08-28 at the real transactions from today's live test
// (confirmed by the recipient as actually received, but PayChain's own
// Transaction record is still 'pending' — NCBA's settlement callback never
// arrived, same unreliable-callback pattern already seen on Mobile B2W).
// The two IDs this script previously hardcoded were from an earlier attempt
// that used hyphenated references, before Rose (NCBA) confirmed
// reqTransactionReferenceNo can't contain hyphens — not representative of
// the current, fixed code path, so this checks the current, real ones.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-transaction-status-query.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;

if (!baseUrl || !subscriptionKey || !userId || !password) {
  console.error('❌ Missing required env vars.');
  process.exit(1);
}

// Today's real Lipa na M-Pesa submissions (reqTransactionReferenceNo sent in
// the original submit payload) — the first is the real Send Money payout
// (Transaction still shows 'pending' in our DB); the other two are the raw
// test-script runs, both confirmed settled via NCBA's account-notification
// debit feed (ncba_account_notification_debit_ignored in the logs) even
// though nothing in our own system ever marked them resolved.
const transactionIds = [
  'PAYOUTB2B178792940952583B30',  // 10 KES, Brantech Send Money, submitted 15:03:32 — still 'pending' in our DB
  'TEST-B2B-1787928897665',       // 50 KES, raw test script (old phone format), confirmed debited
  'TEST-B2B-1787929295910',       // 50 KES, raw test script (254 phone format), confirmed debited
];

async function getToken() {
  const res = await axios.post(
    `${baseUrl}/api/v1/Auth/generate-token`,
    { userID: userId, password },
    {
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
      },
      timeout: 15000,
    }
  );
  return res.data;
}

async function query(transactionId, accessToken, tokenType) {
  try {
    const res = await axios.post(
      `${baseUrl}/api/v1/TransactionStatusQuery/transactionstatusquery`,
      { country: 'KENYA', transactionId },
      {
        headers: {
          Authorization: `${tokenType} ${accessToken}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
        },
        timeout: 15000,
        validateStatus: () => true,
      }
    );
    console.log(`\n${res.status}  transactionId=${transactionId}`);
    console.log('Body:', JSON.stringify(res.data));
  } catch (err) {
    console.log(`ERR  transactionId=${transactionId}  ${err.message}`);
  }
}

try {
  console.log('Fetching token…');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK. Querying transaction status…');

  for (const id of transactionIds) {
    await query(id, accessToken, tokenType);
  }

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('❌ Could not even get a token:', err?.response?.status, err?.message);
  process.exit(1);
}
