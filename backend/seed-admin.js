import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';
import connectDB from './config/database.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const email = 'admin@paychain.co.ke';
    const password = 'PayChainadmin@2025 !';

    let admin = await Admin.findOne({ email });

    if (admin) {
      console.log('🔄 Admin already exists, updating password...');
      admin.password = password;
    } else {
      console.log('✨ Creating new admin user...');
      admin = new Admin({ email, password });
    }

    await admin.save();
    console.log(`✅ Admin user (${email}) setup successfully`);

    console.log('✅ Admin user created successfully');
    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding admin: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
