const User = require('../models/User');
const Otp = require('../models/Otp');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Invalid credentials or unauthorized access' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save/Update OTP in DB
    await Otp.findOneAndUpdate(
      { email },
      { otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send OTP via Email
    try {
      await resend.emails.send({
        from: 'PayChain Admin <security@paychain.co.ke>',
        to: [email],
        subject: 'Your Admin Verification Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 16px;">
            <h2 style="font-size: 24px; font-weight: 800; color: #00351d; margin-bottom: 16px;">Security Verification</h2>
            <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px;">Someone is attempting to log into the PayChain Admin Portal. If this is you, use the verification code below to complete your login. This code expires in 5 minutes.</p>
            <div style="background: #f0fdf4; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #00351d;">${otpCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 12px;">If you did not request this code, please secure your account immediately.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Error sending OTP email:', emailErr);
      // In a real prod environment, we might want to fail the request here, but for now we'll proceed
    }

    res.json({ success: true, mfaRequired: true, email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.verifyAdminOtp = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    const otpRecord = await Otp.findOne({ email, otpCode });
    if (!otpRecord) {
      return res.status(401).json({ success: false, error: 'Invalid or expired verification code' });
    }

    const user = await User.findOne({ email });
    
    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Immediate cleanup
    await Otp.deleteOne({ _id: otpRecord._id });

    res.json({
      success: true,
      token,
      adminUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
