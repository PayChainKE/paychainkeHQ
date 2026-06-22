import dotenv from 'dotenv';
dotenv.config();

import { provisionMerchantWallet, settleInflationShield, getWalletBalance } from './utils/stellarHelper.js';

async function run() {
  console.log("Starting Stellar Test...");
  try {
    const wallet = await provisionMerchantWallet();
    console.log("Wallet Provisioned:", wallet.publicKey);
    
    console.log("Fetching Initial Balance...");
    const initBal = await getWalletBalance(wallet.publicKey);
    console.log("Initial USDC Balance:", initBal);
    
    console.log("Settling Inflation Shield (Sending 1 USDC)...");
    const txHash = await settleInflationShield(wallet.publicKey, 1.00);
    console.log("Settlement Hash:", txHash);
    
    console.log("Fetching Final Balance...");
    const finalBal = await getWalletBalance(wallet.publicKey);
    console.log("Final USDC Balance:", finalBal);
    
  } catch (err) {
    console.error("Test Failed:", err);
  }
  process.exit();
}
run();
