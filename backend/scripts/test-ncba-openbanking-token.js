// One-shot diagnostic: confirms NCBA Open Banking credentials work by
// fetching an access token only — no money movement, no other API calls.
// Uses the same env vars and endpoint as services/ncbaOpenBankingService.js.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/test-ncba-openbanking-token.js
import axios from 'axios';

const env = (process.env.NCBA_OPENBANKING_ENVIRONMENT || 'sandbox').toLowerCase();
const isLive = env === 'live';
const baseUrl = isLive
  ? process.env.NCBA_OPENBANKING_BASE_URL
  : (process.env.NCBA_OPENBANKING_SANDBOX_BASE_URL || 'https://openbankingtest.api.ncbagroup.com/test/apigateway');

const userId = process.env.NCBA_OPENBANKING_USER_ID;
const password = process.env.NCBA_OPENBANKING_PASSWORD;
const subscriptionKey = process.env.NCBA_OPENBANKING_SUBSCRIPTION_KEY;

console.log(`Testing NCBA Open Banking token fetch (${env})…`);
console.log(`  Base URL: ${baseUrl || '(not set)'}`);
console.log(`  User ID: ${userId || '(not set)'}`);
console.log(`  Password present: ${password ? `yes (${password.length} chars)` : 'NO — missing'}`);
console.log(`  Subscription key present: ${subscriptionKey ? 'yes' : 'NO — missing'}`);

if (!baseUrl || !userId || !password || !subscriptionKey) {
  console.error('\n❌ One or more required env vars are missing. Aborting before calling NCBA.');
  process.exit(1);
}

try {
  const response = await axios.post(
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

  const { accessToken, tokenType } = response.data || {};
  if (!accessToken || !tokenType) {
    console.error('❌ NCBA responded 200 but the token response was missing accessToken/tokenType.');
    console.error('   Response body:', JSON.stringify(response.data));
    process.exit(1);
  }

  console.log('\n✅ Token fetch succeeded — credentials are valid.');
  console.log(`   Token type: ${tokenType}`);
  console.log(`   Access token: ${accessToken.slice(0, 12)}… (truncated)`);
  process.exit(0);
} catch (err) {
  console.error('\n❌ Token fetch failed.');
  console.error('   Status:', err?.response?.status);
  console.error('   Body:', JSON.stringify(err?.response?.data));
  console.error('   Message:', err?.message);
  process.exit(1);
}
