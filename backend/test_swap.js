import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';
import { settleInflationShield } from './utils/stellarHelper.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const merchant = await Merchant.findOne({ stellarPublicKey: { $ne: null } });
  if (!merchant) {
    console.log('No merchant with a stellar public key found');
    process.exit(0);
  }
  console.log('Merchant:', merchant.businessName);
  console.log('Stellar Public Key:', merchant.stellarPublicKey);
  
  try {
    const hash = await settleInflationShield(merchant.stellarPublicKey, 1.0);
    console.log('Success:', hash);
  } catch (e) {
    console.error('Swap Error:', e.message);
  }
  process.exit(0);
});
