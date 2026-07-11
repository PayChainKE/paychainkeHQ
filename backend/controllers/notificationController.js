import Notification from '../models/Notification.js';

// Internal helper — called from other controllers when a notification-worthy
// event happens (payment received, link paid, new sign-in, wallet activated).
// Never throws: a failed notification write should never break the calling flow.
export const createNotification = async ({ merchantId, kind, title, message }) => {
  try {
    await Notification.create({ merchantId, kind, title, message });
  } catch (error) {
    console.error('❌ Failed to create notification:', error.message);
  }
};

// @desc    List merchant's recent notifications
// @route   GET /api/notifications
// @access  Private
export const listNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ merchantId: req.merchant._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ Error listing notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ merchantId: req.merchant._id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    console.error('❌ Error counting unread notifications:', error);
    res.status(500).json({ error: 'Failed to fetch unread count.' });
  }
};

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.merchant._id },
      { read: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('❌ Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ merchantId: req.merchant._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      merchantId: req.merchant._id,
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
};
