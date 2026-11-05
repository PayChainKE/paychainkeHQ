import NcbaUnattributedCredit from '../models/NcbaUnattributedCredit.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';

// A customer paying the paybill straight from M-PESA reaches NCBA before
// PayChain is asked, so a block can't stop that money landing. It must not
// reach the merchant's wallet, but it must not vanish either: park it with the
// unattributed credits and alert admins so they can refund the payer or credit
// it once the block lifts.
//
// NCBA reports one deposit on two feeds under different references, so the
// same deposit would otherwise be held and alerted twice, inviting a double
// refund. Each deposit reaches both feeds, so whichever feed arrives first
// records all of them and the other can safely stand down.
const CROSS_FEED_WINDOW_MS = 30 * 60 * 1000;

export const RECONCILIATION_FEED = 'NCBA_RECONCILIATION';

export async function holdBlockedMerchantCredit({
  merchant, merchantCode, transId, txnType, amount,
  rawAccountNr = null, rawNarrative = null, rawCustomerName = null, rawPhoneNr = null,
}) {
  const reason = merchant.status === 'locked' ? 'account locked' : 'incoming payments blocked';
  const resolvedNote = `Held: ${merchant.businessName || merchantCode} (${merchantCode}) — ${reason}`;

  const alreadyHeld = await NcbaUnattributedCredit.exists({
    $or: [
      { transId },
      {
        amount,
        resolvedNote,
        txnType: txnType === RECONCILIATION_FEED ? { $ne: RECONCILIATION_FEED } : RECONCILIATION_FEED,
        createdAt: { $gte: new Date(Date.now() - CROSS_FEED_WINDOW_MS) },
      },
    ],
  });
  if (alreadyHeld) return { reason, duplicate: true };

  await NcbaUnattributedCredit.create({
    transId, txnType, amount, rawAccountNr, rawNarrative, rawCustomerName, rawPhoneNr, resolvedNote,
  });
  notifyAdmins({
    type: 'ncba_blocked_merchant_credit',
    severity: 'critical',
    subject: `KES ${amount.toLocaleString()} paid to ${merchant.businessName || merchantCode} was held (${reason})`,
    heading: 'Payment Held — Merchant Cannot Receive',
    details: `A real KES ${amount.toLocaleString()} credit (ref ${escapeHtml(transId)}) landed on PayChain's NCBA account for ${escapeHtml(merchant.businessName || '')} (account ${escapeHtml(merchantCode)}), but this merchant's ${reason}. It was NOT credited to their wallet. Refund the payer, or credit it via the missed-collection tool once the block is lifted.`,
    metadata: { transId, txnType, amount, merchantId: merchant._id.toString(), merchantCode, reason, customerName: rawCustomerName || null },
  });
  return { reason, duplicate: false };
}
