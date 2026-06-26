import jwt from 'jsonwebtoken';

// Default 30d for merchant tokens (mobile app expects long sessions).
// Admin tokens explicitly pass '12h' to limit blast radius on a stolen token.
const generateToken = (id, expiresIn = '30d') => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn
  });
};

export default generateToken;
