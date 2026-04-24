const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    const email = 'brandon@paychain.co.ke';
    const password = await bcrypt.hash('Paychain@25', 12);
    const existing = await User.findOne({ email });
    
    if (existing) {
      console.log('Admin user already exists. Updating...');
      existing.password = password;
      existing.role = 'admin';
      existing.name = 'Brandon Paychain';
      console.log('Attempting to save existing user...');
      const saved = await existing.save();
      console.log('User saved successfully:', saved._id);
    } else {
      console.log('Creating new admin user...');
      const admin = new User({
        email,
        password,
        name: 'Brandon Paychain',
        role: 'admin'
      });
      console.log('Attempting to save new user...');
      const saved = await admin.save();
      console.log('User saved successfully:', saved._id);
    }

    console.log('Admin seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedAdmin();
