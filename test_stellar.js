import * as StellarSdk from '@stellar/stellar-sdk';

const MASTER_SECRET_KEY = 'SDYQXVIXSRGGG4UTIHPKIAZ7A5OF2HOCFF7MW52LX76AKBYXJ75BPFTJ';
const keypair = StellarSdk.Keypair.fromSecret(MASTER_SECRET_KEY);
console.log('Public Key:', keypair.publicKey());

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
server.loadAccount(keypair.publicKey())
  .then(acc => {
    console.log('Balances:', acc.balances);
  })
  .catch(err => {
    console.error('Account not found on testnet!');
  });
