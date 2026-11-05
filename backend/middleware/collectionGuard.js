import { canReceivePayments, merchantBlockedMessage } from '../utils/merchantPaymentAcceptance.js';

// Stops a blocked merchant creating anything customers could pay. The pay
// paths refuse them anyway; this says so at creation, instead of handing the
// merchant a link that can only fail in front of their customer. Sign-in,
// history and withdrawals stay open. Goes after protectMerchant.
export function requireCollectionsOpen(req, res, next) {
  if (canReceivePayments(req.merchant)) return next();
  return res.status(403).json({ error: merchantBlockedMessage(req.merchant), code: 'COLLECTIONS_PAUSED' });
}
