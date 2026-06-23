import express from 'express';
import multer from 'multer';
import { getPayees, addPayee, deletePayee, uploadCSV, authorizeBatch } from '../controllers/bulkPayController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';
import { generateToken } from '../controllers/mpesaController.js';

const router = express.Router();

// Setup Multer for CSV uploads (store in temp dir or memory)
const upload = multer({ dest: 'uploads/' });

// Protect all bulk pay routes with Merchant Auth
router.use(protectMerchant);

router.route('/payees')
  .get(getPayees)
  .post(addPayee);

router.delete('/payees/:id', deletePayee);

router.post('/upload-csv', upload.single('file'), uploadCSV);
router.post('/authorize', generateToken, authorizeBatch);

export default router;
