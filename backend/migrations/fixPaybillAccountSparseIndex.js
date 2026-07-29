import Merchant from '../models/Merchant.js';

// Idempotent boot-time fix. paybillAccount was originally declared
// `unique: true` without `sparse: true` — Merchant.js now specifies
// `sparse: true`, but Mongoose does not retroactively alter an index that
// already exists in MongoDB with different options, so a deployed database
// can still be carrying the old non-sparse unique index. Without the fix,
// the officer-onboarding pipeline (which creates Merchant docs with no
// paybillAccount until approval) would throw E11000 on the second such
// document ever created (both have paybillAccount: null/absent, and a
// non-sparse unique index treats those as colliding values).
//
// Runs once per boot and is a no-op on every subsequent boot once the index
// is already sparse.

export async function fixPaybillAccountSparseIndex() {
  try {
    const indexes = await Merchant.collection.indexes();
    const existing = indexes.find((idx) => idx.name === 'paybillAccount_1');

    if (!existing) {
      // No index yet — Mongoose's own index sync will create the correct
      // (sparse) one from the schema. Nothing to do here.
      return;
    }

    if (existing.sparse) {
      return; // already fixed
    }

    await Merchant.collection.dropIndex('paybillAccount_1');
    await Merchant.collection.createIndex({ paybillAccount: 1 }, { unique: true, sparse: true });
    console.log('🔧 Rebuilt paybillAccount index as sparse (was blocking multiple no-paybill merchant docs).');
  } catch (err) {
    // Boot-time migrations should never block the API — log and move on.
    console.error('⚠️  paybillAccount sparse-index fix failed:', err?.message || err);
  }
}
