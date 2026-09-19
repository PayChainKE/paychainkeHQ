import express from 'express';
import { listAutomations, updateAutomation, runDigestNow, previewAutomation } from '../controllers/automationController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Same convention as newsletterRoutes.js: reads are open to any admin tier,
// changes (including switching auto-send on) need owner/admin.
const requireMutator = requireRole('owner', 'admin');

router.get('/', protect, listAutomations);
router.post('/newsletter_digest/run-now', protect, requireMutator, runDigestNow);
router.post('/:key/preview', protect, requireMutator, previewAutomation);
router.put('/:key', protect, requireMutator, updateAutomation);

export default router;
