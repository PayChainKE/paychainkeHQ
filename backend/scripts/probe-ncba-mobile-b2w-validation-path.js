// One-off diagnostic: the production Mobile B2W Validation call 404s at the
// path confirmed working in sandbox/UAT. This probes a handful of plausible
// production path variants to see if any of them actually exist — still
// just a number-validation call, no money movement either way.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-mobile-b2w-validation-path.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;

if (!baseUrl || !subscriptionKey || !userId || !password) {
  console.error('❌ Missing required env vars.');
  process.exit(1);
}

const candidatePaths = [
  '/api/v1/MobileB2WValidation/validate-account',   // current (confirmed 404)
  '/api/v1/MpesaB2WValidation/validate-account',     // Postman folder's own name
  '/api/v2/MobileB2WValidation/validate-account',    // collection is titled "V2"
  '/api/v2/MpesaB2WValidation/validate-account',
  '/prod/api/v1/MobileB2WValidation/validate-account',
  '/api/v1/mobileb2wvalidation/validate-account',    // lowercase
  '/api/v1/MobileB2WValidation/ValidateAccount',     // PascalCase suffix
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
      { provider: 'safaricom', msisdn: '254700000000' },
      {
        headers: {
          Authorization: `${tokenType} ${accessToken}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
        },
        timeout: 15000,
        validateStatus: () => true, // don't throw on non-2xx, we want to see everything
      }
    );
    console.log(`${res.status}  ${path}`);
    if (res.status !== 404) {
      console.log('   ^ NOT a 404 — worth a closer look. Body:', JSON.stringify(res.data));
    }
  } catch (err) {
    console.log(`ERR  ${path}  ${err.message}`);
  }
}

try {
  console.log('Fetching token…');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK. Probing candidate paths…\n');

  for (const path of candidatePaths) {
    await probe(path, accessToken, tokenType);
  }

  console.log('\nDone. Any non-404 above is a real lead — otherwise none of these guesses exist either.');
  process.exit(0);
} catch (err) {
  console.error('❌ Could not even get a token:', err?.response?.status, err?.message);
  process.exit(1);
}
