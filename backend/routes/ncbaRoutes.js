import crypto from 'crypto';
import express from 'express';
import { handleNcbaReconciliationWebhook, handleInitiateBulkPayment } from '../controllers/ncbaController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Constant-time string compare — a plain `===` leaks how many leading bytes
// matched via response timing, which is a real attack surface on a
// credential check reachable from the public internet. Both buffers must be
// equal length for timingSafeEqual to run at all, so unequal lengths are
// handled (and still compared against *something* of the right length) so
// that a wrong-length guess doesn't short-circuit faster than a right-length
// wrong guess.
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, Buffer.alloc(aBuf.length));
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Inline HTTP Basic Auth for the NCBA webhook — this is a bank-to-server
// credential check, deliberately separate from protectMerchant's JWT flow
// (which authenticates our own merchants, not the bank's core banking rail).
function verifyNcbaBasicAuth(req, res, next) {
  const expectedUsername = process.env.NCBA_API_USERNAME;
  const expectedPassword = process.env.NCBA_API_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'ncba_webhook_auth_misconfigured',
      message: 'NCBA_API_USERNAME / NCBA_API_PASSWORD not set',
    }));
    return res.status(500).json({ resultCode: 'SERVER_MISCONFIGURED', resultDescription: 'Webhook authentication is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, encodedCredentials] = authHeader.split(' ');

  if (scheme !== 'Basic' || !encodedCredentials) {
    res.set('WWW-Authenticate', 'Basic realm="NCBA Webhook"');
    return res.status(401).json({ resultCode: 'UNAUTHORIZED', resultDescription: 'Missing or malformed Authorization header' });
  }

  let username = '';
  let password = '';
  try {
    const decoded = Buffer.from(encodedCredentials, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) throw new Error('missing ":" separator');
    username = decoded.slice(0, separatorIndex);
    password = decoded.slice(separatorIndex + 1);
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="NCBA Webhook"');
    return res.status(401).json({ resultCode: 'UNAUTHORIZED', resultDescription: 'Malformed Authorization header' });
  }

  const credentialsMatch =
    timingSafeStringEqual(username, expectedUsername) &
    timingSafeStringEqual(password, expectedPassword);

  if (!credentialsMatch) {
    console.warn(JSON.stringify({ level: 'warn', event: 'ncba_webhook_auth_failed', path: req.path }));
    res.set('WWW-Authenticate', 'Basic realm="NCBA Webhook"');
    return res.status(401).json({ resultCode: 'UNAUTHORIZED', resultDescription: 'Invalid credentials' });
  }

  next();
}

// Public webhook — NCBA's real-time reconciliation push. JSON body, parsed
// by the app-wide express.json() middleware already applied in server.js.
// Bank-authenticated via HTTP Basic Auth rather than our merchant JWT flow.
router.post('/webhooks/ncba-reconciliation', verifyNcbaBasicAuth, handleNcbaReconciliationWebhook);

// Merchant-initiated NCBA bulk disbursements (suppliers + utility payouts).
router.post('/bulk-payments', protectMerchant, handleInitiateBulkPayment);

export default router;
