import jwt from 'jsonwebtoken';

// Default 30d for merchant tokens (mobile app expects long sessions).
// Admin tokens explicitly pass '12h' to limit blast radius on a stolen token.
// `extraClaims` lets callers embed e.g. { tokenVersion } so a later bump to
// that field on the account invalidates every token issued before it —
// how "Sign Out All Devices" revokes access without a server-side session store.
const generateToken = (id, expiresIn = '30d', extraClaims = {}) => {
  return jwt.sign({ id, ...extraClaims }, process.env.JWT_SECRET, {
    expiresIn
  });
};

export default generateToken;
