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
});

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

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

app.get('/api/waitlist', async (req, res) => {
  try {
    const entries = await Waitlist.find().sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error('Error fetching waitlist entries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
