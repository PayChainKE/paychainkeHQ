import mongooseModule from 'mongoose';
const { Schema, model } = mongooseModule;

// A short-lived tripwire against duplicate real-money submissions — a
// double-click, a slow-network client retry, or a mobile app resending a
// request after a timed-out response can all otherwise reach a
// PIN-guarded payout endpoint twice with an identical, valid PIN and
// produce two real transfers instead of one. Real banking APIs solve this
// with an idempotency key; this app's frontends don't generate one, so
// the guard is a server-side fingerprint of "this merchant submitting
// this exact payout" instead — see utils/idempotencyGuard.js.
//
// `fingerprint` has a unique index, so a second insert attempt for the
// same fingerprint within the TTL window throws a duplicate-key error,
// which the caller treats as "reject this as a likely double-submit".
// expiresAt is intentionally short (see DEFAULT_WINDOW_SECONDS in
// utils/idempotencyGuard.js) — long enough to catch a double-click or
// retry storm, short enough that a merchant legitimately paying the same
// amount to the same destination again minutes later is never blocked.
const payoutIdempotencyGuardSchema = new Schema({
  fingerprint: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

payoutIdempotencyGuardSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PayoutIdempotencyGuard = model('PayoutIdempotencyGuard', payoutIdempotencyGuardSchema);

export default PayoutIdempotencyGuard;
