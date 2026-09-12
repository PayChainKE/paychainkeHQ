import mongoose from 'mongoose';

// A local mirror of the free public sanctions lists (OFAC SDN, UN
// Consolidated) — see services/sanctionsListCache.js for how this gets
// populated/refreshed and matched against. Kept in Mongo (not just the
// in-memory cache) so a restart doesn't need to re-download both feeds
// before screening works again, and so an admin could inspect what's
// loaded if a hit ever needs investigating.
const sanctionsListEntrySchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['OFAC', 'UN'],
    required: true,
  },
  // sourceRef + source together are this entry's stable identity across
  // refreshes (OFAC's uid, UN's DATAID) — used as the upsert key so a
  // re-download doesn't duplicate rows.
  sourceRef: {
    type: String,
    required: true,
  },
  primaryName: {
    type: String,
    required: true,
  },
  akaNames: {
    type: [String],
    default: [],
  },
  entryType: {
    type: String,
    enum: ['individual', 'entity'],
    default: 'individual',
  },
  program: {
    type: String,
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { versionKey: false });

sanctionsListEntrySchema.index({ source: 1, sourceRef: 1 }, { unique: true });

export default mongoose.model('SanctionsListEntry', sanctionsListEntrySchema);
