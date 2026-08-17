import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, sendStaggeredSms } from '../utils/smsSanitizer.js';
import { processSplitTransaction, processInvoiceSplitTransaction, splitCustomerSurcharge, getCheckoutTotal, PricingEngineError } from '../utils/pricingEngine.js';
import { sendInvoicePaidReceiptEmail } from '../utils/resend.js';
import STKRequest from '../models/STKRequest.js';
import PayoutBatch from '../models/PayoutBatch.js';
import PaymentLink from '../models/PaymentLink.js';
import Invoice from '../models/Invoice.js';
import { createNotification } from './notificationController.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { getB2cTariff, B2cTariffBoundsError } from '../config/mpesaB2cTariffCard.js';
import { getLipaNaMpesaTariff } from '../config/lipaNaMpesaTariffCard.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { AUTO_INFLATION_SHIELD_ENABLED } from '../config/inflationShieldFlag.js';
import { buildPaymentReceivedSms, buildCustomerPaidSms } from '../utils/paymentSmsTemplates.js';
import { initiateStkPush as ncbaInitiateStkPush, queryStkPush as ncbaQueryStkPush, generateQrCode as ncbaGenerateQrCode } from '../services/ncbaStkPushService.js';
import { validateMobileWalletNumber as ncbaValidateMobileWalletNumber, submitMobileB2wPayment as ncbaSubmitMobileB2wPayment, validateLipaNaMpesaAccount as ncbaValidateLnmAccount, submitLipaNaMpesaPayment as ncbaSubmitLnmPayment, NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber, NcbaValidationError, getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';
import { generateBrandedQrDataUri } from '../utils/qrCode.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';

const FRONTEND_URL = process.env.MERCHANT_DASHBOARD_URL || 'https://app.paychain.co.ke';

// Safaricom Daraja is no longer used anywhere in this app — STK Push, B2C,
// and B2B all route through NCBA (see initiateSTKPush/initiateB2C/initiateB2B
// below). The Daraja C2B confirmation webhook, its OAuth token/URL
// registration, and the demo-merchant simulator that drove it have been
// removed; MPESA_CONSUMER_KEY/_SECRET/_CALLBACK_URL/_WEBHOOK_SECRET/
// _SHORTCODE/_ENVIRONMENT are no longer read anywhere in the codebase.
// ================= STK PUSH (LIPA NA M-PESA ONLINE) =================

export const initiateSTKPush = async (req, res) => {
  try {
    const { amount, phone, purpose } = req.body;
    // Always the authenticated caller's own account — never trust a
    // client-supplied merchantId (route requires protectMerchant). Taking
    // it from req.body let any authenticated merchant credit an arbitrary
    // merchant's balance, which the sandbox auto-confirm made instant.
    const merchantId = req.merchant._id;

    // Normalise + validate to 254XXXXXXXXX — rejects malformed numbers here
    // rather than letting them reach NCBA or get stored as the
    // transaction's counterparty.
    let formattedPhone;
    try {
      formattedPhone = validatePhoneNumber(phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
      throw e;
    }

    const intAmount = Math.ceil(Number(amount));

    // This endpoint is shared by two different flows: a merchant topping up
    // their OWN wallet, and "Request Money → Instant M-PESA Prompt" (the
    // frontend sends purpose: 'request_money'), which prompts a real
    // customer's phone. Both are billed PayChain's flat customer surcharge,
    // same as Payment Links — `kind` is kept purely for labeling/audit
    // (self top-up vs money collected from someone else), not for deciding
    // whether the fee applies.
    const kind = purpose === 'request_money' ? 'request_money' : 'topup';
    const checkoutTotal = getCheckoutTotal(intAmount);

    // Real STK Push via NCBA's Till short code 889066 (or simulated — see
    // services/ncbaStkPushService.js's NCBA_STK_LIVE_ENABLED gate).
    const checkoutRequestId = await initiateAndTrackNcbaStk({
      merchantId,
      phone: formattedPhone,
      checkoutTotal,
      extra: { baseAmount: intAmount, kind },
    });
    res.status(200).json({
      success: true,
      checkoutRequestId,
      message: 'STK Push sent — check your phone for the M-PESA prompt.',
    });

  } catch (error) {
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error('❌ STK Push Error:', detail);
    res.status(502).json({ error: error.response?.data?.errorMessage || 'Failed to send STK Push — please try again.', detail });
  }
};

// Settlement logic (Payment Link split, invoice paid, wallet credit,
// surcharge split, SMS) for a resolved STK Push outcome, called by the NCBA
// poll loop (pollAndResolveNcbaStkPush, below) once queryStkPush reports
// SUCCESS or FAILED.
export async function resolveStkOutcome(stkReq, { succeeded, receipt, resultDesc, transTime }) {
  // NCBA's poll and the separate generic account-notification webhook can
  // both observe the same underlying transaction. Everything below this
  // point credits a merchant's balance, so once a request has already
  // resolved (success or failed), any further resolution for the same
  // checkoutRequestId is a duplicate — no-op.
  //
  // This MUST be an atomic claim, not a read-then-write: a plain
  // `if (stkReq.status !== 'pending') return;` followed by a separate
  // `.save()` later is a TOCTOU race — two concurrent redeliveries (exactly
  // the scenario described above) could both read 'pending' before either
  // write, both pass the guard, and both credit the merchant. The
  // status:'pending' filter in this findOneAndUpdate is what actually makes
  // only one caller ever win the transition; everyone else gets null back
  // and returns without touching the ledger.
  const claimed = await STKRequest.findOneAndUpdate(
    { _id: stkReq._id, status: 'pending' },
    { $set: { status: succeeded ? 'success' : 'failed', resultDesc } },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    console.warn(`⚠️ Duplicate STK resolution for ${stkReq.checkoutRequestId} (already resolved) — ignoring.`);
    return;
  }
  stkReq.status = claimed.status;
  stkReq.resultDesc = claimed.resultDesc;

  if (succeeded) {
      const { date, time } = formatTransactionDateTime(transTime);

      if (stkReq.linkId) {
        // Settling a PaymentLink (optionally backing an Invoice) — this is
        // the customer-facing "pay this link" flow, not a wallet top-up.
        //
        // Must be an atomic claim, not read-then-write: processPaymentLink
        // only checks status='active' at STK-initiation time, so two STK
        // pushes against the same linkId (shared link, double-tap, retry)
        // can both resolve successfully. A plain `if (link.status ===
        // 'active') { link.status = 'paid'; await link.save() }` is a TOCTOU
        // race — both could read 'active' before either write and both
        // credit the merchant twice, or the loser could silently drop a
        // real, Safaricom-confirmed payment on the floor. The status:
        // 'active' filter below is what makes only one caller ever win the
        // transition — same idiom as the STKRequest claim above.
        const link = await PaymentLink.findOneAndUpdate(
          { linkId: stkReq.linkId, status: 'active' },
          { $set: { status: 'paid' } },
          { returnDocument: 'after' }
        ).populate('merchantId');

        if (!link) {
          // Real money already left the customer's account (Safaricom just
          // confirmed it) but there's no 'active' link left to credit it
          // against — either a genuine double-payment on the same link, or
          // the link was never active. Never drop this silently: it must
          // surface for manual reconciliation rather than vanish.
          console.error(
            `🚨 STK succeeded for linkId ${stkReq.linkId} (receipt ${receipt}) but the link was not in 'active' status — ` +
            `likely a duplicate/racing payment against an already-settled link. Needs manual reconciliation.`
          );
        }

        if (link) {
          let paidInvoice = null;
          if (link.invoiceId) {
            paidInvoice = await Invoice.findByIdAndUpdate(link.invoiceId, { status: 'paid', paidAt: new Date() }, { returnDocument: 'after' });
          }

          const merchant = link.merchantId;
          if (merchant) {
            // Dual-sided split: stkReq.amount is the TOTAL Safaricom just
            // confirmed (base + any customer-facing markup, from
            // getCheckoutTotal/getInvoiceCheckoutTotal at checkout-initiation
            // time); link.amount is the original base bill. An
            // invoice-backed link uses the Electronic Invoicing tariff's own
            // split (it genuinely charges the merchant an Invoice Service
            // Fee, unlike every other product here). Wrapped defensively —
            // this only throws on a genuine ledger-integrity failure (see
            // pricingEngine.js), and by this point Safaricom has already
            // confirmed real money moved, so a calculation bug must never
            // silently swallow the merchant's credit. Falls back to
            // crediting the base amount at zero fee (safest for the
            // merchant) and flags the discrepancy loudly for manual review.
            let merchantFee;
            let merchantNetSettlement;
            let paychainTotalRevenue;
            let customerFee;
            try {
              ({ merchantFee, merchantNetSettlement, paychainTotalRevenue, customerFee } = link.invoiceId
                ? processInvoiceSplitTransaction(stkReq.amount, link.amount)
                : processSplitTransaction(stkReq.amount, link.amount));
            } catch (splitError) {
              console.error(
                `🚨 CRITICAL ledger split failure for ${receipt} (STK payment-link ${link.linkId}):`,
                splitError instanceof PricingEngineError ? splitError.message : splitError,
                { totalReceived: stkReq.amount, baseAmount: link.amount }
              );
              merchantFee = 0;
              merchantNetSettlement = link.amount;
              paychainTotalRevenue = 0;
              customerFee = 0;
            }

            console.log(
              `💰 STK checkout split for ${receipt}: total KES ${stkReq.amount} (base KES ${link.amount} + customer fee KES ${customerFee}), ` +
              `PayChain revenue KES ${paychainTotalRevenue} (merchant fee KES ${merchantFee} + customer fee KES ${customerFee}), merchant net KES ${merchantNetSettlement}`
            );

            // Atomic $inc (not merchant.save()) — also hands back the real
            // post-credit balance for the SMS below.
            const updatedMerchant = await Merchant.findByIdAndUpdate(
              merchant._id,
              { $inc: { kesBalance: merchantNetSettlement } },
              { returnDocument: 'after' }
            );

            // kesAmount is deliberately the BASE bill, not the inflated
            // total — this is the same basis the automatic Transaction
            // pre-save hook feeds into calculateMerchantFee (see
            // utils/feeCalculator.js), so this doc's auto-stamped
            // paychainFee starts out equal to `merchantFee` above exactly.
            // The customer-surcharge portion is added on top immediately
            // below via a follow-up $inc (a plain .save() would let the
            // pre-save hook re-run and clobber it, since it re-fires on any
            // amount/type change — an atomic update bypasses that safely).
            const transaction = await Transaction.create({
              merchantId: merchant._id,
              accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
              type: 'inbound',
              amount: link.amount,
              kesAmount: link.amount,
              currency: 'KES',
              status: 'completed',
              reference: receipt,
              // Unlike C2B (processMpesaC2bPayload above), Safaricom's STK
              // Push callback never includes the payer's registered name —
              // only their phone number. That's the one real sender detail
              // available, so it's the sender identity here too, same as a
              // real M-Pesa confirmation SMS falls back to showing the
              // number when it has no name to show.
              sender: { name: formatPhoneDisplay(stkReq.phone), id: formatPhoneDisplay(stkReq.phone) },
              recipient: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
              balanceAfter: updatedMerchant.kesBalance,
            });

            if (customerFee > 0) {
              // paychainFee is what services/revenueSweepService.js sweeps
              // out to PayChain's own account and what the pool-balance
              // reconciliation treats as PayChain's accrued revenue —
              // incrementing it here (not just customerSurchargeFee) is
              // what makes this surcharge actually become PayChain's money
              // rather than sit unlabeled in the pooled balance.
              // customerSurchargeFee is kept alongside so the breakdown
              // (surcharge vs merchant fee) stays auditable per transaction.
              await Transaction.updateOne(
                { _id: transaction._id },
                { $inc: { paychainFee: customerFee, customerSurchargeFee: customerFee } }
              );
            }

            if (link.invoiceId && merchantFee > 0) {
              // The Transaction pre-save hook auto-stamps paychainFee from
              // the generic (disabled) calculateMerchantFee, not
              // calculateInvoiceServiceFee — so on an invoice-backed link
              // this doc's paychainFee comes out of Transaction.create as 0
              // even though the merchant was genuinely charged merchantFee
              // above (already deducted from merchantNetSettlement / the
              // $inc into kesBalance). Top it up here the same way
              // customerFee is, so paychainFee actually reflects total
              // PayChain revenue on this row, not just the customer side.
              await Transaction.updateOne(
                { _id: transaction._id },
                { $inc: { paychainFee: merchantFee, invoiceServiceFee: merchantFee } }
              );
            }

            createNotification({
              merchantId: merchant._id,
              kind: 'payment',
              title: link.invoiceId ? 'Invoice paid' : 'Payment link paid',
              message: `KES ${stkReq.amount.toLocaleString()} ${link.invoiceId ? 'invoice' : 'payment link'} was paid by a customer.`,
            });

            if (paidInvoice && merchant.email) {
              const paidSubtotal = (paidInvoice.items || []).reduce((sum, i) => sum + i.qty * i.price, 0);
              sendInvoicePaidReceiptEmail({
                to: merchant.email,
                businessName: merchant.businessName,
                invoiceNumber: paidInvoice.invoiceNumber,
                customerName: paidInvoice.customer?.name || 'Customer',
                items: paidInvoice.items,
                currency: paidInvoice.currency,
                subtotal: paidSubtotal,
                total: paidSubtotal,
                paidAt: paidInvoice.paidAt,
                mpesaReceipt: receipt,
                payerPhone: stkReq.phone,
              }).catch((e) => console.error('❌ Failed to send invoice-paid receipt email:', e.message));
            }

            // Customer receipt + merchant alert — staggered (see
            // sendStaggeredSms's doc comment in utils/smsSanitizer.js) and
            // fully DETACHED from this handler's response to Safaricom
            // (never awaited): the africastalking SDK call has no
            // configured timeout, so awaiting it here would expose
            // Safaricom's own webhook ack to whatever delay AT's API has —
            // real payment-processing risk, not just a slow SMS. Matches
            // how the NCBA controllers already handle this. Account
            // reference mirrors M-Pesa's own "for account X" convention:
            // the invoice number if this settled an invoice, else the
            // merchant's NCBA account code, else the raw payment-link id
            // as a last resort.
            const payerLabel = link.invoiceId ? 'invoice' : 'payment link';
            const accountRef = paidInvoice?.invoiceNumber || merchant.ncbaMerchantCode || stkReq.linkId;
            const linkSends = [];
            if (stkReq.phone) {
              linkSends.push({
                to: stkReq.phone,
                message: buildCustomerPaidSms({
                  ref: receipt,
                  amount: stkReq.amount,
                  businessName: merchant.businessName,
                  accountRef,
                  date,
                  time,
                }).message,
              });
            }
            // Merchant sees their base bill amount, not the customer's
            // total (which may include a surcharge that was never the
            // merchant's money) — matches merchantNetSettlement/link.amount
            // being what actually moves their balance.
            // Safaricom's STK callback never includes the payer's registered
            // name (unlike the C2B Confirmation payload, which does) — only
            // their phone number, which we do have via stkReq.phone.
            // buildPaymentReceivedSms defaults payerName to "a customer"
            // when null.
            if (merchant.phone) {
              linkSends.push({
                to: merchant.phone,
                message: buildPaymentReceivedSms({
                  ref: receipt,
                  amount: link.amount,
                  payerName: null,
                  payerPhone: stkReq.phone,
                  date,
                  time,
                  balance: updatedMerchant.kesBalance || 0,
                }).message,
              });
            }
            sendStaggeredSms(linkSends).then((results) => {
              let idx = 0;
              if (stkReq.phone) {
                const r = results[idx++];
                if (!r.success) console.error(`STK ${payerLabel} customer SMS failed for ${receipt}:`, r.error);
              }
              if (merchant.phone) {
                const r = results[idx++];
                if (!r.success) console.error(`STK ${payerLabel} merchant SMS failed for ${receipt}:`, r.error);
              }
            });
          }
        }
      } else {
        // Plain wallet top-up / Request Money's instant prompt /
        // pay-to-account — anything that isn't a PaymentLink/Invoice
        // settlement. All three carry PayChain's flat customer surcharge on
        // top of stkReq.baseAmount — same mechanism as the PaymentLink
        // branch above, just without a merchant-side tiered fee (never
        // applied to these flows, by design). A self-funding top-up is
        // billed the fee too — the merchant is both sender and recipient
        // there, so they simply pay it themselves. stkReq.kind is kept for
        // labeling/audit only, not for deciding whether the fee applies.
        // Older STKRequest docs predating this field have baseAmount ===
        // null, which the guard below treats as "no split" — safe, since
        // that's the zero-fee behavior they were always credited with
        // (skip inflation shield either way since these are wallet credits,
        // not a merchant electing to convert to USDC).
        const merchant = await Merchant.findById(stkReq.merchantId);
        if (merchant) {
          const kind = stkReq.kind || 'topup';
          let merchantCredit = stkReq.amount;
          let customerFee = 0;

          if (stkReq.baseAmount != null) {
            try {
              ({ customerFee, merchantNetSettlement: merchantCredit } =
                splitCustomerSurcharge(stkReq.amount, stkReq.baseAmount));
            } catch (splitError) {
              console.error(
                `🚨 CRITICAL ledger split failure for ${receipt} (STK ${kind}):`,
                splitError instanceof PricingEngineError ? splitError.message : splitError,
                { totalReceived: stkReq.amount, baseAmount: stkReq.baseAmount }
              );
              merchantCredit = stkReq.amount;
              customerFee = 0;
            }
          }

          const updatedMerchant = await Merchant.findByIdAndUpdate(
            merchant._id,
            { $inc: { kesBalance: merchantCredit } },
            { returnDocument: 'after' }
          );

          const transaction = await Transaction.create({
            merchantId: merchant._id,
            accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
            type: 'top_up',
            amount: merchantCredit,
            kesAmount: merchantCredit,
            currency: 'KES',
            status: 'completed',
            reference: receipt,
            // See the identical comment on the PaymentLink branch above —
            // Safaricom's STK Push callback has no payer-name field, only a
            // phone number, so that's the sender identity here too.
            sender: { name: formatPhoneDisplay(stkReq.phone), id: formatPhoneDisplay(stkReq.phone) },
            recipient: { name: merchant.businessName, id: 'WALLET' },
            balanceAfter: updatedMerchant.kesBalance,
          });

          if (customerFee > 0) {
            await Transaction.updateOne(
              { _id: transaction._id },
              { $inc: { paychainFee: customerFee, customerSurchargeFee: customerFee } }
            );
          }

          createNotification({
            merchantId: merchant._id,
            kind: 'wallet',
            title: 'Wallet topped up',
            message: `KES ${merchantCredit.toLocaleString()} was added to your balance via M-PESA.`,
          });

          // 'topup' — the merchant funding their own wallet, no separate
          // "customer" to name — keeps a plain wallet-top-up message.
          // 'request_money' / 'pay_account' — a real customer paid, so this
          // uses the same professional "payment received" format as every
          // other collection rail.
          // Staggered (see sendStaggeredSms's doc comment in
          // utils/smsSanitizer.js — also covers why "same recipient" cases,
          // like a merchant testing their own request-money link, need this
          // too) and fully DETACHED from this handler's response to
          // Safaricom (never awaited): the africastalking SDK call has no
          // configured timeout, so awaiting it here would expose
          // Safaricom's own webhook ack to whatever delay AT's API has —
          // real payment-processing risk, not just a slow SMS. Matches how
          // the NCBA controllers already handle this.
          const topupSends = [];
          if (merchant.phone) {
            topupSends.push({
              to: merchant.phone,
              message: kind === 'topup'
                ? `${receipt} Confirmed. KES ${merchantCredit.toLocaleString()} added to your PayChain wallet via M-PESA on ${date} at ${time}. Your updated available balance is KES ${(updatedMerchant.kesBalance || 0).toLocaleString()}.`
                : buildPaymentReceivedSms({
                    ref: receipt,
                    amount: merchantCredit,
                    payerName: null,
                    payerPhone: stkReq.phone,
                    date,
                    time,
                    balance: updatedMerchant.kesBalance || 0,
                  }).message,
            });
          }

          // The customer/payer side of this — previously missing entirely
          // for 'request_money' and 'pay_account': Payment Links and C2B
          // both already confirm to the payer, this branch never did.
          // Self-funding top-ups skip this (merchant.phone === stkReq.phone
          // there in practice, and the merchant SMS above already IS their
          // confirmation — a second copy would be redundant, not useful).
          if (kind !== 'topup' && stkReq.phone) {
            topupSends.push({
              to: stkReq.phone,
              message: buildCustomerPaidSms({
                ref: receipt,
                amount: stkReq.amount,
                businessName: merchant.businessName,
                accountRef: merchant.ncbaMerchantCode,
                date,
                time,
              }).message,
            });
          }

          sendStaggeredSms(topupSends).then((results) => {
            let idx = 0;
            if (merchant.phone) {
              const r = results[idx++];
              if (!r.success) console.error(`Wallet top-up SMS failed for merchant ${merchant._id}:`, r.error);
            }
            if (kind !== 'topup' && stkReq.phone) {
              const r = results[idx++];
              if (!r.success) console.error(`STK ${kind} customer SMS failed for ${receipt}:`, r.error);
            }
          });
        }
      }
  }
  // Cancelled/failed case: the atomic claim above already persisted
  // status: 'failed' — the PaymentLink itself is deliberately left
  // 'active' so the customer can retry.

  // Developer API fan-out: if this checkout was initiated via POST
  // /api/v1/developer/payments/collect (matched by linkedStkCheckoutId),
  // sync its status to whatever this function just resolved and fire the
  // matching payment.collect.* webhook — this is the only place a live
  // collect's success is ever learned, so it's the only place that webhook
  // can fire from. No-ops for any STKRequest that isn't Developer-API-linked
  // (the far more common case: dashboard-initiated top-ups/payment links).
  const developerPayment = await DeveloperPayment.findOneAndUpdate(
    { linkedStkCheckoutId: stkReq.checkoutRequestId, status: 'pending' },
    {
      $set: {
        status: claimed.status,
        ...(claimed.status === 'failed' ? { failureReason: resultDesc || 'Collection failed.' } : {}),
      },
    },
    { returnDocument: 'after' }
  );
  if (developerPayment) {
    dispatchDeveloperEvent(
      developerPayment.developerId,
      `payment.collect.${claimed.status === 'success' ? 'succeeded' : 'failed'}`,
      { payment: publicDeveloperPayment(developerPayment) }
    );
  }
}

// ── NCBA STK Push resolution (poll-based) ───────────────────────────────────
// NCBA's STK Push API documents no confirmation webhook payload — only a
// Query endpoint. Rather than depend on an unconfirmed IPN shape, the
// outcome is learned by polling shortly after the prompt is sent, then fed
// through the exact same resolveStkOutcome() a real Safaricom callback uses.
const NCBA_STK_POLL_INTERVAL_MS = 4000;
const NCBA_STK_POLL_MAX_ATTEMPTS = 30; // ~2 minutes — typical STK prompt validity window

// Fire-and-forget: intentionally not awaited by callers, mirroring how every
// other webhook-driven settlement in this codebase (Daraja's own callbacks,
// the NCBA reconciliation webhooks) never blocks the HTTP response that
// triggered it on the eventual settlement.
export function pollAndResolveNcbaStkPush(checkoutRequestId, transactionId) {
  let attempts = 0;

  const poll = async () => {
    attempts += 1;
    try {
      const { status, description } = await ncbaQueryStkPush({ transactionId });
      if (status === 'SUCCESS' || status === 'FAILED') {
        const stkReq = await STKRequest.findOne({ checkoutRequestId });
        if (!stkReq) {
          console.warn('⚠️ NCBA STK poll resolved for unknown request:', checkoutRequestId);
          return;
        }
        await resolveStkOutcome(stkReq, {
          succeeded: status === 'SUCCESS',
          receipt: transactionId,
          resultDesc: description || status,
        });
        return;
      }
    } catch (err) {
      // Transient query failure — keep polling rather than failing the
      // whole request early; a genuinely stuck request still resolves via
      // the timeout branch below.
      console.error(`❌ NCBA STK poll error for ${checkoutRequestId}:`, err.message);
    }

    if (attempts >= NCBA_STK_POLL_MAX_ATTEMPTS) {
      const stkReq = await STKRequest.findOne({ checkoutRequestId });
      if (stkReq && stkReq.status === 'pending') {
        await resolveStkOutcome(stkReq, {
          succeeded: false,
          receipt: transactionId,
          resultDesc: 'Timed out waiting for customer response',
        });
      }
      return;
    }

    setTimeout(poll, NCBA_STK_POLL_INTERVAL_MS);
  };

  setTimeout(poll, NCBA_STK_POLL_INTERVAL_MS);
}

// Shared by every STK-initiation call site (this file's initiateSTKPush,
// plus transactionController.js's processPaymentLink and payToMerchantAccount)
// — creates the STKRequest tracking record keyed by NCBA's own
// TransactionID, and starts the poll loop above. `extra` carries whatever
// call-site-specific fields apply (linkId, or baseAmount+kind).
export async function initiateAndTrackNcbaStk({ merchantId, phone, checkoutTotal, extra = {} }) {
  const merchant = await Merchant.findById(merchantId).select('ncbaMerchantCode');
  if (!merchant?.ncbaMerchantCode) {
    throw new Error('This merchant has no NCBA virtual account assigned yet — cannot process this payment request.');
  }

  // Must be the merchant's real NCBA virtual account (or its bare
  // ncbaMerchantCode pre-go-live), NOT paybillAccount (a separate 5-char
  // Daraja-era sub-account number, same conflation bug fixed everywhere
  // else in this file) — NCBA's account-notification webhook attributes
  // incoming money back to a merchant by regex-matching this code inside
  // the Narrative/CustomerName text it sends (see extractMerchantCode in
  // utils/ncbaAccountNotificationValidators.js). Passing paybillAccount here
  // meant every STK collection landed unattributed — confirmed via a real
  // 5 KES UAT test that came back with `ncba_account_notification_unattributed`.
  const ncbaAccountNo = getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode) || merchant.ncbaMerchantCode;
  const { transactionId } = await ncbaInitiateStkPush({ phone, amount: checkoutTotal, accountNo: ncbaAccountNo });

  await STKRequest.create({
    merchantId,
    checkoutRequestId: transactionId,
    amount: checkoutTotal,
    phone,
    status: 'pending',
    ...extra,
  });

  pollAndResolveNcbaStkPush(transactionId, transactionId);

  return transactionId;
}

// Dynamic QR Code collection — same idea as initiateAndTrackNcbaStk above
// (fixed amount, PayChain's customer surcharge baked in via
// getCheckoutTotal before this is ever called), but the customer scans
// instead of receiving a push prompt. NCBA's QR API returns no transaction
// ID, so there's no poll loop to start here — resolution happens off the
// account-notification webhook once the resulting payment lands, matched
// by merchantId + amount (see ncbaAccountNotificationController.js).
// checkoutRequestId is a PayChain-generated reference rather than an
// NCBA-issued one, purely to satisfy STKRequest's existing unique key.
export async function generateNcbaQrCheckout({ merchantId, checkoutTotal, extra = {} }) {
  const merchant = await Merchant.findById(merchantId).select('ncbaMerchantCode');
  if (!merchant?.ncbaMerchantCode) {
    throw new Error('This merchant has no NCBA virtual account assigned yet — cannot process this payment request.');
  }

  const reference = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Narration carries the merchant's ncbaMerchantCode so the resulting
  // payment's Narrative can be attributed the same way any other NCBA
  // Virtual Account collection is — reuses extractMerchantCode unchanged.
  const { qrCodeDataUri } = await ncbaGenerateQrCode({ amount: checkoutTotal, narration: merchant.ncbaMerchantCode });

  await STKRequest.create({
    merchantId,
    checkoutRequestId: reference,
    amount: checkoutTotal,
    phone: null,
    channel: 'qr',
    status: 'pending',
    ...extra,
  });

  return { reference, qrCodeDataUri };
}

// @desc    Generate a Dynamic QR Code for a fixed amount on PayChain's NCBA
//          Till — customer scans in their own M-PESA app to pay. PayChain's
//          flat customer surcharge is baked into the amount encoded in the
//          QR, same as an STK Push checkout.
// @route   POST /api/callbacks/generate-qr
// @access  Private (merchant)
export const generateQrCheckout = async (req, res) => {
  try {
    const merchantId = req.merchant._id;
    const intAmount = Math.ceil(Number(req.body.amount));
    if (!Number.isFinite(intAmount) || intAmount <= 0) {
      return res.status(400).json({ error: 'A valid amount is required.' });
    }

    const checkoutTotal = getCheckoutTotal(intAmount);
    const { reference, qrCodeDataUri } = await generateNcbaQrCheckout({
      merchantId,
      checkoutTotal,
      extra: { baseAmount: intAmount, kind: 'qr' },
    });

    res.status(200).json({
      success: true,
      reference,
      amount: checkoutTotal,
      qrCodeDataUri,
      message: 'Show this QR code to your customer to scan and pay in M-PESA.',
    });
  } catch (error) {
    console.error('❌ QR Generate Error:', error.message);
    res.status(502).json({ error: 'Failed to generate QR code — please try again.' });
  }
};

// @desc    Generate an OPEN-AMOUNT, PayChain-branded QR for the merchant's
//          own checkout page — "my QR", a standing code (Wallet page,
//          MyAccounts per-row modal) rather than a one-time checkout. Links
//          to /pay/account/:code (PayAccountPage.jsx), which collects an
//          amount + the customer's own phone number and triggers a real STK
//          Push to their phone — the customer enters their M-PESA PIN
//          natively on their own device, never on this web page. No amount
//          is baked into the QR itself; the customer picks it after
//          scanning.
//          Used to encode NCBA's own Dynamic QR instead (Base64QrCode from
//          ncbaStkPushService.js#generateQrCode) — decoding a real one in
//          production showed it actually links to NCBA's own hosted
//          checkout (c2bportal.ncbagroup.com), not a native M-PESA prompt,
//          so there was no native-scan benefit being traded away by
//          switching to a self-hosted link — only the loss of "opens an
//          unfamiliar ncbagroup.com page" and "can't brand the QR".
// @route   GET /api/callbacks/account-qr
// @access  Private (merchant)
export const generateAccountQr = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('ncbaMerchantCode checkoutQrCodeDataUri');
    if (!merchant?.ncbaMerchantCode) {
      return res.status(400).json({ error: 'This merchant has no NCBA virtual account assigned yet.' });
    }
    // This QR's content never changes once ncbaMerchantCode is assigned, so
    // a cached copy is always still correct — skip re-rendering (QR encode
    // + logo compositing) on every page/modal load once one exists.
    if (merchant.checkoutQrCodeDataUri) {
      return res.status(200).json({ success: true, qrCodeDataUri: merchant.checkoutQrCodeDataUri });
    }
    const checkoutUrl = `${FRONTEND_URL}/pay/account/${merchant.ncbaMerchantCode}`;
    const qrCodeDataUri = await generateBrandedQrDataUri(checkoutUrl);
    if (!qrCodeDataUri) {
      return res.status(502).json({ error: 'Failed to generate QR code — please try again.' });
    }
    // $set via updateOne, not merchant.save() — the doc above was fetched
    // with a narrow .select(), and .save() would run full-document
    // validation against fields that were never loaded.
    await Merchant.updateOne({ _id: merchant._id }, { $set: { checkoutQrCodeDataUri: qrCodeDataUri } });
    res.status(200).json({ success: true, qrCodeDataUri });
  } catch (error) {
    console.error('❌ Account QR Generate Error:', error.message);
    res.status(502).json({ error: 'Failed to generate QR code — please try again.' });
  }
};

