import { REVENUE_STREAMS, safaricomFeeFor } from '../config/revenueRateCard.js';

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
