import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const merchant = await Merchant.findOne({ stellarPublicKey: { $ne: null } });
  if (!merchant) {
    console.log('No merchant with a stellar public key found');
    process.exit(0);
  }
  
  console.log('Encrypted Key:', merchant.encryptedStellarSecretKey);
  process.exit(0);
});
