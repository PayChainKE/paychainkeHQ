import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getPayees, getPayeeById, addPayee, updatePayee, deletePayee, getBatches, getBatchById, uploadCSV, authorizeBatch } from '../controllers/bulkPayController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

// Setup Multer for CSV uploads (store in temp dir or memory). Previously
// had no size cap or type filter at all — any authenticated merchant could
// upload arbitrarily large or arbitrary-type files to disk repeatedly.
// Bulk pay CSVs are just payee lists; 2MB comfortably fits thousands of
// rows. text/csv is inconsistently reported by browsers/OSes, so this
// also allows the generic octet-stream/plain fallbacks multer commonly
// sees for .csv, same pattern as newsletterRoutes.js's image fileFilter.
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'text/plain'];
    cb(null, ok.includes(file.mimetype) || file.originalname?.toLowerCase().endsWith('.csv'));
  },
});

// Protect all bulk pay routes with Merchant Auth
router.use(protectMerchant);

// The 4-digit Payment PIN guarding authorizeBatch's real payouts is set and
// changed via the shared endpoints in authRoutes.js (set-app-pin /
// reset-app-pin) — there's no bulk-pay-specific PIN or PIN route anymore.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

// Only /authorize had its own throttle beyond the app-wide 600/15min
// backstop in server.js — payee writes and CSV upload (disk I/O) had no
// dedicated limit, letting a compromised/malicious authenticated session
// hammer either well within that generous global cap. Found during a
// security review of the bulk-pay flow.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Try again in 15 minutes.' },
});

// Payee routes
router.route('/payees')
  .get(getPayees)
  .post(writeLimiter, addPayee);

router.route('/payees/:id')
  .get(getPayeeById)
  .put(writeLimiter, updatePayee)
  .delete(writeLimiter, deletePayee);

// Batch routes
router.route('/batches')
  .get(getBatches);

router.route('/batches/:id')
  .get(getBatchById);

// CSV and Authorization
router.post('/upload-csv', uploadLimiter, upload.single('file'), uploadCSV);
// Was `pinLimiter, generateToken, authorizeBatch` — generateToken fetches a
// Safaricom Daraja OAuth token that authorizeBatch never reads (bulk pay is
// 100% NCBA-routed now). Left in place, it meant every bulk-pay batch
// authorization — including pure bank/KPLC/NCWSC ones with zero Daraja
// involvement — silently depended on Safaricom's OAuth endpoint being up
// and MPESA_CONSUMER_KEY/SECRET being configured, an unrelated single point
// of failure discovered during a security review of this route.
router.post('/authorize', pinLimiter, authorizeBatch);

export default router;
