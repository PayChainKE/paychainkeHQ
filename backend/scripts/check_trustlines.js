import * as StellarSdk from '@stellar/stellar-sdk';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from '../models/Merchant.js';

dotenv.config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const merchant = await Merchant.findOne({ isDemoMerchant: true });
  if (!merchant || !merchant.stellarPublicKey) {
    console.log("No wallet");
    process.exit(1);
  }
  console.log("Merchant PK:", merchant.stellarPublicKey);
  const acc = await server.loadAccount(merchant.stellarPublicKey);
  console.log("Balances:", acc.balances);
  process.exit(0);
}
check();
