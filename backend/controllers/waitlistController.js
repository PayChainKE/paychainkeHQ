import Waitlist from '../models/Waitlist.js';
import { sendWaitlistConfirmation } from '../utils/resend.js';

// @desc    Join Waitlist
// @route   POST /api/waitlist
// @access  Public
export const joinWaitlist = async (req, res) => {
  const { fullName, businessName, phone, email, businessType, challenge } = req.body;

  try {
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'This email is already on our waitlist!' });
    }

    const subscriber = await Waitlist.create({
      fullName,
      businessName,
      phone,
      email,
      businessType,
      challenge
    });

    // Send Confirmation Email
    if (email) {
      await sendWaitlistConfirmation(email, fullName);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the waitlist'
    });
  } catch (error) {
    console.error('Waitlist Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get all waitlist entries
// @route   GET /api/waitlist
// @access  Private/Admin (To be protected soon)
export const getWaitlist = async (req, res) => {
  try {
    const entries = await Waitlist.find({}).sort({ createdAt: -1 });
    res.json(entries);
  } catch (error) {
    console.error('Get Waitlist Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
