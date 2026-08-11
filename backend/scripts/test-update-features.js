import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Merchant from '../models/Merchant.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paychain')
  .then(async () => {
    const merchant = await Merchant.findOne();
    if (!merchant) {
      console.log('No merchant found');
      process.exit(1);
    }
    console.log('Updating merchant:', merchant._id);
    if (!merchant.features) {
      merchant.features = { digitalWallet: true, inflationShield: true };
    }
    merchant.features.digitalWallet = false;
    await merchant.save();
    console.log('Saved successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
