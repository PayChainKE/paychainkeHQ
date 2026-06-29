import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import { sendSupportReply } from '../utils/resend.js';

const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// @desc    Public contact-form submission.
// @route   POST /api/contact
// @access  Public
export const createMessage = async (req, res) => {
  const { name, email, phone, contactType, subject, message, referralSource } = req.body;
  try {
    const contact = await Contact.create({ name, email, phone, contactType, subject, message, referralSource });
    res.status(201).json({ success: true, data: contact, message: 'Message received successfully' });
  } catch (error) {
    console.error('Create Message Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((v) => v.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Admin inbox — full list, populated with replier info.
// @route   GET /api/contact
// @access  Private (Admin)
export const getMessages = async (req, res) => {
  try {
    const messages = await Contact.find({})
      .sort({ priority: -1, createdAt: -1 })
      .populate('replies.sentBy', 'email')
      .lean();
    res.json(messages);
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark a single message read.
// @route   PATCH /api/contact/:id/read
// @access  Private (Admin)
export const markAsRead = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Mark As Read Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark a single message unread.
// @route   PATCH /api/contact/:id/unread
// @access  Private (Admin)
export const markAsUnread = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: false },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Mark As Unread Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Toggle priority/flag on a message.
// @route   PATCH /api/contact/:id/priority
// @access  Private (Admin)
export const togglePriority = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Message not found' });
    contact.priority = !contact.priority;
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Toggle Priority Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Change conversation status (open/in_progress/resolved/closed).
// @route   PATCH /api/contact/:id/status
// @access  Private (Admin)
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Message not found' });
    contact.status = status;
    if (status === 'closed' || status === 'resolved') contact.closedAt = new Date();
    else contact.closedAt = null;
    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a reply to the customer (via Resend) and log it on the
//          conversation. Auto-marks the conversation as in_progress and read.
// @route   POST /api/contact/:id/reply
// @access  Private (Admin)
export const replyToMessage = async (req, res) => {
  try {
    const { body, subject, attachments } = req.body || {};
    if (!body || String(body).trim().length < 2) {
      return res.status(400).json({ error: 'Reply body cannot be empty.' });
    }
    if (String(body).length > 10000) {
      return res.status(400).json({ error: 'Reply body too long.' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Message not found' });

    let resendId = null;
    try {
      const emailSubject = subject || contact.subject;
      const sent = await sendSupportReply(contact.email, contact.name, emailSubject, body, req.admin?.email, attachments || []);
      resendId = sent?.data?.id || sent?.id || null;
    } catch (mailErr) {
      // Surface the email failure to the admin — don't silently log a reply
      // that never went out.
      return res.status(502).json({ error: 'Failed to dispatch the reply email. The reply was not saved.' });
    }

    contact.replies.push({
      body: String(body).trim(),
      subject: subject || contact.subject,
      attachments: attachments || [],
      sentByEmail: req.admin?.email || 'support@paychain.co.ke',
      sentBy: req.admin?._id || null,
      sentAt: new Date(),
      resendId,
    });
    contact.lastRepliedAt = new Date();
    contact.isRead = true;
    if (contact.status === 'open') contact.status = 'in_progress';
    await contact.save();

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Reply To Message Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete a message permanently.
// @route   DELETE /api/contact/:id
// @access  Private (Admin)
export const deleteMessage = async (req, res) => {
  try {
    const result = await Contact.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: 'Message removed.' });
  } catch (error) {
    console.error('Delete Message Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Bulk delete messages
// @route   POST /api/contact/bulk-delete
// @access  Private (Admin)
export const bulkDeleteMessages = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No message IDs provided' });
    }
    const result = await Contact.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `Deleted ${result.deletedCount} messages.` });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get delivery status for a reply
// @route   GET /api/contact/delivery-status/:resendId
// @access  Private (Admin)
export const getDeliveryStatus = async (req, res) => {
  try {
    const { resendId } = req.params;
    if (!resendId) return res.status(400).json({ error: 'No resend ID provided' });
    
    // We import Resend dynamically to fetch status
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const emailData = await resend.emails.get(resendId);
    if (emailData?.data) {
      // Return status which can be "sent", "delivered", "bounced", etc.
      res.json({ success: true, status: emailData.data.last_event || 'sent' });
    } else {
      res.json({ success: true, status: 'unknown' });
    }
  } catch (error) {
    console.error('Get Delivery Status Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload an attachment for a reply
// @route   POST /api/contact/upload-attachment
// @access  Private (Admin)
export const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    // req.file.path is the Cloudinary URL if using multer-storage-cloudinary
    res.json({ success: true, url: req.file.path });
  } catch (error) {
    console.error('Upload Attachment Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
