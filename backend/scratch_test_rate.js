import { getLiveKesToUsdcRate } from './utils/rateEngine.js';

const MOCK_INCOMING_KES = 5000;

async function runTest() {
  console.log(`\n--- INFLATION SHIELD: LIVE RATE TEST ---`);
  
  try {
    const liveRate = await getLiveKesToUsdcRate();
    const usdcPayoutValue = (MOCK_INCOMING_KES * liveRate).toFixed(7);

    console.log(`Gross Incoming M-Pesa KSh Amount: ${MOCK_INCOMING_KES}`);
    console.log(`Live Coinbase Ticker Rate (USDC per KES): ${liveRate}`);
    console.log(`Precise Final Computed USDC Payout Value: ${usdcPayoutValue}`);
    
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

runTest();
