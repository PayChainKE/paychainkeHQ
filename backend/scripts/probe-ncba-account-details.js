// One-off diagnostic: check whether NCBA's AccountDetails endpoint (found
// in "API documents/Open Banking V2- Callback Enabled.postman_collection.json")
// actually returns a live balance for PayChain's own NCBA operating account,
// and what shape the response comes back in. No code in this backend calls
// this endpoint today — before wiring a real "pool account balance"
// reconciliation page on it, need to confirm (a) it works in production the
// same way TransactionStatusQuery/callbacks turned out not to, and (b)
// what field actually holds the balance.
//
// Read-only — a details lookup, never a payment submission.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-account-details.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;
const accountNo = process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER;

if (!baseUrl || !subscriptionKey || !userId || !password || !accountNo) {
  console.error('❌ Missing required env vars.');
  process.exit(1);
}

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

async function accountDetails(accessToken, tokenType) {
  const res = await axios.post(
    `${baseUrl}/api/v1/AccountDetails/accountdetails`,
    { country: 'KE', accountNo },
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
  console.log(`\n${res.status}  accountNo=${accountNo}`);
  console.log('Body:', JSON.stringify(res.data, null, 2));
}

try {
  console.log('Fetching token…');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK. Fetching account details…');
  await accountDetails(accessToken, tokenType);
  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('❌ Request failed:', err?.response?.status, JSON.stringify(err?.response?.data) || err?.message);
  process.exit(1);
}
