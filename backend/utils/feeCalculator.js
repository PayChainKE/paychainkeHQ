import { REVENUE_STREAMS, safaricomFeeFor } from '../config/revenueRateCard.js';
import { getNcbaTariffBand } from '../config/ncbaTariffCard.js';
import { calculateMerchantFee } from './pricingEngine.js';
import { getB2cTariff } from '../config/mpesaB2cTariffCard.js';

// Build the type → stream map once at module load.
const TYPE_TO_STREAM = (() => {
  const map = new Map();
  for (const stream of REVENUE_STREAMS) {
    for (const t of stream.txTypes) map.set(t, stream);
  }
  return map;
})();

// Pure: given (type, kesAmount), return { paychainFee, safaricomFee, streamId }.
// Used by the Transaction pre-save hook so every transaction across every
// PayChain merchant account is automatically priced from the rate card.
export function calculateFees(type, kesAmount) {
  const v = Number(kesAmount) || 0;
  const stream = TYPE_TO_STREAM.get(type);

  // NCBA Virtual Account collections price off a tiered band table, not a
  // linear rate — see config/ncbaTariffCard.js. paychainFee here is the
  // markup only (what PayChain actually keeps); safaricomFee is the
  // absorbed Safaricom-cost component, tracked for transparency, not
  // deducted from the merchant a second time here (that already happened
  // in services/ncbaLedgerService.js when the ledger was credited).
  if (type === 'ncba_inbound') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { safaricomFee, markup } = getNcbaTariffBand(v);
    return {
      paychainFee: markup,
      safaricomFee,
      streamId: stream?.id || null,
    };
  }

  // M-Pesa B2C withdrawals (initiateB2C in mpesaController.js) price off
  // Safaricom's banded B2C tariff, not a linear rate — see
  // config/mpesaB2cTariffCard.js. This is the exact same figure the
  // controller already deducted from the merchant's balance via
  // getB2cTariff(amount) before creating this Transaction, so the two can
  // never disagree. paychainFee is PAYCHAIN_B2C_MARKUP (0 today); the rest
  // is the real Safaricom cost, passed straight through.
  if (type === 'mpesa_b2c') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { safaricomFee, markup } = getB2cTariff(v);
    return {
      paychainFee: markup,
      safaricomFee,
      streamId: stream?.id || null,
    };
  }

  // NCBA Mobile B2W payouts (initiateB2C in mpesaController.js, and Bulk
  // Pay's "Mobile Money → Personal Number" rows) — NCBA's replacement for
  // Daraja B2C. NCBA hasn't published a Mobile B2W cost schedule anywhere
  // seen in this codebase, so this reuses
  // getB2cTariff's numbers as a placeholder inherited from the Daraja era —
  // NOT a claim that NCBA's real cost matches Safaricom's B2C tariff. Kept
  // as its own type (not folded into 'mpesa_b2c') so this distinction is
  // visible in revenue reporting once NCBA's real pricing is known.
  if (type === 'ncba_mobile_b2w') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { safaricomFee, markup } = getB2cTariff(v);
    return {
      paychainFee: markup,
      safaricomFee,
      streamId: stream?.id || null,
    };
  }

  // M-Pesa inbound collections (C2B paybill + STK Push) price off the
  // tiered band matrix in utils/pricingEngine.js rather than a flat linear
  // rate — this is the exact same number mpesaController.js deducts from
  // the merchant before crediting their wallet, so the ledger and the real
  // balance can never disagree. safaricomFee here is the Safaricom tariff
  // the *customer* pays — a pass-through PayChain never collects, tracked
  // for transparency only (unchanged from the generic path below).
  if (type === 'inbound') {
    const paychainFee = v > 0 ? calculateMerchantFee(v) : 0;
    const safaricomFee = stream?.passthrough === 'safaricom' && v > 0 ? safaricomFeeFor(v) : 0;
    return {
      paychainFee: Math.round(paychainFee * 100) / 100,
      safaricomFee: Math.round(safaricomFee * 100) / 100,
      streamId: stream?.id || null,
    };
  }

  const paychainFee = stream && v > 0
    ? (stream.flatFee != null ? stream.flatFee : Math.max(stream.minFee || 0, v * stream.rate))
    : 0;

  // Safaricom passthrough applies only to streams marked as such.
  const safaricomFee = stream?.passthrough === 'safaricom' && v > 0
    ? safaricomFeeFor(v)
    : 0;

  return {
    paychainFee: Math.round(paychainFee * 100) / 100,
    safaricomFee: Math.round(safaricomFee * 100) / 100,
    streamId: stream?.id || null,
  };
}
