import crypto from 'crypto';

// Daraja's "Test Credentials" portal tool encrypts your Initiator Password
// with Safaricom's public key server-side and hands back the finished
// SecurityCredential string directly — it doesn't expose a downloadable
// certificate file. RSA/PKCS1 encryption of the same password decrypts to
// the same password on Safaricom's end regardless of when it was encrypted,
// so that value is static: generate it once per environment on the portal
// and store it as MPESA_B2C_SECURITY_CREDENTIAL_SANDBOX /
// MPESA_B2C_SECURITY_CREDENTIAL_PRODUCTION. It only needs regenerating if
// the Initiator password itself changes.
//
// If a real certificate ever does become available (e.g. via a Safaricom
// account rep), MPESA_B2C_SANDBOX_CERT / MPESA_B2C_PRODUCTION_CERT are
// still supported as a fallback so the credential can be derived from a
// password at request time instead of a fixed precomputed value.
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
  const staticEnvVar = isLive ? 'MPESA_B2C_SECURITY_CREDENTIAL_PRODUCTION' : 'MPESA_B2C_SECURITY_CREDENTIAL_SANDBOX';
  const staticCredential = process.env[staticEnvVar];
  if (staticCredential) {
    return staticCredential;
  }

  const certEnvVar = isLive ? 'MPESA_B2C_PRODUCTION_CERT' : 'MPESA_B2C_SANDBOX_CERT';
  const cert = normalizeCert(process.env[certEnvVar]);

  if (!cert) {
    throw new SecurityCredentialError(
      `Neither ${staticEnvVar} nor ${certEnvVar} is set — B2C cannot generate a valid SecurityCredential for this environment.`
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
