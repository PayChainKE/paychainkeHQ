const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');
const { getWelcomeEmailTemplate } = require('./email-templates');
require('dotenv').config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/paychainke')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Waitlist Model
const waitlistSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  businessName: { type: String, required: true },
  phone: { type: String, required: true },
  businessType: { type: String, required: true },
  email: { type: String },
  challenge: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'waitlist' });

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

// Newsletter Schema
const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  status: { type: String, default: 'active' },
  subscribedAt: { type: Date, default: Date.now }
}, { collection: 'newsletter' });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// Contact Message Schema
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  contactType: {
    type: String,
    required: true,
    enum: ['merchant','investor','partnership','press','developer','careers','other']
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  referralSource: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  repliedAt: { type: Date },
}, { timestamps: true, collection: 'contacts' });

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

// Routes
// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/waitlist', async (req, res) => {
  try {
    const { fullName, businessName, phone, businessType, email, challenge } = req.body;
    const newEntry = new Waitlist({ fullName, businessName, phone, businessType, email, challenge });
    await newEntry.save();

    // Send welcome email if email is provided
    if (email && email.includes('@')) {
      try {
        await resend.emails.send({
          from: 'PayChain <info@paychain.co.ke>',
          to: [email],
          subject: 'Welcome to the PayChain Waitlist!',
          html: getWelcomeEmailTemplate(fullName),
        });
        console.log(`Welcome email sent to ${email}`);
      } catch (emailErr) {
        console.error('Error sending welcome email:', emailErr);
        // We don't fail the request if the email fails
      }
    }

    res.status(201).json({ message: 'Waitlist entry saved successfully' });
  } catch (err) {
    console.error('Error saving waitlist entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Check for duplicates
    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'This email is already subscribed to our newsletter' });
    }

    // Save to Database
    const newSubscriber = new Newsletter({ email });
    await newSubscriber.save();

    // Sync with Resend Contacts and Send Welcome Email
    try {
      // 1. Add to Resend Contacts (if Audience ID exists, but we can use contacts.create for general storage)
      // Note: for now we use general email sending, but we can also add to a list if provided.
      
      // 2. Send automated welcome newsletter email
      await resend.emails.send({
        from: 'PayChain <info@paychain.co.ke>',
        to: [email],
        subject: 'Welcome to the PayChain Newsletter!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
            <div style="margin-bottom: 30px;">
              <img src="https://paychain.co.ke/logo.png" alt="PayChain" style="height: 40px; width: auto;" />
            </div>
            <h1 style="font-size: 24px; font-weight: 800;">Thanks for subscribing!</h1>
            <p>You're now subscribed to the PayChain Newsletter. We'll keep you updated on the latest fintech trends, M-PESA fraud prevention, and product updates.</p>
            <p>Stay tuned for our next update!</p>
            <br />
            <p>Best regards,<br />The PayChain Team</p>
          </div>
        `,
      });
      console.log(`Newsletter welcome email sent to ${email}`);
    } catch (apiErr) {
      console.error('Resend API error:', apiErr);
      // We don't fail the request if Resend fails, as the DB entry is saved
    }

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Error subscribing to newsletter:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/newsletter', async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    console.error('Error fetching newsletter subscribers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/waitlist', async (req, res) => {
  try {
    const entries = await Waitlist.find().sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error('Error fetching waitlist entries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact Routes
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone = '', contactType, subject, message, referralSource = '' } = req.body;
    
    // Basic validation
    if (!name || !email || !contactType || !subject || !message) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const contact = new ContactMessage({ name, email, phone, contactType, subject, message, referralSource });
    await contact.save();

    res.status(201).json({ message: 'Message received successfully' });
  } catch (err) {
    console.error('Error saving contact message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const filter = {};
    if (req.query.isRead === 'false') filter.isRead = false;
    const messages = await ContactMessage.find(filter).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/contact/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await ContactMessage.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (err) {
    console.error('Error updating contact message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
