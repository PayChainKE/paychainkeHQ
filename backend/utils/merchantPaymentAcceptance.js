// Whether a merchant may receive money right now. Two admin controls stop it:
//   - status 'locked': the full account lock (no sign-in, no payments)
//   - inboundLocked:   "Block incoming payments" only; the merchant can still
//                      sign in, view history and pay out what they hold
// Every collection path checks this one helper, so the two controls can't
// drift apart. Callers must load `status` and `inboundLocked`.
export const PAYMENT_ACCEPTANCE_FIELDS = 'status inboundLocked';

export function canReceivePayments(merchant) {
  if (!merchant) return false;
  return merchant.status !== 'locked' && !merchant.inboundLocked;
}

// Neutral on purpose: a payer is never told the merchant is locked.
export const MERCHANT_CANNOT_RECEIVE_MESSAGE = 'This merchant cannot receive payments at the moment.';
