import mongoose from 'mongoose';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import STKRequest from '../models/STKRequest.js';
import { getNcbaTariffBand } from '../config/ncbaTariffCard.js';

// STK-collected money (see services/ncbaStkPushService.js) lands in the same
// NCBA account as every other collection and settles via the app-aware
// resolveStkOutcome() path in mpesaController.js — with the correct
// Payment Link/Invoice/wallet-surcharge split, not the generic tiered
// getNcbaTariffBand() split creditNcbaCollection applies below. Because it's
// the same underlying money movement, it will very likely ALSO arrive on
// NCBA's generic account-notification feed under an already-allowlisted
// code (876 MPESA Transfer Credit / 883 e-MPESA Transfer — see
// config/ncbaAccountNotificationCodes.js) — without this guard that would
// double-credit the merchant. Both NCBA webhook controllers must call this
// before creditNcbaCollection.
//
// This used to be a 10-minute (briefly 24-hour) time window, on the
// assumption NCBA's account-notification feed arrives close behind the STK
// poll's own resolution. A real production incident (2026-08-26) proved
// that assumption unsafe at ANY fixed width: NCBA's webhook landed 45–70
// minutes after the STK poll's own success for three separate payments —
// already past the original 10-minute window — and there is no guarantee
// some future delivery couldn't land even later than a wider window too.
// Any time-bounded guard leaves a residual gap where the same real money
// gets credited twice — once here, once via the STK-aware path — inflating
// a merchant's balance with money that was never actually deposited, which
// is then withdrawable as real cash (confirmed: this is exactly what let
// one merchant cash out more than they'd genuinely paid in).
//
// Fixed by removing the time bound entirely: `notificationMatched` makes
// this an atomic, one-time claim on the specific STKRequest instead of a
// guess bounded by elapsed time. findOneAndUpdate's own atomicity is what
// makes this safe under concurrent/redelivered webhooks — two callers can
// never both win the claim on the same STKRequest, so it can never
// contribute to a double-credit no matter how long NCBA takes to deliver.
//
// The tradeoff this accepts: if the SAME merchant is ever paid the exact
// same KES amount twice via STK, and the second payment's own webhook
// notification happens to race in before its own STK poll resolves, it
// could in theory match this (older, already-claimed) request's sibling
// instead of its own — but that only ever causes a webhook to correctly
// no-op (because ITS OWN poll-based resolveStkOutcome call independently
// credits that second payment regardless of this function's outcome — see
// this function's other caller sites). It can never cause a double-credit;
// at worst a coincidental-amount non-STK deposit is skipped and needs
// manual reconciliation, which is recoverable — unlike fabricated balance.
export async function wasAlreadySettledByStkPush(merchant, grossAmount) {
  const claimed = await STKRequest.findOneAndUpdate(
    { merchantId: merchant._id, status: 'success', amount: grossAmount, notificationMatched: { $ne: true } },
    { $set: { notificationMatched: true } }
  );
  return !!claimed;
}

// Finds an STKRequest that pollAndResolveNcbaStkPush (mpesaController.js)
// already gave up on and marked 'failed' — but that NCBA's own account-
// notification/reconciliation webhook now shows actually landed. NCBA's STK
// Query endpoint can report FAILED for a transaction still genuinely in
// flight (see TRANSIENT_FAILURE_PATTERN in mpesaController.js); once the
// poll loop's confirmation threshold is hit, nothing polls again, so a
// customer who pays a few seconds later leaves the STKRequest permanently
// wrong — the admin STK monitor would show 'failed' for a payment that
// actually succeeded, and the merchant would only ever get credited via the
// generic (wrong fee-split) path below instead of the STK-aware one.
//
// Matches wasAlreadySettledByStkPush's 24-hour window above (see its comment
// for why 10/30 minutes proved too short against real NCBA webhook delay) —
// this is catching a poll loop that already exhausted its own multi-minute
// retry budget before giving up, so the webhook confirming success can
// legitimately arrive well after that.
const FALSE_FAILURE_RECHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function findFalselyFailedStkRequest(merchant, grossAmount) {
  return STKRequest.findOne({
    merchantId: merchant._id,
    channel: 'stk',
    status: 'failed',
    amount: grossAmount,
    updatedAt: { $gte: new Date(Date.now() - FALSE_FAILURE_RECHECK_WINDOW_MS) },
  });
}

