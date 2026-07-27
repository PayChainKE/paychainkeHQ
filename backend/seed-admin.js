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

    // Required via env, never hardcoded here — a committed real admin
    // credential doesn't fail loudly, it just sits in source control (and
    // git history) as a live password for whoever finds it. Fail closed
    // instead: this script simply can't run without the operator supplying
    // both values explicitly at invocation time.
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    const name = process.env.SEED_ADMIN_NAME || 'Admin';

    if (!email || !password) {
      console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set to run this script.');
      process.exit(1);
    }

    let admin = await Admin.findOne({ email });

    if (admin) {
      console.log('🔄 Admin already exists, refreshing password + owner attributes...');
      admin.password = password;
      admin.role = 'owner';
      admin.status = 'active';
      if (!admin.name) admin.name = name;
    } else {
      console.log('✨ Creating new admin user...');
      admin = new Admin({ email, password, name, role: 'owner', status: 'active' });
    }

    await admin.save();
    console.log(`✅ Admin user (${email}) setup successfully as owner`);

    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding admin: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
