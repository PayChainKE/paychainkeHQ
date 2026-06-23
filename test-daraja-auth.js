require('dotenv').config();
const axios = require('axios');

async function testAuthentication() {
  console.log("=== PAYCHAIN MPESA AUTHENTICATION HANDSHAKE ===");
  
  const baseUrl = process.env.MPESA_URL || 'https://sandbox.safaricom.co.ke';
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  
  if (!key || !secret) {
    console.error("❌ Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in your .env configuration file!");
    process.exit(1);
  }

  const authCredentials = Buffer.from(`${key}:${secret}`).toString('base64');

  try {
    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${authCredentials}` }
      }
    );

    console.log("\n✅ Web Handshake Successful!");
    console.log("🔑 Generated Bearer Token:", response.data.access_token.slice(0, 20) + "...");
    console.log("⏳ Security Lifespan:", response.data.expires_in, "seconds");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Communication Interruption!");
    if (error.response) {
      console.error("Safaricom Server Response:", error.response.data);
    } else {
      console.error("Execution Bug Details:", error.message);
    }
    process.exit(1);
  }
}

testAuthentication();
