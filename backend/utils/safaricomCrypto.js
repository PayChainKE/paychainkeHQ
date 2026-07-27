import crypto from 'crypto';

// Safaricom issues separate RSA public certificates for the Daraja sandbox
// and production environments (downloaded from the Daraja portal — the
// production one only becomes available once B2C is approved on your live
// app). Supplied via env var, never hardcoded here: a real production
// certificate is account-specific key material that shouldn't sit in
// source control, and a fabricated/placeholder certificate (the previous
// state of this file) doesn't fail loudly — it just produces a bogus
// SecurityCredential that Safaricom silently rejects, or that a caller
// mistakes for a real one.
//
// MPESA_B2C_SANDBOX_CERT / MPESA_B2C_PRODUCTION_CERT — paste the cert
// exactly as downloaded, with real newlines replaced by literal \n
// (most hosting UIs, including Render, require single-line values for
// multi-line secrets; normalizeCert() below reverses that).
const mpesaEnv = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
const isLive = mpesaEnv === 'live';

export class SecurityCredentialError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityCredentialError';
  }
}

function normalizeCert(cert) {
  return cert ? cert.replace(/\\n/g, '\n') : null;
}

export const generateSecurityCredential = (password) => {
  const envVar = isLive ? 'MPESA_B2C_PRODUCTION_CERT' : 'MPESA_B2C_SANDBOX_CERT';
  const cert = normalizeCert(process.env[envVar]);

  if (!cert) {
    throw new SecurityCredentialError(
      `${envVar} is not set — B2C cannot generate a valid SecurityCredential without Safaricom's real certificate for this environment.`
    );
  }
  if (!password) {
    throw new SecurityCredentialError('generateSecurityCredential called without a password to encrypt.');
  }

  try {
    const encrypted = crypto.publicEncrypt(
      { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password)
    );
    return encrypted.toString('base64');
  } catch (error) {
    // Never fall back to a mock value — a B2C call carrying a fake
    // credential doesn't fail safely, it just gets silently rejected (or
    // worse, silently accepted somewhere it shouldn't be). Surface the
    // real cause instead.
    throw new SecurityCredentialError(`Failed to encrypt security credential: ${error.message}`);
  }
};
