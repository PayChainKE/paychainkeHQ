import NcbaUnattributedCredit from '../models/NcbaUnattributedCredit.js';
import MissedNcbaCollectionCandidate from '../models/MissedNcbaCollectionCandidate.js';
import Transaction from '../models/Transaction.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';
import { creditNcbaCollection, DuplicateCollectionError } from './ncbaLedgerService.js';
import { INBOUND_TYPES } from './ncbaCollectionReconciliationService.js';
import { parseNcbaCustomerField } from '../utils/ncbaAccountNotificationValidators.js';
import { toE164Kenyan } from '../utils/notificationService.js';

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
    details: `A real KES ${amount.toLocaleString()} credit (ref ${escapeHtml(transId)}) landed on PayChain's NCBA account for ${escapeHtml(merchant.businessName || '')} (account ${escapeHtml(merchantCode)}), but this merchant's ${reason}. It was NOT credited to their wallet. Refund the payer, or credit it with "Credit held & disable" on the admin Merchants page.`,
    metadata: { transId, txnType, amount, merchantId: merchant._id.toString(), merchantCode, reason, customerName: rawCustomerName || null },
  });
  return { reason, duplicate: false };
}

// ── Crediting held deposits ─────────────────────────────────────────────────
// Only deposits held because of a payments block are ever credited. Ones held
// by a full account lock are a security decision, and ones for a deleted
// account have no wallet: both stay held for a refund.
const BLOCK_HELD = /\(([^()\s]+)\) — incoming payments blocked/;
export const heldMerchantCode = (note) => note?.match(BLOCK_HELD)?.[1] || null;

// How far before a hold a matching credit still counts as the same deposit.
// The two NCBA feeds have been seen 45-70 minutes apart.
const SAME_DEPOSIT_LOOKBACK_MS = 2 * 60 * 60 * 1000;
const lookbackFrom = (hold) => new Date(new Date(hold.createdAt).getTime() - SAME_DEPOSIT_LOOKBACK_MS);

// A hold is not proof the money is still uncredited: until 2026-11-05 the
// reconciliation feed credited blocked merchants while the other feed held the
// same deposit, and an admin may have used Credit Missed Collection since. The
// reference differs in both cases, so match on merchant and amount. Erring
// here leaves a real deposit for an admin to check, which is recoverable; a
// double credit spends other merchants' money.
async function doubleCreditRisk(hold, merchant, blockHeldRefs, earlierSibling) {
  if (!hold.transId) return 'No bank reference on this deposit';
  if (!(hold.amount > 0)) return 'No valid amount on this deposit';
  if (earlierSibling) return `May be the same deposit as ${earlierSibling.transId} from the other NCBA feed`;
  const since = lookbackFrom(hold);
  const creditedElsewhere = await Transaction.exists({
    merchantId: merchant._id,
    type: { $in: INBOUND_TYPES },
    status: 'completed',
    kesAmount: hold.amount,
    reference: { $nin: blockHeldRefs },
    createdAt: { $gte: since },
  });
  if (creditedElsewhere) return 'A credit of the same amount is already on this merchant\'s account';
  const creditedAsMissed = await MissedNcbaCollectionCandidate.exists({
    matchedMerchantId: merchant._id,
    amount: hold.amount,
    status: 'credited',
    resolvedAt: { $gte: since },
  });
  if (creditedAsMissed) return 'Already credited through Credit Missed Collection';
  return null;
}

// Each merchant's open block-held deposits, split into what is safe to credit
// and what an admin must check. Reads only, so preview and confirm can share it.
export async function reviewHeldDeposits(merchants) {
  const byCode = new Map(merchants.filter((m) => m.ncbaMerchantCode).map((m) => [m.ncbaMerchantCode, m]));
  const result = new Map(merchants.map((m) => [String(m._id), { creditable: [], needsReview: [] }]));
  if (byCode.size === 0) return result;

  const everHeld = await NcbaUnattributedCredit.find({ resolvedNote: BLOCK_HELD }).sort('createdAt');
  const blockHeldRefs = everHeld.map((h) => h.transId).filter(Boolean);
  const open = everHeld.filter((h) => !h.resolved);

  for (const hold of open) {
    const merchant = byCode.get(heldMerchantCode(hold.resolvedNote));
    if (!merchant) continue;
    const earlierSibling = open.find((other) => other.createdAt < hold.createdAt
      && other.amount === hold.amount
      && other.resolvedNote === hold.resolvedNote
      && (other.txnType === RECONCILIATION_FEED) !== (hold.txnType === RECONCILIATION_FEED)
      && hold.createdAt - other.createdAt <= CROSS_FEED_WINDOW_MS);
    const risk = await doubleCreditRisk(hold, merchant, blockHeldRefs, earlierSibling);
    const row = { holdId: String(hold._id), transId: hold.transId, amount: hold.amount, heldAt: hold.createdAt };
    const bucket = result.get(String(merchant._id));
    if (risk) bucket.needsReview.push({ ...row, reason: risk });
    else bucket.creditable.push(row);
  }
  return result;
}

// Credits one approved hold. Safe to repeat: the ledger's unique reference
// stops a second credit, so the hold is closed only once the money is in, and
// a retry after a crash just closes it. Admin-approved money only; nothing in
// the webhook path calls this.
export async function creditHeldDeposit(holdId, merchant, adminId) {
  const hold = await NcbaUnattributedCredit.findOne({ _id: holdId, resolved: false });
  if (!hold) return { credited: false, amount: 0 };

  const { name, phone } = parseNcbaCustomerField(hold.rawCustomerName);
  const customerPhone = [phone, hold.rawPhoneNr].map((p) => p && toE164Kenyan(p)).find(Boolean) || null;

  let credited = true;
  try {
    await creditNcbaCollection({
      merchant, grossAmount: hold.amount, bankRef: hold.transId, customerPhone, customerName: name || null,
    });
  } catch (err) {
    if (!(err instanceof DuplicateCollectionError)) throw err;
    credited = false;
  }

  await NcbaUnattributedCredit.updateOne(
    { _id: hold._id },
    { $set: { resolved: true, resolvedNote: `${hold.resolvedNote} — credited to wallet` } }
  );
  // The hourly sweep may have flagged this deposit too. Close that, or it
  // stays on Pool Reconciliation inviting a second credit.
  await MissedNcbaCollectionCandidate.findOneAndUpdate(
    { matchedMerchantId: merchant._id, amount: hold.amount, status: 'pending', createdAt: { $gte: lookbackFrom(hold) } },
    { $set: { status: 'dismissed', resolvedBy: adminId, resolvedAt: new Date(), resolutionNote: `Credited as held deposit ${hold.transId}` } }
  );
  return { credited, amount: credited ? hold.amount : 0 };
}
