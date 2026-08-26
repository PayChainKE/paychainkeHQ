import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getPayees, getPayeeById, addPayee, updatePayee, deletePayee, getBatches, getBatchById, uploadCSV, authorizeBatch, validateKplcMeter, validateNcwscMeter, validateKplcPrepaidMeter } from '../controllers/bulkPayController.js';
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

// External NCBA lookup — same abuse-prevention posture as pinLimiter above,
// just not PIN-specific (guards against a merchant hammering NCBA's biller
// validation endpoints via repeated Add-Payee attempts).
const utilityValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many meter lookups. Try again in 15 minutes.' },
});

// Authenticated but otherwise unthrottled writes — only the global 600/15min
// IP backstop covered these before. Generous limit since a merchant
// legitimately adding payees or re-uploading a CSV a few times in a
// session shouldn't ever come close to it.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});

// Payee routes
router.route('/payees')
  .get(getPayees)
  .post(writeLimiter, addPayee);

router.post('/validate-kplc-meter', utilityValidationLimiter, validateKplcMeter);
router.post('/validate-kplc-prepaid-meter', utilityValidationLimiter, validateKplcPrepaidMeter);
router.post('/validate-ncwsc-meter', utilityValidationLimiter, validateNcwscMeter);

router.route('/payees/:id')
  .get(getPayeeById)
  .put(updatePayee)
  .delete(deletePayee);

// Batch routes
router.route('/batches')
  .get(getBatches);

router.route('/batches/:id')
  .get(getBatchById);

// CSV and Authorization
router.post('/upload-csv', writeLimiter, upload.single('file'), uploadCSV);
router.post('/authorize', pinLimiter, authorizeBatch);

export default router;
