import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getPayees, getPayeeById, addPayee, updatePayee, deletePayee, getBatches, getBatchById, uploadCSV, authorizeBatch, setBulkPayPin, resetBulkPayPin } from '../controllers/bulkPayController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { generateToken } from '../controllers/mpesaController.js';

const router = express.Router();

// Setup Multer for CSV uploads (store in temp dir or memory)
const upload = multer({ dest: 'uploads/' });

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

router.post('/set-pin', setBulkPayPin);
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
