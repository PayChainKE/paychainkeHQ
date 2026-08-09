import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getPayees, getPayeeById, addPayee, updatePayee, deletePayee, getBatches, getBatchById, uploadCSV, authorizeBatch, setBulkPayPin, resetBulkPayPin } from '../controllers/bulkPayController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { generateToken } from '../controllers/mpesaController.js';

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

// bulkPayPin is a 4-digit code guarding real payouts — same brute-force
// exposure as the payment PIN in authRoutes.js.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again in 15 minutes.' },
});

// set-pin now also verifies the current PIN when one already exists (see
// bulkPayController.js), so it carries the same brute-force exposure as
// reset-pin and needs the same throttle — it had none before.
router.post('/set-pin', pinLimiter, setBulkPayPin);
router.put('/reset-pin', pinLimiter, resetBulkPayPin);

// Payee routes
router.route('/payees')
  .get(getPayees)
  .post(addPayee);

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
router.post('/upload-csv', upload.single('file'), uploadCSV);
router.post('/authorize', pinLimiter, generateToken, authorizeBatch);

export default router;
