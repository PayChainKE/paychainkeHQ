import Contact from '../models/Contact.js';

// @desc    Submit a contact form message
// @route   POST /api/contact
// @access  Public
export const createMessage = async (req, res) => {
  const { name, email, phone, contactType, subject, message, referralSource } = req.body;

  try {
    const contact = await Contact.create({
      name,
      email,
      phone,
      contactType,
      subject,
      message,
      referralSource
    });

    res.status(201).json({
      success: true,
      data: contact,
      message: 'Message received successfully'
    });
  } catch (error) {
    console.error('Create Message Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin
export const getMessages = async (req, res) => {
  try {
    const messages = await Contact.find({}).sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark message as read
// @route   PATCH /api/contact/:id/read
// @access  Private/Admin
export const markAsRead = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ error: 'Message not found' });
    }

    contact.isRead = true;
    await contact.save();

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Mark As Read Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
