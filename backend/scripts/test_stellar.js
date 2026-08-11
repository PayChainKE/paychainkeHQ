import * as StellarSdk from '@stellar/stellar-sdk';
import 'dotenv/config';

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

async function checkAccount() {
  try {
    const keypair = StellarSdk.Keypair.fromSecret(process.env.PAYCHAIN_MASTER_SECRET_KEY);
    const account = await server.loadAccount(keypair.publicKey());
    console.log('Account balances:');
    account.balances.forEach(b => console.log(b));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
checkAccount();
