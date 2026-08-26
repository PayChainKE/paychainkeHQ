// One-off diagnostic: PesalinkValidation/validate-account 404s in prod even
// though it matches NCBA's own Postman collection exactly. Probing a few
// plausible variants before concluding this needs NCBA directly. Read-only.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-pesalink-validation-path.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;
const accountNumber = process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER;

if (!baseUrl || !subscriptionKey || !userId || !password) {
  console.error('Missing required env vars.');
  process.exit(1);
}

const paths = [
  '/api/v1/PesalinkValidation/validate-account',
  '/api/v2/PesalinkValidation/validate-account',
  '/api/v1/PesaLinkValidation/validate-account',
  '/api/v1/imt/PesalinkValidation/validate-account',
  '/api/v1/PesaLinkTransaction/validate-account',
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

async function probe(path, accessToken, tokenType) {
  try {
    const res = await axios.post(
      `${baseUrl}${path}`,
      { targetPic: '01000', accountToVerify: '0000000000', debitAccount: accountNumber || '' },
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
    console.log(`${res.status}  ${path}`);
    console.log('  Body:', JSON.stringify(res.data));
  } catch (err) {
    console.log(`ERR  ${path}  ${err.message}`);
  }
}

try {
  console.log('Fetching token...');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK. Probing paths...\n');

  for (const path of paths) {
    await probe(path, accessToken, tokenType);
  }

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('Could not get a token:', err?.response?.status, err?.message);
  process.exit(1);
}
