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
export async function wasAlreadySettledByStkPush(merchant, grossAmount) {
  const recentWindow = new Date(Date.now() - 10 * 60 * 1000);
  const match = await STKRequest.findOne({
    merchantId: merchant._id,
    status: 'success',
    amount: grossAmount,
    updatedAt: { $gte: recentWindow },
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
 * Tiered "Safaricom-style" revenue split — credits an NCBA Virtual Account
 * inbound collection to a merchant's KES ledger.
 *
 *   { safaricomFee, markup, totalFee } = getNcbaTariffBand(grossAmount)   (config/ncbaTariffCard.js)
 *   netMerchantCredit = grossAmount - totalFee
 *
 * PayChain absorbs the Safaricom-cost component itself rather than passing
 * it through, so the *combined* total (not just the markup) is what's
 * deducted from the merchant. `markup` alone is what gets stamped onto
 * Transaction.paychainFee (via the model's pre-save hook, which sources the
 * same tariff table — see utils/feeCalculator.js) and is the number the
 * admin Revenue dashboard reports as PayChain's actual earned revenue.
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
