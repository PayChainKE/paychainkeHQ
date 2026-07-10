import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import { decryptKey } from './cryptoHelper.js';

dotenv.config();

// Exported so every module that needs to recognise "is this a USDC trustline
// to our issuer" (e.g. walletAuditController) reads the exact same value —
// two independently-hardcoded copies of this address previously drifted,
// which made the wallet audit page misreport USDC trustlines as missing.
export const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'TESTNET';
export const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const USDC_ASSET_CODE = process.env.USDC_ASSET_CODE || 'USDC';
// Placeholder only — this fallback fails checksum validation unless
// USDC_ISSUER_ADDRESS is set, which crashes the process at import time.
// Set the real issuer via env for any environment that touches Stellar/USDC.
export const USDC_ISSUER_ADDRESS = process.env.USDC_ISSUER_ADDRESS || 'GCCS5HLSMPIHCFIJIEKBHAS6WXCBUATQ4APAV5LWJ7E2U2HPYPWZ6TAE';
const NETWORK = STELLAR_NETWORK;
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

  // Establish a trustline to the USDC issuer
  console.log(`🔗 Establishing USDC trustline (issuer ${USDC_ISSUER_ADDRESS.slice(0,8)}...)...`);
  try {
    const account = await server.loadAccount(publicKey);
    const networkPassphrase = NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: await server.fetchBaseFee(),
      networkPassphrase,
    })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(30)
    .build();

    transaction.sign(pair);
    await server.submitTransaction(transaction);
    console.log(`✅ Trustline established.`);

  } catch (error) {
    const codes = error.response?.data?.extras?.result_codes;
    console.error('❌ Trustline error:', JSON.stringify(codes) || error.message);
    throw new Error('Trustline establishment failed.');
  }

  return { publicKey, secretKey };
};

/**
 * Settles a payment by sending USDC from the master funding wallet to the merchant's public key.
 * @param {string} destinationPublicKey - The merchant's Stellar public key
 * @param {number} amount - The amount in USDC to send
 */
// Stellar only accepts amounts with up to 7 decimal places.
const toStellarAmount = (n) => parseFloat(n).toFixed(7);

export const settleInflationShield = async (destinationPublicKey, amount) => {
  if (!MASTER_SECRET_KEY) throw new Error('PAYCHAIN_MASTER_SECRET_KEY is not set.');

  const stellarAmount = toStellarAmount(amount);
  if (parseFloat(stellarAmount) <= 0) throw new Error('Swap amount too small (rounds to 0 USDC).');

  const masterKeypair = StellarSdk.Keypair.fromSecret(MASTER_SECRET_KEY);
  const networkPassphrase = NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

  try {
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase,
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: destinationPublicKey,
      asset: usdcAsset,
      amount: stellarAmount,
    }))
    .setTimeout(30)
    .build();

    transaction.sign(masterKeypair);

    console.log(`🚀 Sending ${stellarAmount} USDC (issuer ${USDC_ISSUER_ADDRESS.slice(0,8)}) → ${destinationPublicKey}`);
    
    let response;
    let attempts = 0;
    while (attempts < 3) {
      try {
        response = await server.submitTransaction(transaction);
        break;
      } catch (err) {
        attempts++;
        if (attempts >= 3 || (err.response && err.response.data && err.response.data.extras && err.response.data.extras.result_codes)) {
          throw err;
        }
        console.warn(`⚠️ Stellar network fetch failed. Retrying attempt ${attempts}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Settlement hash: ${response.hash}`);
    return response.hash;

  } catch (error) {
    const codes = error.response?.data?.extras?.result_codes;
    console.error('❌ Settlement error — result_codes:', JSON.stringify(codes), '| message:', error.message);
    const hint = codes?.operations?.includes('op_no_trust')
      ? 'Merchant wallet has no USDC trustline for this issuer.'
      : codes?.operations?.includes('op_underfunded')
      ? 'Master wallet has insufficient USDC balance.'
      : codes?.operations?.includes('op_no_destination')
      ? 'Destination account does not exist on the network.'
      : null;
    throw new Error(hint || `Blockchain settlement failed (${JSON.stringify(codes) || error.message}).`);
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
  if (!MASTER_SECRET_KEY) throw new Error('PAYCHAIN_MASTER_SECRET_KEY is not set.');

  const stellarAmount = toStellarAmount(amount);
  if (parseFloat(stellarAmount) <= 0) throw new Error('Swap amount too small (rounds to 0 USDC).');

  const merchantSecretKey = decryptKey(encryptedSecretKey);
  if (!merchantSecretKey) throw new Error('Could not decrypt merchant secret key.');

  const merchantKeypair = StellarSdk.Keypair.fromSecret(merchantSecretKey);
  const masterKeypair   = StellarSdk.Keypair.fromSecret(MASTER_SECRET_KEY);
  const networkPassphrase = NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

  try {
    const merchantAccount = await server.loadAccount(merchantKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(merchantAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase,
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: masterKeypair.publicKey(),
      asset: usdcAsset,
      amount: stellarAmount,
    }))
    .setTimeout(30)
    .build();

    transaction.sign(merchantKeypair);

    console.log(`🚀 Sweeping ${stellarAmount} USDC from ${merchantKeypair.publicKey()} → master`);
    
    let response;
    let attempts = 0;
    while (attempts < 3) {
      try {
        response = await server.submitTransaction(transaction);
        break;
      } catch (err) {
        attempts++;
        if (attempts >= 3 || (err.response && err.response.data && err.response.data.extras && err.response.data.extras.result_codes)) {
          throw err;
        }
        console.warn(`⚠️ Stellar network fetch failed. Retrying attempt ${attempts}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ USDC sweep hash: ${response.hash}`);
    return response.hash;

  } catch (error) {
    const codes = error.response?.data?.extras?.result_codes;
    console.error('❌ USDC sweep error — result_codes:', JSON.stringify(codes), '| message:', error.message);
    const hint = codes?.operations?.includes('op_underfunded')
      ? 'Merchant wallet has insufficient USDC to sweep.'
      : codes?.operations?.includes('op_no_trust')
      ? 'Merchant wallet has no USDC trustline for this issuer.'
      : null;
    throw new Error(hint || `Blockchain sweep failed (${JSON.stringify(codes) || error.message}).`);
  }
};
