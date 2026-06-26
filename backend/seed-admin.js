import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';
import connectDB from './config/database.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    // Remove legacy admin first so the old credentials stop working.
    const legacyEmail = 'brandon@paychain.co.ke';
    const removed = await Admin.deleteOne({ email: legacyEmail });
    if (removed.deletedCount > 0) {
      console.log(`🗑️  Removed legacy admin: ${legacyEmail}`);
    } else {
      console.log(`ℹ️  No legacy admin to remove for: ${legacyEmail}`);
    }

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

    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding admin: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
