import Merchant from '../models/Merchant.js';
import { generateRandomMerchantCode } from '../utils/ncbaValidators.js';

// Idempotent boot-time backfill. Merchant.js's pre-save hook only assigns
// an ncbaMerchantCode to brand-new documents (`this.isNew`), so any
// merchant that somehow ended up without one (e.g. inserted before that
// hook existed, or via a path that bypassed it) is caught and assigned one
// here. Uses the same random-code generator + DB uniqueness check as the
// pre-save hook — sequential codes read as a typo to a customer paying by
// hand, so every merchant should get one the same way. Runs once per boot
// and is cheap on subsequent boots because the filter only matches
// merchants genuinely missing one.

export async function backfillNcbaMerchantCodes() {
  try {
    const cursor = Merchant.find({ ncbaMerchantCode: null }).sort({ createdAt: 1 }).cursor();

    let scanned = 0, updated = 0;
    for await (const doc of cursor) {
      scanned += 1;

      let ncbaMerchantCode = null;
      for (let attempt = 0; attempt < 10 && !ncbaMerchantCode; attempt++) {
        const candidate = generateRandomMerchantCode();
        const exists = await Merchant.exists({ ncbaMerchantCode: candidate });
        if (!exists) ncbaMerchantCode = candidate;
      }
      if (!ncbaMerchantCode) {
        console.error(`⚠️  Could not allocate a unique NCBA merchant code for merchant ${doc._id} after multiple attempts.`);
        continue;
      }

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
