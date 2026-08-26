// One-off diagnostic: builds a clean working/broken matrix across several
// NCBA Open Banking endpoints, to hand NCBA's engineers a precise picture
// instead of "everything is broken". All read-only/validation calls —
// no money movement.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/probe-ncba-endpoint-matrix.js
import axios from 'axios';

const baseUrl = process.env.NCBA_OPENBANKING_BASE_URL;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;
const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;
const accountNumber = process.env.NCBA_OPENBANKING_ACCOUNT_NUMBER;

if (!baseUrl || !subscriptionKey || !userId || !password) {
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

const calls = [
  {
    label: 'LipaNaMpesaValidation (known working control)',
    path: '/api/v1/LipaNaMpesaValidation/accountdetails',
    body: { identifier: '889066', identifierType: '2' },
  },
  {
    label: 'MpesaB2WValidation (already confirmed broken)',
    path: '/api/v1/MpesaB2WValidation/validate-account',
    body: { provider: 'safaricom', msisdn: '254700000000' },
  },
  {
    label: 'TransactionStatusQuery (already confirmed broken)',
    path: '/api/v1/TransactionStatusQuery/transactionstatusquery',
    body: { country: 'KENYA', transactionId: 'PAYOUT-B2B-1787699132172-FDLRZ' },
  },
  {
    label: 'PesalinkValidation (bank account validation)',
    path: '/api/v1/PesalinkValidation/validate-account',
    body: { targetPic: '01000', accountToVerify: '0000000000', debitAccount: accountNumber || '' },
  },
  {
    label: 'ChargeInquiry (fee lookup)',
    path: '/api/v1/ChargeInquiry/chargeinquiry',
    body: { country: 'KENYA', debitAccount: accountNumber || '', chargeCurrency: 'KES', transactionAmount: '100', serviceType: 'PESALINK' },
  },
];

async function run(call, accessToken, tokenType) {
  try {
    const res = await axios.post(`${baseUrl}${call.path}`, call.body, {
      headers: {
        Authorization: `${tokenType} ${accessToken}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PayChain-Backend/1.0 (+https://paychain.co.ke)',
      },
      timeout: 15000,
      validateStatus: () => true,
    });
    const isGenericInternalError = res.data?.message === 'Internal server error';
    console.log(`\n${call.label}`);
    console.log(`  ${res.status}  ${call.path}`);
    console.log(`  ${isGenericInternalError ? '❌ BROKEN (generic 500)' : '✅ RESPONDS WITH REAL DATA'}`);
    console.log('  Body:', JSON.stringify(res.data));
  } catch (err) {
    console.log(`\n${call.label}`);
    console.log(`  ERR  ${err.message}`);
  }
}

try {
  console.log('Fetching token…');
  const { accessToken, tokenType } = await getToken();
  console.log('Token OK.\n=== Endpoint matrix ===');

  for (const call of calls) {
    await run(call, accessToken, tokenType);
  }

  console.log('\nDone.');
  process.exit(0);
} catch (err) {
  console.error('❌ Could not even get a token:', err?.response?.status, err?.message);
  process.exit(1);
}
