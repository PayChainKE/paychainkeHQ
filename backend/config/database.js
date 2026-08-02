import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Fail fast instead of buffering queries for 10s when Mongo isn't connected yet.
mongoose.set('bufferCommands', false);

// maxPoolSize: the 10 -> 5 stopgap (2026-07-30 AM) turned out to be too
// tight once the 5s dashboard-polling feature (commit 2474ed0) is factored
// in — every open merchant/admin/officer tab now checks out a connection
// every 5s, and with only 5 slots total those polling requests were queuing
// ahead of payment-webhook writes (M-Pesa confirmation, NCBA collection),
// delaying the merchant's own SMS/notification behind a wait for a free
// connection. Raised to 20, then temporarily dropped to 8 (2026-08-03) —
// Atlas hit 458/500 (92%) on the free cluster despite near-zero real query
// traffic (0.5 ops/sec), climbing even after two suspected-leak fixes
// (deploy-time shutdown, stale-client-on-reconnect) were deployed. Root
// cause isn't confirmed yet, so this is a safety buffer to reduce how much
// damage any still-unknown leak can do per instance while that's
// diagnosed — not a real fix. At today's near-zero traffic this shouldn't
// reintroduce the original polling-contention problem; revert toward 20
// once the real cause is found and connections have stabilized.
const CONNECT_OPTS = {
  serverSelectionTimeoutMS: 12_000,
  maxPoolSize: 8,
  heartbeatFrequencyMS: 10_000,
  // Backstop against the exact leak scheduleReconnect() below guards
  // against structurally: if a pooled socket ever does go stale without
  // the driver noticing (a silently-dropped connection that never fires a
  // clean 'close'), this forces the driver to recycle it after a minute
  // of no use rather than holding it open against Atlas indefinitely.
  maxIdleTimeMS: 60_000,
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
      // Explicitly tear down whatever's left of the previous client before
      // opening a new one. mongoose.connect() below always opens a fresh
      // underlying MongoClient — it does not guarantee the prior one (now
      // sitting in a 'disconnected' state, e.g. after a mid-handshake TLS
      // drop) gets its sockets released first. Without this, a real
      // network blip that triggers this reconnect path leaves the old
      // pool's connections still held against Atlas's connection count
      // while a brand new pool opens on top — repeated over enough
      // flaky-network reconnect cycles, that's a slow, steady connection
      // leak with zero relation to actual traffic. Safe to call even if
      // the connection is already fully closed (no-ops).
      try {
        await mongoose.connection.close();
      } catch (closeErr) {
        console.warn('⚠️ Error closing stale MongoDB connection before reconnect:', closeErr.message);
      }
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

// Coalesces concurrent callers onto a single in-flight attempt. Without
// this, the boot-time call below and the disconnected-event handler's own
// scheduleReconnect() -> connectDB() call could each open an independent
// 5-attempt retry loop against the same shared global mongoose connection
// at the same time — seen for real on a flaky-network deploy where a
// mid-handshake TLS drop (SSL alert 80) triggered a 'disconnected' event
// while the original retry loop was still mid-attempt, producing
// interleaved connect/disconnect/reconnect log lines from two loops
// stepping on each other's state.
let inFlightConnect = null;

/**
 * Connect to MongoDB with retries. Returns once connected.
 * Throws after all attempts fail so callers can decide whether to exit.
 */
const connectDB = async ({ retries = 5, silent = false } = {}) => {
  const dbUri = getDbUri();

  if (isDbReady()) return mongoose.connection;
  if (inFlightConnect) return inFlightConnect;

  attachConnectionHandlers();

  inFlightConnect = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const conn = await mongoose.connect(dbUri, CONNECT_OPTS);
        if (!silent) {
          // Optional-chained: under the same flakiness that causes a retry
          // loop in the first place, .connection/.db can still be mid-setup
          // the instant this promise resolves. A crash here would burn a
          // retry attempt over a connection that actually succeeded.
          console.log(`✅ MongoDB Connected: ${conn.connection?.host ?? 'host pending'}`);
          console.log(`📂 Database Name: ${conn.connection?.db?.databaseName ?? 'pending'}`);
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
  })();

  try {
    return await inFlightConnect;
  } finally {
    inFlightConnect = null;
  }
};

export const startBackgroundDbRetry = () => {
  scheduleReconnect();
};

// Closes the Mongo connection cleanly on process shutdown — without this,
// a Render redeploy (SIGTERM to the old instance) leaves that instance's
// pooled connections to linger until Atlas notices the socket died on its
// own, rather than closing them immediately. On a shared M0 cluster
// (500-connection cap) that lag adds up fast across frequent deploys.
export const disconnectDB = async () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

export default connectDB;
