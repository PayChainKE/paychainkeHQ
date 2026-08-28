// Lipa na M-Pesa (Till/Paybill) outbound B2B payouts — via SendMoney's
// Till/Paybill destination and BulkPay's Paybill/Buy Goods mobile money
// type — are not yet confirmed working end-to-end. Restricted to Brantech
// Solutions (the account used for live testing) until confirmed, then
// opened up to every merchant.
//
// The frontend already hides/disables this option for everyone else
// (apps/merchant-dashboard & apps/mobile-app's SendMoney/BulkPay pages) —
// this is the server-side enforcement so the restriction holds even if a
// request is made directly against the API rather than through the UI.
const LIPA_NA_MPESA_BETA_MERCHANT_IDS = new Set([
  '6a8f30cb228671cacc4361fe', // Brantech Solutions
]);

export function isLipaNaMpesaBetaMerchant(merchantId) {
  return LIPA_NA_MPESA_BETA_MERCHANT_IDS.has(String(merchantId));
}

export const LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE =
  'Paybill and Till payments are coming soon and not yet available on your account.';