// A second, independent double-credit vector — distinct from the STK one
// above. NCBA reports collections through TWO separate live webhooks:
// ncbaController.js's reconciliation push (keyed by NCBA's
// `transactionReference`) and ncbaAccountNotificationController.js's
// account-notification push (keyed by NCBA's `TransID`) — and per that
// controller's own doc comment, the account-notification feed "fires on
// every debit/credit on PayChain's NCBA account, not just merchant virtual
// account collections", meaning its scope overlaps the reconciliation
// push's. If NCBA ever reports the same real collection on both feeds using
// two DIFFERENT reference strings (which is how each feed names the same
// event in its own scheme), Transaction.reference's unique index can't
// catch it — that index only rejects the exact same reference appearing
// twice, e.g. one feed redelivering. Both webhook controllers must call
// this immediately before creditNcbaCollection, alongside
// wasAlreadySettledByStkPush, so a genuine non-STK collection reported on
// both feeds doesn't get credited twice either.
//
// This is a window check, not an atomic claim like wasAlreadySettledByStkPush
// above — there's no shared, indexed, single-use record to claim against
// across two independent external feeds. Both NCBA integrations are
// documented as real-time, so 30 minutes is a generous margin over any
// realistic delivery gap between them; the narrow remaining risk is two
// deliveries landing within milliseconds of each other on concurrent
// requests, which is a far smaller and lower-probability window than the
// 45–70 minute gap that caused the STK incident this guard's sibling fixes.
const CROSS_FEED_DEDUP_WINDOW_MS = 30 * 60 * 1000;

export async function wasAlreadyCreditedByOtherNcbaFeed(merchant, grossAmount, currentBankRef) {
  const match = await Transaction.findOne({
    merchantId: merchant._id,
    type: 'ncba_inbound',
    status: 'completed',
    amount: grossAmount,
    reference: { $ne: currentBankRef },
    createdAt: { $gte: new Date(Date.now() - CROSS_FEED_DEDUP_WINDOW_MS) },
  });
  return !!match;
}

export class DuplicateCollectionError extends Error {
  constructor(bankRef) {
    super(`NCBA collection ${bankRef} was already processed`);
    this.name = 'DuplicateCollectionError';
    this.bankRef = bankRef;
  }
}

const isDuplicateKeyError = (err) => err && err.code === 11000;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Credits an NCBA Virtual Account inbound collection to a merchant's KES
 * ledger. Money IN is never charged to the merchant — netAmount always
 * equals grossAmount in full (getNcbaTariffBand's totalFee is always 0; see
 * config/ncbaTariffCard.js's header comment for the full policy, including
 * why PayChain doesn't model a Safaricom-side cost for this rail either).
 *

 * The Transaction insert and the balance increment happen inside a single
 * Mongo session transaction so a mid-flight crash can never leave a ledger
 * entry without a matching balance credit (or vice versa), and concurrent
 * webhook deliveries for the same bank reference can't double-credit —
 * the unique index on Transaction.reference aborts the second writer.
 *
 * @throws {NcbaTariffBoundsError} if grossAmount is non-positive or exceeds
 *         MAX_NCBA_COLLECTION_AMOUNT (config/ncbaTariffCard.js) — thrown
 *         before any session/DB work is done.
 *
 * @param {object} params
 * @param {string} [params.customerPhone] - Optional: NCBA's reconciliation
 *        push doesn't guarantee a payer MSISDN (unlike the M-Pesa STK/C2B
 *        flows elsewhere in this codebase), so this may be omitted.
 * @param {string} [params.customerName] - Optional: the payer's real name,
 *        when the calling webhook actually received one (e.g. the account
 *        notification webhook's parsed CustomerName field). Falls back to a
 *        generic label when omitted — the plain reconciliation webhook has
 *        no name field at all, so this is always omitted from that caller.
 */
export async function creditNcbaCollection({ merchant, grossAmount, bankRef, customerPhone = null, customerName = null }) {
  // Validate + price the collection up front — fail fast, before opening a
  // session, for an amount that was never going to be creditable.
  const { safaricomFee, markup, totalFee } = getNcbaTariffBand(grossAmount);
  const netAmount = round2(grossAmount - totalFee);

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      let transaction;
      try {
        [transaction] = await Transaction.create(
          [
            {
              merchantId: merchant._id,
              accountNumber: merchant.ncbaMerchantCode,
              type: 'ncba_inbound',
              amount: grossAmount,
              kesAmount: grossAmount,
              currency: 'KES',
              status: 'completed',
              reference: bankRef,
              sender: { name: customerName || 'PayChain Virtual Account Customer', id: customerPhone },
              recipient: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
              // paychainFee/safaricomFee/revenueStream are auto-stamped by
              // the Transaction pre-save hook via calculateFees(), which
              // sources the same getNcbaTariffBand() lookup used above —
              // the stored fee and the amount actually deducted here can
              // never drift apart.
            },
          ],
          { session }
        );
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new DuplicateCollectionError(bankRef);
        throw err;
      }

      const updatedMerchant = await Merchant.findByIdAndUpdate(
        merchant._id,
        { $inc: { kesBalance: netAmount } },
        { returnDocument: 'after', session }
      );

      result = {
        transaction,
        merchant: updatedMerchant,
        grossAmount,
        safaricomFee,
        paychainFee: markup,
        totalFee,
        netAmount,
        streamId: transaction.revenueStream,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}
