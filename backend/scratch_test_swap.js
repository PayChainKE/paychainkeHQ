import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { settleInflationShield } from './utils/stellarHelper.js';
import Merchant from './models/Merchant.js';

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const merchant = await Merchant.findOne({ stellarPublicKey: { $exists: true } });
  if (!merchant) {
    console.log("No merchant with stellar wallet found");
    process.exit(1);
  }
  console.log("Testing swap for merchant:", merchant.stellarPublicKey);
  try {
    const txHash = await settleInflationShield(merchant.stellarPublicKey, "0.5000000");
    console.log("Success:", txHash);
  } catch (e) {
    console.error("Failed:", e.message);
  }
  process.exit(0);
}

test();
