import Merchant from '../models/Merchant.js';
import PaymentLink from '../models/PaymentLink.js';
import CheckoutPage from '../models/CheckoutPage.js';
import ApiKey from '../models/ApiKey.js';

// "Half dead": a blocked merchant whose collection tools are off as well. It
// can still sign in, view history and withdraw, but nothing it set up can take
// a payment. Refusing payments is canReceivePayments' job, driven by
// inboundLocked (utils/merchantPaymentAcceptance.js); this also turns off the
// links, pages and keys, and marks them so a later "allow" restores only what
// the disable itself turned off.
//
// The merchant is stamped last, so a failure part-way leaves it listed as not
// yet disabled and the bulk action can simply be run again.
export async function disableMerchantCollections(merchantIds, adminId) {
  if (merchantIds.length === 0) return;
  const now = new Date();
  const merchantId = { $in: merchantIds };
  await Promise.all([
    PaymentLink.updateMany({ merchantId, status: 'active' }, { $set: { status: 'expired', disabledWithAccount: true } }),
    CheckoutPage.updateMany({ merchantId, active: true }, { $set: { active: false, disabledWithAccount: true } }),
    ApiKey.updateMany({ merchantId, status: 'active' }, { $set: { status: 'revoked', revokedAt: now, disabledWithAccount: true } }),
  ]);
  await Merchant.updateMany(
    { _id: { $in: merchantIds } },
    { $set: { accountDisabledAt: now, accountDisabledBy: adminId } }
  );
}

export async function restoreMerchantCollections(merchantIds) {
  if (merchantIds.length === 0) return;
  const marked = { merchantId: { $in: merchantIds }, disabledWithAccount: true };
  await Promise.all([
    PaymentLink.updateMany(marked, { $set: { status: 'active', disabledWithAccount: false } }),
    CheckoutPage.updateMany(marked, { $set: { active: true, disabledWithAccount: false } }),
    ApiKey.updateMany(marked, { $set: { status: 'active', revokedAt: null, disabledWithAccount: false } }),
  ]);
  await Merchant.updateMany(
    { _id: { $in: merchantIds } },
    { $set: { accountDisabledAt: null, accountDisabledBy: null } }
  );
}
