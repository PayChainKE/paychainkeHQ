import express from 'express';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { protectMerchant } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectMerchant, listNotifications);
router.get('/unread-count', protectMerchant, getUnreadCount);
router.patch('/read-all', protectMerchant, markAllNotificationsRead);
router.patch('/:id/read', protectMerchant, markNotificationRead);
router.delete('/:id', protectMerchant, deleteNotification);

export default router;
