const { validationResult } = require('express-validator');
const ContactMessage = require('../models/ContactMessage');
// const nodemailer = require('nodemailer'); // TODO: enable when SMTP creds are configured

/**
 * POST /api/contact
 * Validates request using express-validator on the route.
 * On success: saves to MongoDB Contacts collection and returns success JSON.
 * On validation failure: returns 400 { errors: [...] }
 */
exports.submitContact = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone = '', contactType, subject, message, referralSource = '' } = req.body;

  try {
    const contact = new ContactMessage({ name, email, phone, contactType, subject, message, referralSource });
    await contact.save();

    // Nodemailer scaffold: uncomment and configure when SMTP credentials are available
    /*
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    });

    const mailOptions = {
      from: 'no-reply@paychainke.co',
      to: 'hello@paychainke.co',
      subject: `New contact: ${contactType} — ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nType: ${contactType}\nSubject: ${subject}\nMessage:\n${message}\n\nReferral: ${referralSource}`
    };

    // TODO: enable sending after SMTP is configured
    // await transporter.sendMail(mailOptions);
    */

    return res.status(200).json({ message: 'Message received successfully' });
  } catch (err) {
    console.error('contact submit error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isRead === 'false') filter.isRead = false;
    const messages = await ContactMessage.find(filter).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await ContactMessage.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ message: 'Not found' });
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
