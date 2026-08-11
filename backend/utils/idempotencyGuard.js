import crypto from 'crypto';
import PayoutIdempotencyGuard from '../models/PayoutIdempotencyGuard.js';

// How long a duplicate submission of the exact same payout is rejected for.
// Long enough to absorb a double-click or a client's automatic retry after
// a slow/timed-out response; short enough that a merchant intentionally
// paying the same amount to the same destination again a minute later
// (a completely normal thing to do) is never blocked.
const DEFAULT_WINDOW_SECONDS = 20;

export class DuplicateSubmissionError extends Error {
  constructor() {
    super('This looks like a duplicate submission — the same payout was just sent. Please wait a moment before retrying.');
    this.name = 'DuplicateSubmissionError';
  }
}

// Claims a short-lived lock on "this merchant submitting this exact
// payout" — call once, immediately before executing the real transfer.
// `parts` should include everything that makes two submissions the same
// payout in the merchant's eyes (destination, amount, rail) but NOT
// anything that's regenerated per-attempt (like a freshly-minted
// transactionId) — otherwise every retry would get its own fingerprint
// and this would never catch anything.
//
// Throws DuplicateSubmissionError if an identical submission from the
// same merchant landed within the last DEFAULT_WINDOW_SECONDS. Relies on
// the model's unique index on `fingerprint` for the actual atomicity —
// safe under concurrent requests and across multiple server instances,
// unlike an in-process Map/lock.
export async function claimPayoutSubmission(merchantId, parts, { windowSeconds = DEFAULT_WINDOW_SECONDS } = {}) {
  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify([String(merchantId), ...parts.map((p) => String(p))]))
    .digest('hex');

  // MongoDB's TTL sweep is a background job that runs roughly once a
  // minute — it does NOT delete a doc the instant expiresAt passes, so a
  // plain create() + rely-on-the-unique-index approach would keep
  // rejecting a legitimate resubmission for up to ~a minute past the
  // window this function promises. The correctness has to come from the
  // query itself, not from physical deletion timing: this upsert only
  // matches (and refreshes) an existing doc if it's already logically
  // expired. A still-active doc never matches the filter, so the upsert
  // tries to insert a second row with the same fingerprint and collides
  // with the unique index instead — that collision is the real "this is
  // a duplicate" signal. The TTL index still does the actual storage
  // cleanup eventually; it's just never relied on for correctness.
  try {
    await PayoutIdempotencyGuard.findOneAndUpdate(
      { fingerprint, expiresAt: { $lt: new Date() } },
      { $set: { fingerprint, expiresAt: new Date(Date.now() + windowSeconds * 1000) } },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      throw new DuplicateSubmissionError();
    }
    throw err;
  }
}
