import Merchant from '../models/Merchant.js';
import Counter from '../models/Counter.js';
import { generateMerchantCode } from '../utils/ncbaValidators.js';

// Idempotent boot-time backfill. Merchant.js's pre-save hook only assigns
// an ncbaMerchantCode to brand-new documents (`this.isNew`), so every
// merchant that existed before that feature shipped is missing one and
// will never get one automatically. This scans for those and assigns them
// sequentially, in creation order, drawing from the SAME 'ncbaMerchantCode'
// Counter that new signups use — no risk of collision between backfilled
// and freshly-issued codes. Runs once per boot and is cheap on subsequent
// boots because the filter only matches merchants genuinely missing one.

export async function backfillNcbaMerchantCodes() {
  try {
    const cursor = Merchant.find({ ncbaMerchantCode: null }).sort({ createdAt: 1 }).cursor();

    let scanned = 0, updated = 0;
    for await (const doc of cursor) {
      scanned += 1;

      const counter = await Counter.findByIdAndUpdate(
        'ncbaMerchantCode',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const ncbaMerchantCode = generateMerchantCode(counter.seq);

      await Merchant.updateOne({ _id: doc._id }, { $set: { ncbaMerchantCode } });
      updated += 1;
    }

    if (updated > 0) {
      console.log(`🏦 Backfilled NCBA merchant codes on ${updated}/${scanned} merchant(s).`);
    }
  } catch (err) {
    // Boot-time migrations should never block the API — log and move on.
    console.error('⚠️  NCBA merchant code backfill failed:', err?.message || err);
  }
}
