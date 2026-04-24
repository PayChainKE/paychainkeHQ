import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!dbUri) {
    console.error('❌ CRITICAL ERROR: Database URI is undefined.');
    console.error('Please ensure MONGO_URI or MONGODB_URI is set in your environment variables.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(dbUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database Name: ${conn.connection.db.databaseName}`);
  } catch (error) {
    console.error(`❌ Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
