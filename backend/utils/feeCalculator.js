import { REVENUE_STREAMS, safaricomFeeFor } from '../config/revenueRateCard.js';
import { getNcbaTariffBand } from '../config/ncbaTariffCard.js';
import { calculateMerchantFee } from './pricingEngine.js';
import { getB2cTariff } from '../config/mpesaB2cTariffCard.js';
import { getKplcPostpaidTariff, getKplcPrepaidTariff, getNcwscTariff } from '../config/billPaymentTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { getBankTransferTariff } from '../config/bankTransferTariffCard.js';

// Build the type → stream map once at module load.
const TYPE_TO_STREAM = (() => {
  const map = new Map();
  for (const stream of REVENUE_STREAMS) {
    for (const t of stream.txTypes) map.set(t, stream);
  }
  return map;
})();

// Pure: given (type, kesAmount, rail), return { paychainFee, safaricomFee, streamId }.
// Used by the Transaction pre-save hook so every transaction across every
// PayChain merchant account is automatically priced from the rate card.
// `rail` (Transaction.settlementRail) only matters for 'ncba_outbound' —
// every other type ignores it.
export function calculateFees(type, kesAmount, rail = null) {
  const v = Number(kesAmount) || 0;
  const stream = TYPE_TO_STREAM.get(type);

  // Outbound bank transfers (PesaLink/EFT/RTGS) — ncbaOpenBankingController.js's
  // executeNcbaBankPayout (the standalone "Withdraw to Bank" endpoint) and
  // bulkPayController.js's Bank payee rows both stamp settlementRail on the
  // Transaction before it's ever saved, so it's always known here. Tiered/
  // flat per rail — see config/bankTransferTariffCard.js. IFT (NCBA-to-NCBA)
  // and any untracked rail fall through to zero fee, matching today's
  // actual (unpriced) behavior — this tariff sheet is external-bank-only.
  if (type === 'ncba_outbound') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { baseCost, serviceFee } = getBankTransferTariff(rail, v);
    return { paychainFee: serviceFee, safaricomFee: baseCost, streamId: stream?.id || null };
  }

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
  // never disagree. paychainFee is the tiered Mobile Withdrawal service fee
  // (calculateB2cServiceFee); the rest is the real Safaricom cost, passed
  // straight through.
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

  // KPLC postpaid bill payments (Bulk Pay) — flat Bill Payment tariff, see
  // config/billPaymentTariffCard.js. paychainFee is the service-fee portion
  // PayChain actually keeps; safaricomFee here holds the third-party bank/
  // aggregator base cost (this field is reused across every rail in this
  // file as "the pass-through cost", not literally Safaricom-specific).
  // Was a no-op flat KES 20 stamped for reporting only, never actually
  // deducted from the merchant — bulkPayController.js now folds this same
  // totalFee into the batch's atomic debit, so the two can't disagree.
  if (type === 'ncba_kplc') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { baseCost, serviceFee } = getKplcPostpaidTariff();
    return { paychainFee: serviceFee, safaricomFee: baseCost, streamId: stream?.id || null };
  }

  // KPLC prepaid token purchases (Bulk Pay) — tiered Bill Payment tariff,
  // unlike postpaid above. Same reasoning as ncba_kplc.
  if (type === 'ncba_kplc_prepaid') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { baseCost, serviceFee } = getKplcPrepaidTariff(v);
    return { paychainFee: serviceFee, safaricomFee: baseCost, streamId: stream?.id || null };
  }

  // NCWSC (Nairobi Water) bill payments (Bulk Pay) — flat Bill Payment
  // tariff. Same reasoning as ncba_kplc.
  if (type === 'ncba_ncwsc') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { baseCost, serviceFee } = getNcwscTariff();
    return { paychainFee: serviceFee, safaricomFee: baseCost, streamId: stream?.id || null };
  }

  // B2B PayBill/Till payouts (mpesaController.js#initiateB2B, and Bulk
  // Pay's Mobile Money -> Paybill/Buy Goods rows) — tiered B2B PayBill &
  // Till Payout tariff, see config/lipaNaMpesaTariffCard.js. Replaces the
  // old flat KES 30 margin. paychainFee is the service-fee portion only;
  // safaricomFee holds the third-party NCBA+Safaricom B2B base cost.
  if (type === 'ncba_lipa_na_mpesa') {
    if (v <= 0) {
      return { paychainFee: 0, safaricomFee: 0, streamId: stream?.id || null };
    }
    const { baseCost, serviceFee } = getLipaNaMpesaTariff(v);
    return { paychainFee: serviceFee, safaricomFee: baseCost, streamId: stream?.id || null };
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
