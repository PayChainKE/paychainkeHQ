import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Detect the classic "IP not on Atlas allow-list" failure so we can give an
// actionable hint instead of the generic stack trace. Atlas returns either an
// ECONNREFUSED on every shard or a "whitelist" hint in the error message.
const looksLikeIpWhitelist = (err) => {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('could not connect to any servers') ||
    msg.includes('ip that isn') ||
    msg.includes('whitelist') ||
    msg.includes('allow list')
  );
};

const printAtlasHelp = (err) => {
  console.error('\n┌──────────────────────────────────────────────────────────────┐');
  console.error('│ ❌ MongoDB Atlas refused the connection.                     │');
  console.error('│                                                              │');
  console.error('│ Likely cause: this machine\'s public IP is not on the Atlas  │');
  console.error('│ Network Access allow-list.                                   │');
  console.error('│                                                              │');
  console.error('│ Fix:                                                         │');
  console.error('│   1. https://cloud.mongodb.com → Security → Network Access  │');
  console.error('│   2. Click "Add IP Address" → "Add Current IP Address"      │');
  console.error('│      (or 0.0.0.0/0 for dev — never for production)          │');
  console.error('│   3. Wait ~30s for the rule to propagate, then restart.     │');
  console.error('└──────────────────────────────────────────────────────────────┘\n');
  console.error('Raw error:', err?.message || err, '\n');
};

const connectDB = async () => {
  const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!dbUri) {
    console.error('❌ CRITICAL ERROR: Database URI is undefined.');
    console.error('Please ensure MONGO_URI or MONGODB_URI is set in your environment variables.');
    process.exit(1);
  }

  try {
    // Slightly longer initial timeout so users on slow links get a clean
    // error instead of a premature "no servers" failure.
    const conn = await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 12_000 });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database Name: ${conn.connection.db.databaseName}`);
    return conn;
  } catch (error) {
    if (looksLikeIpWhitelist(error)) {
      printAtlasHelp(error);
    } else {
      console.error(`❌ Connection Error: ${error.message}`);
    }
    // In dev (NODE_ENV !== 'production'), keep the process alive so nodemon
    // doesn't crash-loop. The API will 503 on DB-dependent routes until the
    // operator fixes the network issue, then the next save restarts the
    // server and we retry the connection.
    if (process.env.NODE_ENV === 'production') process.exit(1);
    throw error;
  }
};

export default connectDB;
