import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paychain');
  const merchant = await Merchant.findOne({ name: /PayChain/i });
  if (!merchant) {
     console.log('Merchant not found');
     process.exit();
  }
  console.log('Merchant:', merchant.email);
  try {
    merchant.otp = null;
    merchant.otpExpires = null;
    merchant.isVerified = true;
    merchant.loginCount = (merchant.loginCount || 0) + 1;
    merchant.lastLogin = new Date();
    await merchant.save();
    console.log('Save successful');
  } catch (err) {
    console.error('Save failed:', err.message);
  }
  process.exit();
}
run();