export const getSTKStatus = async (req, res) => {
  try {
    const { checkoutId } = req.params;
    // Scoped to the caller's own merchant account — without this, any
    // authenticated merchant who learns/guesses another merchant's
    // checkoutRequestId could poll their STK request status directly.
    const stkReq = await STKRequest.findOne({ checkoutRequestId: checkoutId, merchantId: req.merchant._id });
    if (!stkReq) return res.status(404).json({ error: 'Request not found' });

    res.status(200).json({ 
      status: stkReq.status, 
      resultDesc: stkReq.resultDesc 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching STK status' });
  }
};

// --- B2C (OUTBOUND PAYMENTS TO A PHONE NUMBER, VIA NCBA MOBILE B2W) ---

export const initiateB2C = async (req, res) => {
  let debited = false;
  let totalDebit = 0;
  try {
    const { amount, destination, pin } = req.body;
    const merchantId = req.merchant._id;
    const provider = req.body.provider === 'airtel' ? 'airtel' : 'safaricom';

    // Validated/normalised to 254XXXXXXXXX before it ever reaches a payment
    // provider, gets stored as Transaction.recipient.id, or is used as an
    // SMS destination — previously this field went straight through
    // unvalidated, unlike every other money-movement destination in this
    // codebase (see ncbaValidators.js's own doc comment on this exact
    // function).
    let phone;
    try {
      phone = validatePhoneNumber(req.body.phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
      throw e;
    }

    // Standard Safaricom M-Pesa B2C ("Business Bouquet") tariff — NCBA
    // hasn't published a real Mobile B2W cost schedule, so this figure is
    // inherited from the Daraja era as a placeholder (see
    // config/mpesaB2cTariffCard.js and revenueRateCard.js's
    // ncba_mobile_b2w_fee stream), plus PayChain's own tiered Mobile
    // Withdrawal service fee (calculateB2cServiceFee), both deducted from
    // the merchant alongside the withdrawal principal.
    let b2cFee;
    try {
      ({ totalFee: b2cFee } = getB2cTariff(amount));
    } catch (e) {
      if (e instanceof B2cTariffBoundsError) return res.status(400).json({ error: e.message });
      throw e;
    }

    // Fail fast on a number NCBA doesn't recognize as a real M-Pesa/Airtel
    // wallet before ever touching the merchant's balance or asking for
    // their PIN — same ordering as initiateB2B's Paybill/Till check below.
    // Previously this validated only after the PIN check and the debit,
    // which meant an invalid destination still cost the merchant a PIN
    // entry and a debit-then-refund round trip for no reason.
    let validationId;
    try {
      ({ validationId } = await ncbaValidateMobileWalletNumber({ provider, msisdn: phone }));
    } catch (e) {
      if (e instanceof NcbaOpenBankingValidationError) return res.status(400).json({ error: e.message });
      throw e;
    }

    if (!pin) {
      return res.status(400).json({ error: 'Payment PIN is required.' });
    }

    const merchantWithPin = await Merchant.findById(merchantId).select('+appPin');
    if (!merchantWithPin) return res.status(404).json({ error: 'Merchant not found' });
    if (!merchantWithPin.appPin) {
      return res.status(400).json({ error: 'Please set up your payment PIN first.' });
    }
    try {
      await assertPinNotLocked(merchantId);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }
    const pinMatches = await bcrypt.compare(String(pin), merchantWithPin.appPin);
    if (!pinMatches) {
      await recordFailedPinAttempt(merchantId);
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
    await resetPinAttempts(merchantId);

    // Correct PIN alone doesn't stop a double-click or a client retrying a
    // slow/timed-out request from submitting the exact same withdrawal
    // twice — reject an identical (merchant, phone, amount) submission
    // landing within a short window of the last one, before any balance
    // change happens.
    try {
      await claimPayoutSubmission(merchantId, ['b2c', phone, amount]);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }

    // Atomic conditional deduct — avoids two concurrent B2C requests both
    // passing a stale in-memory balance check and over-withdrawing. Amount
    // sent to NCBA stays the raw `amount` — the fee is PayChain's own
    // separate deduction, never sent to NCBA as part of the payout.
    totalDebit = Math.round((Number(amount) + b2cFee) * 100) / 100;
    const merchant = await Merchant.findOneAndUpdate(
      { _id: merchantId, kesBalance: { $gte: totalDebit } },
      { $inc: { kesBalance: -totalDebit } },
      { returnDocument: 'after' }
    );
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer, including the M-Pesa B2C charge' });
    }
    debited = true;

    // Mobile B2W payout via NCBA (or simulated — see
    // services/ncbaOpenBankingService.js's NCBA_OPENBANKING_LIVE_ENABLED gate).
    // validationId was already obtained above, before the PIN check/debit.
    const transactionId = `PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await ncbaSubmitMobileB2wPayment({
      transactionId,
      validationId,
      provider,
      amount,
      recipientNumber: phone,
      narration: `Withdrawal to ${destination}`,
    });

    // type: 'ncba_mobile_b2w' — see utils/feeCalculator.js for the matching
    // fee branch and ncbaOpenBankingController.js's handlePesaLinkCallback
    // for how this resolves from 'pending'.
    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
      type: 'ncba_mobile_b2w',
      amount: amount,
      kesAmount: amount,
      currency: 'KES',
      status: 'pending',
      reference: transactionId,
      sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
      recipient: { name: destination, id: phone },
      mobileNetwork: provider,
    });

    res.status(200).json({ success: true, message: 'Transfer initiated successfully', transaction: tx });

  } catch (error) {
    console.error('❌ B2C Transfer Error:', error.response?.data || error);
    // Refund the merchant only if the deduction actually happened — an
    // earlier failure (e.g. PIN check) never touched the balance. Refunds
    // the full totalDebit (amount + B2C fee), matching what was actually
    // reserved above.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    res.status(500).json({ error: error.response?.data?.errorMessage || error.message || 'Failed to initiate transfer' });
  }
};

// @desc    Merchant-initiated single payout to another business's Paybill or
//          Till number, via NCBA's Lipa na M-Pesa Payment API — NCBA's
//          replacement for Safaricom's Daraja B2B (BusinessPayBill/
//          BusinessBuyGoods). Async: NCBA only confirms acceptance here —
//          actual settlement is confirmed later via handlePesaLinkCallback
//          (ncbaOpenBankingController.js), the same generic webhook that
//          resolves NCBA's other async payout rails (see
//          submitLipaNaMpesaPayment's doc comment for why this is treated
//          as async rather than synchronous like PesaLink).
// @route   POST /api/callbacks/b2b-request
// @access  Private (merchant)
export const initiateB2B = async (req, res) => {
  let debited = false;
  let totalDebit = 0;
  try {
    const { billType, partyB, accountReference, amount, reference, pin } = req.body;
    const merchantId = req.merchant._id;

    if (billType !== 'paybill' && billType !== 'till') {
      return res.status(400).json({ error: 'billType must be "paybill" or "till".' });
    }
    if (!partyB) {
      return res.status(400).json({ error: `${billType === 'paybill' ? 'Paybill' : 'Till'} number is required.` });
    }
    if (billType === 'paybill' && !accountReference) {
      return res.status(400).json({ error: 'Account number is required for a Paybill payment.' });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'A valid amount is required.' });
    }

    // Fail fast on a bad destination before ever touching the merchant's
    // balance or asking for their PIN. The merchant's Till/Paybill selection
    // is only a starting guess — NCBA checks each against a separate
    // Safaricom registry, so ncbaValidateLnmAccount silently retries under
    // the other type on rejection and returns whichever one actually
    // resolved. Everything downstream uses that resolved type, not the
    // merchant's original selection.
    let destination;
    try {
      destination = await ncbaValidateLnmAccount({ paymentType: billType === 'paybill' ? 'Paybill' : 'Till', payBillTillNo: partyB });
    } catch (e) {
      if (e instanceof NcbaOpenBankingValidationError) return res.status(400).json({ error: e.message });
      throw e;
    }
    const paymentType = destination.paymentType;

    // B2B PayBill & Till Payout Tariff (config/lipaNaMpesaTariffCard.js) —
    // tiered third-party base cost + PayChain service fee. Sourced from the
    // same tariff the Transaction pre-save hook's fee calculator reads
    // (utils/feeCalculator.js), so the debit and the persisted paychainFee
    // can never disagree.
    const { totalFee: fee } = getLipaNaMpesaTariff(numericAmount);

    if (!pin) {
      return res.status(400).json({ error: 'Payment PIN is required.' });
    }

    const merchantWithPin = await Merchant.findById(merchantId).select('+appPin');
    if (!merchantWithPin) return res.status(404).json({ error: 'Merchant not found' });
    if (!merchantWithPin.appPin) {
      return res.status(400).json({ error: 'Please set up your payment PIN first.' });
    }
    try {
      await assertPinNotLocked(merchantId);
    } catch (e) {
      if (e instanceof PinLockedError) return res.status(429).json({ error: e.message });
      throw e;
    }
    const pinMatches = await bcrypt.compare(String(pin), merchantWithPin.appPin);
    if (!pinMatches) {
      await recordFailedPinAttempt(merchantId);
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
    await resetPinAttempts(merchantId);

    // Same double-submission guard as initiateB2C above.
    try {
      await claimPayoutSubmission(merchantId, ['b2b', billType, partyB, accountReference, numericAmount]);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }

    // Atomic conditional deduct — same race-avoidance as initiateB2C.
    totalDebit = Math.round((numericAmount + fee) * 100) / 100;
    const merchant = await Merchant.findOneAndUpdate(
      { _id: merchantId, kesBalance: { $gte: totalDebit } },
      { $inc: { kesBalance: -totalDebit } },
      { returnDocument: 'after' }
    );
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer, including the PayChain service fee.' });
    }
    debited = true;

    const recipientName = destination.organizationName || reference || `${paymentType} ${partyB}`;
    const transactionId = `PAYOUT-B2B-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Throws (caught by the outer catch below, which refunds) if NCBA
    // rejects the instruction outright.
    await ncbaSubmitLnmPayment({
      transactionId,
      paymentType,
      payBillTillNo: partyB,
      amount: numericAmount,
      accountReference: paymentType === 'Paybill' ? accountReference : undefined,
      recipientName,
      notifyMobileNumber: merchant.phone,
      narration: reference || `Payout to ${partyB}`,
    });

    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
      type: 'ncba_lipa_na_mpesa',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      status: 'pending', // resolved asynchronously via handlePesaLinkCallback
      reference: transactionId,
      sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
      recipient: { name: recipientName, id: partyB },
    });

    res.status(200).json({ success: true, message: 'Transfer initiated successfully', transaction: tx });

  } catch (error) {
    console.error('❌ B2B Transfer Error:', error.response?.data || error);
    // Refund the merchant only if the deduction actually happened.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    res.status(500).json({ error: error.message || 'Failed to initiate transfer' });
  }
};
