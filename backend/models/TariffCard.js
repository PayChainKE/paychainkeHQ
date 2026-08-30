import mongoose from 'mongoose';

// One document per admin-editable PayChain fee/margin (see
// services/tariffCardCache.js for the in-memory cache read path, and
// controllers/tariffController.js#requestTariffUpdate/confirmTariffUpdate
// for the OTP-gated write path). Deliberately narrow scope: only PayChain's
// own kept margin/service-fee values live here — the real third-party cost
// (NCBA/Safaricom's actual charge to PayChain) stays hardcoded in each
// config/*TariffCard.js file, since editing it wouldn't change what NCBA/
// Safaricom actually bills PayChain, only make the platform's own numbers
// wrong (confirmed with Brandon, 2026-08-31).
//
// `bands[].max` is the single source of a tiered card's shape contract —
// fixed at seed time to exactly match the code's own DEFAULT band
// boundaries, and re-validated (same count, same max values, same order)
// on every write in tariffController.js#requestTariffUpdate. Only
// `bands[].fee` (and `flatFee` for flat-shaped cards) is ever admin-edited.
const tariffCardSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  shape: { type: String, enum: ['flat', 'tiered'], required: true },
  flatFee: { type: Number, default: null },
  bands: [{
    _id: false,
    max: { type: Number, required: true },
    fee: { type: Number, required: true },
  }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

const TariffCard = mongoose.model('TariffCard', tariffCardSchema, 'tariffcards');

export default TariffCard;
