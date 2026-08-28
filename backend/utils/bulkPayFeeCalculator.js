import { getB2cTariff } from '../config/mpesaB2cTariffCard.js';
import { getKplcPostpaidTariff, getKplcPrepaidTariff, getNcwscTariff } from '../config/billPaymentTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { getBankTransferTariff } from '../config/bankTransferTariffCard.js';
import { NCBA_OWN_BANK_CODE } from '../controllers/ncbaOpenBankingController.js';

// Mirrors the row-classification logic inside authorizeBatch's own per-row
// fee loop (bulkPayController.js) — used by previewBatchFees, a read-only
// estimate shown to the merchant before they authorize a batch.
//
// Deliberately NOT wired into authorizeBatch itself: that loop also sets
// row.isB2cRow/isKplcRow/etc and row.b2cSafaricomFee/b2cMarkup, which are
// read again later when building each Transaction's type and revenue
// attribution — reshaping it to share this function would touch the real
// money-moving path for close to zero benefit, an unnecessary risk. If the
// two ever drift, authorizeBatch's own tariff calls remain authoritative;
// this only ever produces an estimate, the same risk class as SendMoney's
// pre-existing fee estimate (which already carries the same caveat).
//
// Mirrors authorizeBatch's row classification exactly: isB2cRow (Mobile
// Money to a Personal Number), isKplcRow/isKplcPrepaidRow/isNcwscRow
// (utility bill payments), isLnmRow (Mobile Money to a Paybill/Till), and
// isBankRow (excluding NCBA's own bank code, which routes over the
// unpriced internal transfer rail instead of PesaLink). Throws
// B2cTariffBoundsError exactly as getB2cTariff itself does — callers
// handle it exactly like every other tariff bounds error in this codebase.
//
// @param {{ paymentMethod: string, mobileMoneyType?: string, type?: string, utilityProvider?: string, bankCode?: string }} payee
// @param {number} netAmount
// @returns {{ fee: number, category: string|null }}
export function computeBulkPayoutRowFee(payee, netAmount) {
  const isB2cRow = payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType === 'Personal Number';
  if (isB2cRow) {
    return { fee: getB2cTariff(netAmount).totalFee, category: 'mobile_money' };
  }

  const isKplcRow = payee.type === 'utility' && payee.utilityProvider === 'KPLC';
  if (isKplcRow) {
    return { fee: getKplcPostpaidTariff().totalFee, category: 'kplc' };
  }

  const isKplcPrepaidRow = payee.type === 'utility' && payee.utilityProvider === 'KPLC_PREPAID';
  if (isKplcPrepaidRow) {
    return { fee: getKplcPrepaidTariff(netAmount).totalFee, category: 'kplc_prepaid' };
  }

  const isNcwscRow = payee.type === 'utility' && payee.utilityProvider === 'WATER';
  if (isNcwscRow) {
    return { fee: getNcwscTariff().totalFee, category: 'ncwsc' };
  }

  const isLnmRow = payee.paymentMethod === 'Mobile Money' && payee.mobileMoneyType && payee.mobileMoneyType !== 'Personal Number';
  if (isLnmRow) {
    return { fee: getLipaNaMpesaTariff(netAmount).totalFee, category: 'lipa_na_mpesa' };
  }

  const isBankRow = payee.paymentMethod === 'Bank' && payee.bankCode !== NCBA_OWN_BANK_CODE;
  if (isBankRow) {
    return { fee: getBankTransferTariff('pesalink', netAmount).totalFee, category: 'bank' };
  }

  return { fee: 0, category: null };
}
