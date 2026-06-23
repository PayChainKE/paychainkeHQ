import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const merchants = await Merchant.find({ stellarPublicKey: { $exists: true } });
  
  for (const merchant of merchants) {
    console.log(`Merchant PK: ${merchant.stellarPublicKey}, has encrypted secret: ${!!merchant.stellarEncryptedSecretKey}`);
  }
  process.exit(0);
}
check();
