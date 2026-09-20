import jwt from 'jsonwebtoken';
import { ipKeyGenerator } from 'express-rate-limit';

// Rate-limit bucket key: the signed-in account when the request carries a
// valid token, otherwise the client IP.
//
// Keying purely on IP punishes legitimate users behind shared addresses —
// an office, a cyber café, or a mobile carrier's NAT (many Kenyan users share
// one public IP) — who would drain one 600-request bucket between them. The
// token is fully verified (signature + HS256 + expiry) before it is trusted,
// so a forged or rotated fake token just falls back to the IP bucket; an
// attacker cannot dodge the limit by inventing identities.
export function accountOrIpKey(req) {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded?.id) {
        req.rateLimitedByAccount = true;
        return `acct:${decoded.id}`;
      }
    } catch {
      // fall through to the IP bucket
    }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}
