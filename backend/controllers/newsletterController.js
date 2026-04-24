import Subscription from '../models/Subscription.js';
import { sendNewsletterConfirmation } from '../utils/resend.js';

// @desc    Subscribe to Newsletter
// @route   POST /api/newsletter
// @access  Public
export const subscribe = async (req, res) => {
  const { email } = req.body;

  try {
    let subscriber = await Subscription.findOne({ email });

    if (subscriber) {
      if (!subscriber.active) {
        subscriber.active = true;
        await subscriber.save();
        return res.json({ message: 'Subscription reactivated!' });
      }
      return res.status(400).json({ error: 'Email already subscribed' });
    }

    subscriber = await Subscription.create({ email });

    // Send Confirmation Email
    await sendNewsletterConfirmation(email);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  } catch (error) {
    console.error('Newsletter Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get all subscribers
// @route   GET /api/newsletter
// @access  Private/Admin
export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscription.find({}).sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    console.error('Get Subscribers Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
