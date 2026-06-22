import dotenv from 'dotenv';
dotenv.config();

import { provisionMerchantWallet } from './utils/stellarHelper.js';
import { encryptKey } from './utils/cryptoHelper.js';

async function testActivation() {
  try {
    console.log('Testing provisionMerchantWallet...');
    const wallet = await provisionMerchantWallet();
    console.log('Wallet provisioned:', wallet.publicKey);
    
    console.log('Testing encryptKey...');
    const encrypted = encryptKey(wallet.secretKey);
    console.log('Key encrypted:', encrypted);
    
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
  process.exit();
}

testActivation();
