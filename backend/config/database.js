import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Fail fast instead of buffering queries for 10s when Mongo isn't connected yet.
mongoose.set('bufferCommands', false);

const CONNECT_OPTS = {
  serverSelectionTimeoutMS: 12_000,
  maxPoolSize: 10,
  heartbeatFrequencyMS: 10_000,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const logConnectError = (error) => {
  if (looksLikeIpWhitelist(error)) {
    printAtlasHelp(error);
  } else {
    console.error(`❌ Connection Error: ${error.message}`);
  }
};

export const isDbReady = () => mongoose.connection.readyState === 1;

const getDbUri = () => {
  const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('❌ CRITICAL ERROR: Database URI is undefined.');
    console.error('Please ensure MONGO_URI or MONGODB_URI is set in your environment variables.');
    process.exit(1);
  }
  return dbUri;
};

let reconnectTimer = null;
let reconnectInFlight = false;

const scheduleReconnect = () => {
  if (reconnectTimer || reconnectInFlight || isDbReady()) return;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectInFlight = true;
    try {
      await connectDB({ silent: true });
      console.log('✅ MongoDB reconnected');
    } catch (error) {
      logConnectError(error);
      scheduleReconnect();
    } finally {
      reconnectInFlight = false;
    }
  }, 5_000);
};

const attachConnectionHandlers = () => {
  if (mongoose.connection.listenerCount('disconnected') > 0) return;

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected — scheduling reconnect');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
};

/**
 * Connect to MongoDB with retries. Returns once connected.
 * Throws after all attempts fail so callers can decide whether to exit.
 */
const connectDB = async ({ retries = 5, silent = false } = {}) => {
  const dbUri = getDbUri();

  if (isDbReady()) return mongoose.connection;

  attachConnectionHandlers();

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await mongoose.connect(dbUri, CONNECT_OPTS);
      if (!silent) {
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📂 Database Name: ${conn.connection.db.databaseName}`);
      }
      return conn;
    } catch (error) {
      lastError = error;
      if (!silent) {
        logConnectError(error);
        if (attempt < retries) {
          const delayMs = Math.min(2_000 * attempt, 10_000);
          console.warn(`⏳ MongoDB retry ${attempt}/${retries} in ${delayMs / 1000}s…`);
        }
      }
      if (attempt < retries) await sleep(Math.min(2_000 * attempt, 10_000));
    }
  }

  throw lastError;
};

export const startBackgroundDbRetry = () => {
  scheduleReconnect();
};

export default connectDB;
