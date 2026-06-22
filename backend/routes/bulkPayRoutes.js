import express from 'express';
import multer from 'multer';
import { getPayees, addPayee, uploadCSV, authorizeBatch } from '../controllers/bulkPayController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Setup Multer for CSV uploads (store in temp dir or memory)
const upload = multer({ dest: 'uploads/' });

// Protect all bulk pay routes with Merchant Auth
router.use(protect);

router.route('/payees')
  .get(getPayees)
  .post(addPayee);

router.post('/upload-csv', upload.single('file'), uploadCSV);
router.post('/authorize', authorizeBatch);

export default router;
