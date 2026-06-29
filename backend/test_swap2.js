import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';
import { swapUsdcToKesOnChain } from './utils/stellarHelper.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const merchant = await Merchant.findOne({ stellarPublicKey: { $ne: null } });
  if (!merchant) {
    console.log('No merchant with a stellar public key found');
    process.exit(0);
  }
  
  try {
    const hash = await swapUsdcToKesOnChain(merchant.encryptedStellarSecretKey, 1.0);
    console.log('Success:', hash);
  } catch (e) {
    console.error('Swap Error:', e.message);
  }
  process.exit(0);
});
