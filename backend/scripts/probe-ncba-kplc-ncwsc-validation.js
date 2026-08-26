// One-off diagnostic: check whether NCBA's KPLC (postpaid), KPLC Prepaid,
// and NCWSC (Nairobi Water) validation endpoints actually respond in
// production — the same product family as the confirmed-broken
// MobileB2WValidation/TransactionStatusQuery/PesalinkValidation endpoints,
// so this must not be assumed to work. Read-only — a meter/account lookup,
// never a payment submission. A structured "meter not found" response still
// proves the endpoint itself is alive; a 404/500/timeout means it's broken
// the same way the others were.
//
// Edit KPLC_METER / KPLC_PREPAID_METER / NCWSC_METER below to real meter
// numbers you can verify the result against before running — a fake number
// will still tell us if the endpoint is reachable, but "meter not found"
// then proves nothing about whether a REAL meter would validate correctly.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-kplc-ncwsc-validation.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;

if (!baseUrl || !subscriptionKey || !userId || !password) {
  console.error('❌ Missing required env vars.');
  process.exit(1);
}

// EDIT THESE before running for a meaningful result.
const TEST_MSISDN = '254700000000';
const KPLC_METER = '00000000000';
const KPLC_PREPAID_METER = '00000000000';
const NCWSC_METER = '00000000000';

const checks = [
  { label: 'KPLC (postpaid)', path: '/api/v1/KPLCValidation/kplcvalidation', meterNumber: KPLC_METER },
  { label: 'KPLC Prepaid', path: '/api/v1/KPLCPrepaidValidation/kplcPrepaidValidation', meterNumber: KPLC_PREPAID_METER },
  { label: 'NCWSC (Nairobi Water)', path: '/api/v1/NSWCValidation/nairobiwatervalidation', meterNumber: NCWSC_METER },
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

async function validate({ label, path, meterNumber }, accessToken, tokenType) {
  try {
    const res = await axios.post(
      `${baseUrl}${path}`,
      { meterNumber, msisdn: TEST_MSISDN },
      {
        headers: {
          Authorization: `${tokenType} ${accessToken}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
        },
        timeout: 20000,
        validateStatus: () => true,
      }
    );
    console.log(`\n${label} — ${res.status}  ${path}`);
    console.log('Body:', JSON.stringify(res.data));
  } catch (err) {
    console.log(`\n${label} — ERR  ${path}  ${err.message}`);
  }
}

try {
  console.log('Fetching token…');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK. Validating meters…');

  for (const check of checks) {
    await validate(check, accessToken, tokenType);
  }

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('❌ Could not even get a token:', err?.response?.status, err?.message);
  process.exit(1);
}
