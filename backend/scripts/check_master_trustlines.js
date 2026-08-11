import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const masterKeypair = StellarSdk.Keypair.fromSecret(process.env.PAYCHAIN_MASTER_SECRET_KEY);

async function check() {
  console.log("Master PK:", masterKeypair.publicKey());
  const acc = await server.loadAccount(masterKeypair.publicKey());
  console.log("Balances:", acc.balances);
  process.exit(0);
}
check();
