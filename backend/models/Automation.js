import mongoose from 'mongoose';

// One row per admin-controllable automation (keyed by a stable string, e.g.
// 'newsletter_digest' — the registry lives in services/automationRegistry.js).
// Holds the on/off switches, the automation's own config, and the bookkeeping
// that makes a run exactly-once: `lastSlotAt` is claimed with an atomic
// findOneAndUpdate before any work starts, so a redeploy, a restart, or a
// second server instance can never fire the same slot twice.
const AutomationSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  enabled: { type: Boolean, default: false },
  // false (default) = the automation prepares its output and waits for an
  // admin to approve it; true = it goes out on its own.
  autoSend: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  // The scheduled slot (a real point in time) most recently claimed.
  lastSlotAt: { type: Date, default: null },
  lastRunAt: { type: Date, default: null },
  lastRunStatus: { type: String, enum: ['ok', 'skipped', 'error', null], default: null },
  lastRunSummary: { type: String, default: '', maxlength: 500 },
  // Automation-specific cursor, e.g. how far into the blog the last digest reached.
  lastCoveredAt: { type: Date, default: null },
  updatedByEmail: { type: String, trim: true, lowercase: true, default: '' },
}, { timestamps: true });

const Automation = mongoose.model('Automation', AutomationSchema);

export default Automation;
