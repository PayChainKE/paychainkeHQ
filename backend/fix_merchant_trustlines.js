import * as StellarSdk from '@stellar/stellar-sdk';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './models/Merchant.js';
import { decryptKey } from './utils/cryptoHelper.js';

dotenv.config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const usdcAsset = new StellarSdk.Asset(process.env.USDC_ASSET_CODE, process.env.USDC_ISSUER_ADDRESS);

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const merchants = await Merchant.find({ stellarPublicKey: { $exists: true } }).select('+stellarEncryptedSecretKey');
  
  for (const merchant of merchants) {
    if (!merchant.stellarEncryptedSecretKey) {
      console.log(`Skipping ${merchant.stellarPublicKey} - no secret key`);
      continue;
    }
    try {
      console.log(`Fixing trustline for ${merchant.stellarPublicKey}...`);
      const secret = decryptKey(merchant.stellarEncryptedSecretKey);
      const keypair = StellarSdk.Keypair.fromSecret(secret);
      const account = await server.loadAccount(keypair.publicKey());
      
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: await server.fetchBaseFee(),
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: usdcAsset
      }))
      .setTimeout(30)
      .build();
      
      transaction.sign(keypair);
      await server.submitTransaction(transaction);
      console.log(`✅ Trustline updated for ${merchant.stellarPublicKey}`);
    } catch (e) {
      console.error(`❌ Failed for ${merchant.stellarPublicKey}:`, e.response?.data?.extras?.result_codes || e.message);
    }
  }
  process.exit(0);
}
fix();
