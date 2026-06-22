import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY; // Must be 256 bits (64 hex characters / 32 bytes)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is standard for GCM

if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  throw new Error('FATAL: ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes).');
}

/**
 * Encrypts a sensitive string (like a Stellar Secret Key)
 * @param {string} text - The plaintext string to encrypt
 * @returns {string} - The format is ivHex:authTagHex:encryptedHex
 */
export const encryptKey = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts a previously encrypted string
 * @param {string} encryptedData - The format ivHex:authTagHex:encryptedHex
 * @returns {string} - The plaintext string
 */
export const decryptKey = (encryptedData) => {
  if (!encryptedData) return null;
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
