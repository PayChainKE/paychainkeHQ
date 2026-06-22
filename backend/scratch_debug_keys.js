import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
dotenv.config();

try {
  const masterSecret = process.env.PAYCHAIN_MASTER_SECRET_KEY;
  const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);
  console.log('Master Public Key:', masterKeypair.publicKey());
  
  // Also check if USDC_ISSUER_ADDRESS is valid
  const issuer = process.env.USDC_ISSUER_ADDRESS;
  console.log('Provided Issuer:', issuer);
  if (StellarSdk.StrKey.isValidEd25519PublicKey(issuer)) {
    console.log('Issuer is a valid Ed25519 public key.');
  } else {
    console.log('Issuer is INVALID!');
  }
} catch (e) {
  console.error(e);
}
