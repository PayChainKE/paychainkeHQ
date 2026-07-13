import { REVENUE_STREAMS, safaricomFeeFor } from '../config/revenueRateCard.js';
import { getNcbaTariffBand } from '../config/ncbaTariffCard.js';
import { calculateMerchantFee } from './pricingEngine.js';

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
    ? Math.max(stream.minFee || 0, v * stream.rate)
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
