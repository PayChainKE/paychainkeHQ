import Admin from '../models/Admin.js';

// Idempotent boot-time migration:
//   - Promotes the primary admin (admin@paychain.co.ke) to role='owner'.
//   - Ensures status='active' so they can sign in + manage the team.
//   - Fills name if missing.
// If no primary admin exists (fresh DB) it does nothing — the seed-admin
// script handles initial creation.

const PRIMARY_EMAIL = 'admin@paychain.co.ke';
const PRIMARY_NAME  = 'Brandon Omutiti';

export async function ensurePrimaryOwner() {
  try {
    const admin = await Admin.findOne({ email: PRIMARY_EMAIL });
    if (!admin) {
      console.log(`ℹ️  Primary owner (${PRIMARY_EMAIL}) not found — run seed-admin.js`);
      return;
    }

    let changed = false;
    if (admin.role !== 'owner') { admin.role = 'owner'; changed = true; }
    if (admin.status !== 'active') { admin.status = 'active'; changed = true; }
    if (!admin.name) { admin.name = PRIMARY_NAME; changed = true; }

    if (changed) {
      await admin.save();
      console.log(`✅ Primary owner (${PRIMARY_EMAIL}) normalized: role=owner, status=active`);
    }
  } catch (e) {
    console.error('❌ ensurePrimaryOwner migration failed:', e?.message || e);
  }
}
