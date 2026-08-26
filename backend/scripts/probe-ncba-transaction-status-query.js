// One-off diagnostic: check whether NCBA's TransactionStatusQuery endpoint
// actually works in production, and what it returns for the two Lipa na
// M-Pesa transfers currently stuck 'pending' (Till 3305603). Read-only —
// a status query, never a payment submission.
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

// The two stuck transactionIds from today's B2B Lipa na M-Pesa submissions
// (reqTransactionReferenceNo sent in the original submit payload).
const transactionIds = [
  'PAYOUT-B2B-1787699132172-FDLRZ', // 200 KES, submitted 23:05:33
  'PAYOUT-B2B-1787699520290-JHIWQ', // 150 KES, submitted 23:12:01
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
