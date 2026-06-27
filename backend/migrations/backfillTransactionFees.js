import Transaction from '../models/Transaction.js';
import { calculateFees } from '../utils/feeCalculator.js';

// Idempotent boot-time backfill. Stamps `paychainFee`, `safaricomFee`, and
// `revenueStream` on every transaction that doesn't already have them
// populated from a recognised rate-card stream. Runs once per boot and is
// cheap on subsequent boots because the filter only matches docs that are
// genuinely missing the data.

export async function backfillTransactionFees() {
  try {
    // Match anything that is (a) totally unstamped, or (b) the streamId was
    // never recorded (legacy rows). We rely on a non-null `type` so we know
    // which stream to apply.
    const cursor = Transaction.find({
      $or: [
        { paychainFee: { $exists: false } },
        { revenueStream: null },
      ],
      type: { $exists: true, $ne: null },
    }).cursor();

    let scanned = 0, updated = 0;
    for await (const doc of cursor) {
      scanned += 1;
      const basis = doc.kesAmount > 0 ? doc.kesAmount : doc.amount;
      const { paychainFee, safaricomFee, streamId } = calculateFees(doc.type, basis);

      // Skip if nothing would change — keeps the boot quiet on re-runs.
      if (
        doc.paychainFee === paychainFee &&
        doc.safaricomFee === safaricomFee &&
        doc.revenueStream === streamId
      ) continue;

      await Transaction.updateOne(
        { _id: doc._id },
        { $set: { paychainFee, safaricomFee, revenueStream: streamId } },
      );
      updated += 1;
    }

    if (updated > 0) {
      console.log(`💰 Backfilled fees on ${updated}/${scanned} transactions.`);
    }
  } catch (err) {
    // Boot-time migrations should never block the API — log and move on.
    console.error('⚠️  Transaction fee backfill failed:', err?.message || err);
  }
}
