import * as StellarSdk from '@stellar/stellar-sdk';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const masterSecret = process.env.PAYCHAIN_MASTER_SECRET_KEY;
const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);

async function setup() {
  try {
    const issuerKeypair = StellarSdk.Keypair.random();
    console.log("Issuer Public:", issuerKeypair.publicKey());
    
    // 1. Fund Issuer from Master
    console.log("Master funding issuer...");
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());
    const txFund = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.createAccount({
      destination: issuerKeypair.publicKey(),
      startingBalance: "100"
    }))
    .setTimeout(30)
    .build();
    txFund.sign(masterKeypair);
    await server.submitTransaction(txFund);
    console.log("Issuer created and funded.");

    const usdcAsset = new StellarSdk.Asset('USDC', issuerKeypair.publicKey());

    // 2. Master establishes Trustline to Issuer
    console.log("Master establishing trustline to new issuer...");
    // reload master account to update sequence number
    const masterAccount2 = await server.loadAccount(masterKeypair.publicKey());
    const txTrust = new StellarSdk.TransactionBuilder(masterAccount2, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: usdcAsset,
      limit: "100000000"
    }))
    .setTimeout(30)
    .build();
    txTrust.sign(masterKeypair);
    await server.submitTransaction(txTrust);
    console.log("Trustline established.");

    // 3. Issuer mints USDC to Master
    console.log("Issuer minting USDC to Master...");
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    const txMint = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
    .addOperation(StellarSdk.Operation.payment({
      destination: masterKeypair.publicKey(),
      asset: usdcAsset,
      amount: "1000000"
    }))
    .setTimeout(30)
    .build();
    txMint.sign(issuerKeypair);
    await server.submitTransaction(txMint);
    console.log("Master funded with 1,000,000 USDC.");

    // 4. Update .env file
    let envContent = fs.readFileSync('.env', 'utf8');
    envContent = envContent.replace(/USDC_ISSUER_ADDRESS=.*/, `USDC_ISSUER_ADDRESS=${issuerKeypair.publicKey()}`);
    fs.writeFileSync('.env', envContent);
    console.log(".env updated with new USDC_ISSUER_ADDRESS.");

  } catch (err) {
    console.error("Error:", err.response?.data?.extras?.result_codes || err.message);
  }
}
setup();
