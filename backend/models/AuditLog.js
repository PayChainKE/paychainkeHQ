import mongoose from 'mongoose';

// Compact, denormalised audit trail. We copy `merchantEmail`/`merchantName`
// onto each row at write-time so the log stays readable forever — even if the
// merchant record is later deleted, renamed or rebranded. The same denorm
// holds for the acting admin (when an admin took the action).
//
// `category` is the broad bucket the UI groups by (auth, security, profile,
// admin, wallet, system). `severity` controls the colour in the table:
// info | success | warning | critical.

const AuditLogSchema = new mongoose.Schema({
  // Subject (whose log this entry belongs to). Most actions are merchant-scoped.
  merchantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
  merchantEmail: { type: String, default: null },
  merchantName:  { type: String, default: null },

  // Who performed the action. Self = same merchant; admin = an admin acted
  // on the merchant; system = automated process / boot migration.
  actor: {
    type: { type: String, enum: ['self', 'admin', 'officer', 'system'], default: 'self', index: true },
    id:    { type: mongoose.Schema.Types.ObjectId, default: null },
    email: { type: String, default: null },
    name:  { type: String, default: null },
  },

  // What happened. Use dot-namespaced verbs so they group naturally
  // (e.g. merchant.login.success, admin.merchant.flagged).
  action:   { type: String, required: true, index: true },
  category: {
    type: String,
    enum: ['auth', 'security', 'profile', 'admin', 'wallet', 'system'],
    default: 'auth',
    index: true,
  },
  severity: {
    type: String,
    enum: ['info', 'success', 'warning', 'critical'],
    default: 'info',
  },

  // Human-readable short message rendered as the primary cell in the table.
  message: { type: String, default: '' },

  // Network metadata captured at request time.
  ip:        { type: String, default: null },
  userAgent: { type: String, default: null },
  // Which client surfaced this event — important for audit clarity ("did the
  // merchant sign in from web or the mobile app?"). Set explicitly via the
  // X-Client-Platform header from each frontend, with UA-pattern fallback.
  platform:  { type: String, enum: ['web', 'mobile', 'unknown'], default: 'unknown', index: true },

  // Free-form payload (request shape, what changed, error codes, etc.). Capped
  // softly via .slice on the helper to keep documents small.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Retention — MongoDB TTL index fires on this field and removes the document
  // automatically once the date passes.  Set at write-time by logAudit():
  //   critical / warning  →  21 days  (security events, longer retention)
  //   info    / success   →  14 days  (routine auth events)
  // Existing documents without this field are unaffected by the TTL index.
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

// Compound index — the most common query is "this merchant's recent activity".
AuditLogSchema.index({ merchantId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

// TTL index: MongoDB deletes each document once its expiresAt date passes.
// expireAfterSeconds: 0 means "delete at expiresAt exactly" (no extra delay).
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
