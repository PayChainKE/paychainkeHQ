import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './backend/models/Merchant.js';
import { settleInflationShield } from './backend/utils/stellarHelper.js';

dotenv.config({ path: './backend/.env' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const merchant = await Merchant.findOne({});
  console.log('Merchant:', merchant.businessName);
  console.log('Stellar Public Key:', merchant.stellarPublicKey);
  
  if (merchant.stellarPublicKey) {
    try {
      const hash = await settleInflationShield(merchant.stellarPublicKey, 1.0);
      console.log('Success:', hash);
    } catch (e) {
      console.error('Swap Error:', e.message);
    }
  } else {
    console.log('No stellar key on this merchant');
  }
  process.exit(0);
});
