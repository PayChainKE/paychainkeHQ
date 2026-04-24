import express from 'express';
import { createMessage, getMessages, markAsRead } from '../controllers/contactController.js';
// Assuming protect middleware exists for admin routes
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createMessage);
router.get('/', protect, getMessages);
router.patch('/:id/read', protect, markAsRead);

export default router;
