import mongoose from 'mongoose';

// A credit that shows up on NCBA's own real account statement, confidently
// attributed to a specific merchant (via the same 8-digit merchant-code
// extraction the real-time account-notification webhook uses), but with no
// matching Transaction anywhere in PayChain's own records — i.e. exactly
// what happened to Delamere Dairy Farm on 2026-08-31: NCBA's webhook never
// fired (or was silently dropped) for a real, confirmed collection, and
// nothing caught it until the merchant complained.
//
// Built by services/ncbaCollectionReconciliationService.js's hourly sweep,
// which cross-checks the statement against Transaction records the same way
// this was diagnosed manually. One row per real statement credit
// (statementReference is unique so repeat sweep runs never duplicate a
// candidate) — surfaced on Pool Reconciliation for an admin to either credit
// (via the existing Credit Missed Collection tool, pre-filled from here) or
// dismiss (e.g. a false match, or turns out to already be accounted for
// under a reference this sweep didn't recognize).
const MissedNcbaCollectionCandidateSchema = new mongoose.Schema({
  statementReference: { type: String, required: true, unique: true },
  statementDescription: { type: String, default: null },
  statementDate: { type: String, default: null }, // NCBA's raw ValueDate string, as shown on the statement
  amount: { type: Number, required: true },
  matchedMerchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null },
  matchedMerchantCode: { type: String, default: null },
  status: { type: String, enum: ['pending', 'credited', 'dismissed'], default: 'pending' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNote: { type: String, default: null },
}, { timestamps: true });

MissedNcbaCollectionCandidateSchema.index({ status: 1, createdAt: -1 });

const MissedNcbaCollectionCandidate = mongoose.model('MissedNcbaCollectionCandidate', MissedNcbaCollectionCandidateSchema);
export default MissedNcbaCollectionCandidate;
