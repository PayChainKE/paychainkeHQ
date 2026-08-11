import express from 'express';
import rateLimit from 'express-rate-limit';
import { handleNcbaReconciliationWebhook, handleInitiateBulkPayment } from '../controllers/ncbaController.js';
import { handleNcbaAccountNotification } from '../controllers/ncbaAccountNotificationController.js';
import { handleBankPayout, handlePesaLinkCallback, getBankCodes, handlePesaLinkPhoneLookup } from '../controllers/ncbaOpenBankingController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { timingSafeStringEqual } from '../utils/timingSafeCompare.js';

const router = express.Router();

// Both routes below check a 4-digit PIN inline — same brute-force exposure
// as every other PIN-guarded endpoint in the app.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

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

// Public webhook — NCBA's Account-Level Notification Push (SOAP XML).
// Separate endpoint from the reconciliation push above: this one fires on
// every debit/credit on PayChain's NCBA account, not just merchant virtual
// account collections — see controllers/ncbaAccountNotificationController.js
// for why that distinction matters. Per NCBA's Account-Level Notification
// Push Service Guide, auth here is NOT an HTTP header — <User>/<Password>/
// <HashVal> are embedded in the XML body itself, so verification happens
// inside the controller (after XML parsing) rather than as route middleware.
router.post(
  '/webhooks/ncba-account-notification',
  express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'], limit: '64kb' }),
  handleNcbaAccountNotification
);

// Merchant-initiated NCBA bulk disbursements (suppliers + utility payouts).
router.post('/bulk-payments', protectMerchant, pinLimiter, handleInitiateBulkPayment);

// Merchant-initiated single withdrawal to a bank account via NCBA Open
// Banking's PesaLink rail — see controllers/ncbaOpenBankingController.js.
router.post('/openbanking/bank-payout', protectMerchant, pinLimiter, handleBankPayout);
router.get('/openbanking/bank-codes', protectMerchant, getBankCodes);

// Phone-number-to-bank lookup ahead of a PesaLink/EFT transfer — same abuse
// posture as pinLimiter above (an external NCBA lookup, not PIN-specific).
const pesalinkLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookups. Try again in 15 minutes.' },
});
router.post('/openbanking/pesalink-lookup-phone', protectMerchant, pesalinkLookupLimiter, handlePesaLinkPhoneLookup);

// Public webhook — NCBA's Open Banking per-transaction result callback.
// Bank-authenticated the same way as the reconciliation webhook above: this
// resolves 'pending' Transaction/PayoutBatch rows created by bulk payouts
// (see services/ncbaBulkPaymentService.js) by refunding on failure, so it
// must not be reachable by anyone who can merely guess/read a payment
// reference — see handlePesaLinkCallback's doc comment.
router.post('/webhooks/ncba-openbanking-callback', verifyNcbaBasicAuth, handlePesaLinkCallback);

export default router;
