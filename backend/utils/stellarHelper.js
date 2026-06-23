import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import { decryptKey } from './cryptoHelper.js';

dotenv.config();

const NETWORK = process.env.STELLAR_NETWORK || 'TESTNET';
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const USDC_ASSET_CODE = process.env.USDC_ASSET_CODE || 'USDC';
const USDC_ISSUER_ADDRESS = process.env.USDC_ISSUER_ADDRESS || 'GBBD47IF6LWK7P7MDEVSCWT73IQIGCEYEEXIUUABHNYL5NCTHDBWFFXU';
const MASTER_SECRET_KEY = process.env.PAYCHAIN_MASTER_SECRET_KEY;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const usdcAsset = new StellarSdk.Asset(USDC_ASSET_CODE, USDC_ISSUER_ADDRESS);

/**
 * Creates a new Stellar Keypair, funds it (if testnet), and establishes a trustline for USDC.
 * @returns {Promise<{ publicKey: string, secretKey: string }>}
 */
export const provisionMerchantWallet = async () => {
  const pair = StellarSdk.Keypair.random();
  const publicKey = pair.publicKey();
  const secretKey = pair.secret();

  console.log(`🌟 Provisioning new Stellar wallet for merchant: ${publicKey}`);

  // Fund the account on Testnet via Friendbot
  if (NETWORK === 'TESTNET') {
    try {
      console.log(`🤖 Funding via Friendbot...`);
      await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
      console.log(`✅ Friendbot funding successful.`);
    } catch (e) {
      console.error('❌ Friendbot funding failed:', e.message);
      throw new Error('Failed to fund testnet account.');
    }
  } else {
    // In production, the master account would need to fund the new account using createAccount operation.
    console.warn('⚠️ Production wallet funding not implemented. Ensure account is funded externally.');
  }

  // Establish a Trustline to the USDC issuer
  try {
    const account = await server.loadAccount(publicKey);
    
    // Create the transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: usdcAsset
    }))
    .setTimeout(30)
    .build();

    // Sign with the new merchant's secret key
    transaction.sign(pair);

    // Submit the transaction
    console.log(`🔗 Submitting changeTrust operation for USDC...`);
    await server.submitTransaction(transaction);
    console.log(`✅ Trustline established successfully.`);

  } catch (error) {
    console.error('❌ Failed to establish trustline:', error.response?.data?.extras?.result_codes || error.message);
    throw new Error('Trustline establishment failed.');
  }

  return { publicKey, secretKey };
};

/**
 * Settles a payment by sending USDC from the master funding wallet to the merchant's public key.
 * @param {string} destinationPublicKey - The merchant's Stellar public key
 * @param {number} amount - The amount in USDC to send
 */
export const settleInflationShield = async (destinationPublicKey, amount) => {
  if (!MASTER_SECRET_KEY) {
    throw new Error('Master Secret Key is missing from environment.');
  }

  const masterKeypair = StellarSdk.Keypair.fromSecret(MASTER_SECRET_KEY);
  
  try {
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: destinationPublicKey,
      asset: usdcAsset,
      amount: amount.toString()
    }))
    .setTimeout(30)
    .build();

    transaction.sign(masterKeypair);

    console.log(`🚀 Sending ${amount} USDC to ${destinationPublicKey}...`);
    const response = await server.submitTransaction(transaction);
    console.log(`✅ Payment successful! Hash: ${response.hash}`);
    return response.hash;

  } catch (error) {
    console.error('❌ Inflation Shield Settlement Error:', error.response?.data?.extras?.result_codes || error.message);
    throw new Error('Blockchain settlement failed.');
  }
};

/**
 * Fetches the real-time USDC balance for a given public key.
 * @param {string} publicKey 
 * @returns {Promise<number>}
 */
export const getWalletBalance = async (publicKey) => {
  try {
    const account = await server.loadAccount(publicKey);
    const balance = account.balances.find(b => 
      b.asset_type === 'credit_alphanum4' && 
      b.asset_code === USDC_ASSET_CODE && 
      b.asset_issuer === USDC_ISSUER_ADDRESS
    );
    return balance ? parseFloat(balance.balance) : 0;
  } catch (error) {
    console.error(`⚠️ Failed to load balance for ${publicKey}:`, error.message);
    return 0;
  }
};

/**
 * Sweeps USDC from the merchant's wallet back to the Master wallet.
 * @param {string} encryptedSecretKey - The merchant's encrypted Stellar secret key
 * @param {number} amount - The amount in USDC to send
 */
export const swapUsdcToKesOnChain = async (encryptedSecretKey, amount) => {
  if (!MASTER_SECRET_KEY) {
    throw new Error('Master Secret Key is missing from environment.');
  }

  const merchantSecretKey = decryptKey(encryptedSecretKey);
  const merchantKeypair = StellarSdk.Keypair.fromSecret(merchantSecretKey);
  const masterKeypair = StellarSdk.Keypair.fromSecret(MASTER_SECRET_KEY);

  try {
    const merchantAccount = await server.loadAccount(merchantKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(merchantAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: masterKeypair.publicKey(),
      asset: usdcAsset,
      amount: amount.toString()
    }))
    .setTimeout(30)
    .build();

    transaction.sign(merchantKeypair);

    console.log(`🚀 Sweeping ${amount} USDC from ${merchantKeypair.publicKey()} to Master Wallet...`);
    const response = await server.submitTransaction(transaction);
    console.log(`✅ Swap (USDC->KES) successful! Hash: ${response.hash}`);
    return response.hash;

  } catch (error) {
    console.error('❌ USDC to KES Swap Error:', error.response?.data?.extras?.result_codes || error.message);
    throw new Error('Blockchain settlement failed.');
  }
};
