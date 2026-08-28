import bcrypt from 'bcryptjs';
import { serverError } from '../utils/serverError.js';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, sendStaggeredSms, formatKes } from '../utils/smsSanitizer.js';
import { processSplitTransaction, processInvoiceSplitTransaction, splitCustomerSurcharge, getCheckoutTotal, PricingEngineError } from '../utils/pricingEngine.js';
import { sendInvoicePaidReceiptEmail } from '../utils/resend.js';
import { computeTotals } from './invoiceController.js';
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
import { buildPaymentReceivedSms, buildCustomerPaidSms, buildPaymentRequestSms, buildPayoutSentSms, buildPayoutRecipientReceivedSms, buildWalletTopUpSms } from '../utils/paymentSmsTemplates.js';
import { initiateStkPush as ncbaInitiateStkPush, queryStkPush as ncbaQueryStkPush, generateQrCode as ncbaGenerateQrCode } from '../services/ncbaStkPushService.js';
import { submitMobileB2wPayment as ncbaSubmitMobileB2wPayment, submitLipaNaMpesaPayment as ncbaSubmitLnmPayment, NcbaOpenBankingRequestError } from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber, NcbaValidationError, getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';
import { isLipaNaMpesaBetaMerchant, LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE } from '../config/lipaNaMpesaBetaAllowlist.js';
import { generateBrandedQrDataUri } from '../utils/qrCode.js';
import DeveloperPayment from '../models/DeveloperPayment.js';
import { publicDeveloperPayment } from '../utils/developerPaymentView.js';
import { dispatchDeveloperEvent } from '../services/webhookDeliveryService.js';
import { wasAlreadyCreditedByOtherNcbaFeed } from '../services/ncbaLedgerService.js';
import { debitAvailableBalance } from '../utils/availableBalance.js';

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

    // Same double-submission guard used by every payout endpoint — a
    // double-click or a client retry (previously also provoked by the STK
    // "failed" false-negative this function used to produce even after a
    // real send, since a merchant naturally retries what looks like a
    // failure) sending the exact same STK Push twice within a few seconds
    // otherwise means the customer gets prompted, and possibly pays, twice
    // for one intended payment.
    try {
      await claimPayoutSubmission(merchantId, ['stk-push', formattedPhone, intAmount, kind]);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }

    // Only one STK Push in flight per merchant at a time, regardless of
    // amount/phone/kind — the double-submission guard above only catches an
    // exact repeat; two DIFFERENT concurrent pushes (e.g. two rapid clicks
    // that raced past the guard with a slightly different amount, or two
    // Request Money prompts fired close together) are a separate way to end
    // up with more than one real charge/credit in flight, which is exactly
    // the shape of bug that caused the 2026-08-27 STK double-credit
    // incident. A merchant with a still-unanswered prompt must wait for it
    // to resolve (succeed, fail, or time out — at most ~2 minutes, see
    // NCBA_STK_POLL_MAX_ATTEMPTS below) before sending another. Scoped to
    // channel:'stk' only — Dynamic QR requests (channel:'qr') have no
    // "prompt in flight" concept to conflict with, they just sit waiting to
    // be scanned.
    const alreadyPending = await STKRequest.findOne({ merchantId, channel: 'stk', status: 'pending' });
    if (alreadyPending) {
      return res.status(409).json({ error: 'You already have a payment prompt waiting for a response. Please wait for it to complete (or time out, within about 2 minutes) before sending another.' });
    }

    // Request Money is the one STK flow where the customer never lands on
    // any PayChain page first — Payment Links / Pay Account already show
    // the fee breakdown on-screen before the customer submits, but here the
    // M-PESA prompt (fixed Safaricom template, total only, no free-text
    // field) is their very first and only signal. Without this, a merchant
    // requesting KES 100 has their customer see a prompt for KES 113 with
    // no explanation — reads as an overcharge.
    //
    // Fired here, before the STK push call below, but deliberately NOT
    // awaited — safeSendSMS funnels through utils/sms.js's shared, app-wide
    // send queue (a strict 2s minimum gap between ANY two SMS dispatches,
    // to avoid Africa's Talking rate-limiting — see that file's doc
    // comment), which can be arbitrarily backed up by unrelated traffic
    // (other merchants' transactions, a broadcast). Awaiting it here used
    // to make the actual M-PESA prompt wait behind that same backlog before
    // NCBA was ever even asked to send it — the prompt is the time-critical
    // side of this pair (the customer is staring at their phone for it), so
    // it must never be delayed by SMS delivery. This still kicks the SMS
    // off first, in the same tick, so it's queued ahead of the prompt
    // whenever there's no backlog — just without blocking on it.
    if (kind === 'request_money') {
      safeSendSMS({
        to: formattedPhone,
        message: buildPaymentRequestSms({
          businessName: req.merchant.businessName,
          baseAmount: intAmount,
          fee: Math.round((checkoutTotal - intAmount) * 100) / 100,
        }).message,
      }).then((result) => {
        if (!result.success) console.error(`Pre-push request SMS failed for ${formattedPhone}:`, result.error);
      });
    }

    // Real STK Push via NCBA's shared Paybill 880100 (or simulated — see
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
export async function resolveStkOutcome(stkReq, { succeeded, receipt, resultDesc, transTime, allowFailedRetry = false }) {
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
  //
  // allowFailedRetry widens that filter to also match an existing 'failed'
  // row — the one deliberate exception, used only by the NCBA account-
  // notification/reconciliation webhooks to correct a false failure: NCBA's
  // STK Query endpoint can report FAILED for a transaction that was still
  // genuinely in flight (see TRANSIENT_FAILURE_PATTERN below), and once
  // pollAndResolveNcbaStkPush gives up after REQUIRED_CONSECUTIVE_FAILURES,
  // nothing polls again — so if the customer's PIN entry actually succeeds
  // moments later, the only remaining signal is NCBA's own webhook telling
  // us the money landed. Callers must only ever pass this alongside
  // succeeded:true — there is no legitimate case for a confirmed 'success'
  // to later flip back to 'failed' on a webhook replay.
  const claimed = await STKRequest.findOneAndUpdate(
    { _id: stkReq._id, status: allowFailedRetry ? { $in: ['pending', 'failed'] } : 'pending' },
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
      // Mirrors ncbaAccountNotificationController.js's wasAlreadySettledByStkPush
      // check, but in the opposite direction. That check only catches the
      // case where THIS poll resolves first and the webhook arrives second
      // (STKRequest.status is already 'success' by the time the webhook
      // looks). It does nothing for the reverse order — the generic
      // account-notification webhook seeing the same NCBA credit BEFORE
      // this poll loop's own queryStkPush call reports SUCCESS, crediting
      // the merchant via creditNcbaCollection while STKRequest.status is
      // still 'pending' (so the atomic claim above wins normally, sees no
      // conflict, and this function would otherwise credit the exact same
      // payment a second time — a real double credit, not just a display
      // duplicate: two Transaction rows and two real $inc's to kesBalance).
      // wasAlreadyCreditedByOtherNcbaFeed is the same "same amount, recent
      // window, different reference" check the webhook uses for its own
      // cross-feed race; reused symmetrically here closes the gap in this
      // direction too.
      const alreadyCredited = await wasAlreadyCreditedByOtherNcbaFeed(
        { _id: stkReq.merchantId },
        stkReq.amount,
        receipt
      );
      if (alreadyCredited) {
        console.warn(`⚠️ STK ${stkReq.checkoutRequestId} (receipt ${receipt}) already credited via the NCBA account-notification feed — skipping duplicate credit.`);
        return;
      }

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
            // Only invoices created via the Developer API (developerInvoiceController.js)
            // carry createdViaDeveloperId — a dashboard-created invoice has
            // no developer to notify, so this is a no-op for those.
            if (paidInvoice?.createdViaDeveloperId) {
              dispatchDeveloperEvent(paidInvoice.createdViaDeveloperId, 'invoice.paid', {
                invoice: { id: paidInvoice._id, invoiceNumber: paidInvoice.invoiceNumber, status: paidInvoice.status, paidAt: paidInvoice.paidAt },
              });
            }
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
              const { subtotal: paidSubtotal, total: paidTotal } = computeTotals(paidInvoice.items);
              sendInvoicePaidReceiptEmail({
                to: merchant.email,
                businessName: merchant.businessName,
                invoiceNumber: paidInvoice.invoiceNumber,
                customerName: paidInvoice.customer?.name || 'Customer',
                items: paidInvoice.items,
                currency: paidInvoice.currency,
                subtotal: paidSubtotal,
                total: paidTotal,
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
            // merchant's full 12-digit NCBA virtual account number (never
            // the bare 8-digit ncbaMerchantCode — a customer paying that
            // truncated number back into M-Pesa/NCBA directly would send it
            // to the wrong place), else the raw payment-link id as a last
            // resort.
            const payerLabel = link.invoiceId ? 'invoice' : 'payment link';
            const accountRef = paidInvoice?.invoiceNumber
              || getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode)
              || merchant.ncbaMerchantCode
              || stkReq.linkId;
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
                  fee: customerFee,
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

          // Self-funding — the merchant paying into their own wallet —
          // isn't only kind==='topup' (the dedicated Fund Account modal).
          // It also happens through the open "Pay Account"/Settlement QR
          // link (kind==='pay_account') whenever the merchant uses their
          // own link/QR to top up, and through Request Money if a merchant
          // tests their own request-money prompt (kind==='request_money').
          // Neither of those carries a distinct kind, so the only reliable
          // signal is the payer's number matching the merchant's own — this
          // used to be assumed equivalent to kind==='topup' (see the SMS
          // skip below), which isn't true for the QR/link case, and
          // produced a "you have received a payment from [your own number]"
          // SMS for what was really just a deposit. Computed before the
          // Transaction below (not after, like before) so it can also
          // decide `type`: 'top_up' is a merchant depositing their own
          // money; a real customer paying via Request Money/QR/Pay Account
          // is 'inbound', the same type every other customer-paid-merchant
          // flow in this file uses (see the PaymentLink branch above) —
          // it was previously hardcoded to 'top_up' for all three, which
          // miscategorized every customer STK payment as a merchant deposit.
          const isSelfFunding = kind === 'topup' || (merchant.phone && stkReq.phone && merchant.phone === stkReq.phone);

          const transaction = await Transaction.create({
            merchantId: merchant._id,
            accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
            type: isSelfFunding ? 'top_up' : 'inbound',
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
            title: isSelfFunding ? 'Wallet topped up' : 'Payment received',
            message: isSelfFunding
              ? `KES ${merchantCredit.toLocaleString()} was added to your balance via M-PESA.`
              : `KES ${merchantCredit.toLocaleString()} was received via M-PESA.`,
          });

          // Self-funding — no separate "customer" to name — keeps a plain
          // wallet-top-up/deposit message. A real customer paying uses the
          // same professional "payment received" format as every other
          // collection rail.
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
              message: isSelfFunding
                ? buildWalletTopUpSms({
                    ref: receipt,
                    amount: merchantCredit,
                    date,
                    time,
                    balance: updatedMerchant.kesBalance || 0,
                  }).message
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
          // Self-funding skips this (the deposit SMS above already IS their
          // confirmation — a second copy would be redundant, not useful).
          if (!isSelfFunding && stkReq.phone) {
            topupSends.push({
              to: stkReq.phone,
              message: buildCustomerPaidSms({
                ref: receipt,
                amount: stkReq.amount,
                businessName: merchant.businessName,
                // Full 12-digit virtual account number, not the bare
                // 8-digit ncbaMerchantCode — see the identical fix/comment
                // on the Payment Link branch above.
                accountRef: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode) || merchant.ncbaMerchantCode,
                date,
                time,
                fee: customerFee,
              }).message,
            });
          }

          sendStaggeredSms(topupSends).then((results) => {
            let idx = 0;
            if (merchant.phone) {
              const r = results[idx++];
              if (!r.success) console.error(`Wallet top-up SMS failed for merchant ${merchant._id}:`, r.error);
            }
            if (!isSelfFunding && stkReq.phone) {
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
const NCBA_STK_POLL_INTERVAL_MS = 2000;
const NCBA_STK_POLL_MAX_ATTEMPTS = 60; // ~2 minutes — typical STK prompt validity window, unchanged

// Observed live, repeatedly, with different wording each time: NCBA's query
// endpoint can return status:'FAILED' with a generic/unrecognized
// description for a transaction that's still genuinely in flight — the
// customer hasn't answered the prompt yet — not an actual decline.
// Resolving on that prematurely marked real, still-pending payments as
// failed and stopped polling before the customer's later real SUCCESS could
// ever be seen — a "Request Failed" the merchant would read as "the
// customer cancelled", when nothing of the sort happened.
//
// Blocklisting the specific transient phrasings we'd seen ("processing",
// "internal error", etc.) turned out not to be safe — NCBA sends *other*
// wording for the same still-in-flight case too, and every phrasing not on
// the blocklist fell straight through as a confirmed decline. Flipped to an
// allowlist instead: a FAILED response is only ever treated as a genuine
// decline if its wording actually matches a real, customer-caused reason
// (cancelled/rejected the prompt, wrong PIN, insufficient funds). Anything
// else — including wording never seen before — is treated as still-pending
// and just keeps polling. If it never legitimately resolves, the
// NCBA_STK_POLL_MAX_ATTEMPTS timeout branch below still closes it out
// honestly ("timed out waiting for a response") instead of asserting a
// decline that may never have happened.
const KNOWN_DECLINE_PATTERN = /cancel|reject|declin|insufficient|wrong pin|incorrect pin|invalid pin|wrong password|incorrect password/i;
const REQUIRED_CONSECUTIVE_FAILURES = 2;

// Extra safety margin on top of the wording allowlist above: even a
// response that DOES match a known-decline phrasing is never honored as
// final within this many polls of the prompt being sent — a customer needs
// realistic time to even see the prompt, let alone decline it, so anything
// this early is far more likely a race/misreport than a real answer.
const MIN_ATTEMPTS_BEFORE_FAILURE = 5; // 5 * NCBA_STK_POLL_INTERVAL_MS = 10s

// Fire-and-forget: intentionally not awaited by callers, mirroring how every
// other webhook-driven settlement in this codebase (Daraja's own callbacks,
// the NCBA reconciliation webhooks) never blocks the HTTP response that
// triggered it on the eventual settlement.
export function pollAndResolveNcbaStkPush(checkoutRequestId, transactionId) {
  let attempts = 0;
  let consecutiveFailures = 0;
  // Last FAILED description seen that wasn't credible enough to resolve on
  // its own (see isCredibleDecline below) — kept so the eventual timeout
  // resolution (if it comes to that) can say what NCBA actually reported
  // instead of a generic "customer didn't respond", which is misleading
  // when NCBA's own message was e.g. "Error Occurred while sending push
  // request" (the prompt never reached the phone at all) rather than a
  // real non-response.
  let lastUnresolvedFailureDescription = null;

  const poll = async () => {
    attempts += 1;
    try {
      const { status, description } = await ncbaQueryStkPush({ transactionId });

      if (status === 'SUCCESS') {
        const stkReq = await STKRequest.findOne({ checkoutRequestId });
        if (!stkReq) {
          console.warn('⚠️ NCBA STK poll resolved for unknown request:', checkoutRequestId);
          return;
        }
        await resolveStkOutcome(stkReq, { succeeded: true, receipt: transactionId, resultDesc: description || status });
        return;
      }

      if (status === 'FAILED') {
        const isCredibleDecline = KNOWN_DECLINE_PATTERN.test(description || '') && attempts >= MIN_ATTEMPTS_BEFORE_FAILURE;
        consecutiveFailures = isCredibleDecline ? consecutiveFailures + 1 : 0;
        if (consecutiveFailures < REQUIRED_CONSECUTIVE_FAILURES) {
          // Not logged as an error — see doc comment above, this is the
          // expected transient/unrecognized shape, not a real problem yet.
          console.log(`ℹ️ NCBA STK query reported FAILED for ${checkoutRequestId} (attempt ${attempts}, confirmed declines ${consecutiveFailures}/${REQUIRED_CONSECUTIVE_FAILURES}) — not treating as final:`, description);
          if (description) lastUnresolvedFailureDescription = description;
        } else {
          const stkReq = await STKRequest.findOne({ checkoutRequestId });
          if (!stkReq) {
            console.warn('⚠️ NCBA STK poll resolved for unknown request:', checkoutRequestId);
            return;
          }
          await resolveStkOutcome(stkReq, { succeeded: false, receipt: transactionId, resultDesc: description || status });
          return;
        }
      } else {
        consecutiveFailures = 0; // a genuine PENDING response clears any prior tentative decline count
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
        // resultDesc flows verbatim into merchant/customer-facing UI (see
        // FundAccountModal.jsx, PaymentPage.jsx, RequestMoney.jsx, etc.), so
        // this stays plain-language rather than naming NCBA or echoing its
        // raw wording — the full diagnostic detail is already in the
        // "not treating as final" log line above for anyone debugging.
        // If NCBA never once reported FAILED, this is a genuine no-response
        // timeout; if it did (just never credibly enough to resolve early —
        // see isCredibleDecline above), the real cause was a delivery
        // failure, not the customer ignoring a prompt they may never have
        // received.
        const resultDesc = lastUnresolvedFailureDescription
          ? 'The payment prompt could not be delivered — please try again.'
          : 'Timed out waiting for customer response';
        await resolveStkOutcome(stkReq, {
          succeeded: false,
          receipt: transactionId,
          resultDesc,
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

  // Past this point, NCBA has already sent the real prompt to the
  // customer's phone — a failure below is a local bookkeeping problem, not
  // a failed push, and must never be reported to the merchant as "failed to
  // send" (initiateSTKPush's caller would otherwise show a false failure on
  // a push that actually went out, and the customer may already be paying).
  // Best-effort: if the tracking record can't be created, there's no poll
  // loop watching this payment, but it still resolves correctly once it
  // lands — ncbaAccountNotificationController.js's generic credit path
  // doesn't require an STKRequest to exist, it just falls through to a
  // plain NCBA collection credit instead of the STK-aware dual-sided split.
  try {
    await STKRequest.create({
      merchantId,
      checkoutRequestId: transactionId,
      amount: checkoutTotal,
      phone,
      status: 'pending',
      ...extra,
    });
    pollAndResolveNcbaStkPush(transactionId, transactionId);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'ncba_stk_push_sent_but_tracking_failed',
      message: 'NCBA accepted and sent a real STK Push, but the local STKRequest tracking record failed to save — no poll loop will run for this one. It will still settle via the account-notification webhook\'s generic credit path once paid, just without the STK-aware fee split. Verify manually if in doubt.',
      merchantId: String(merchantId),
      transactionId,
      amount: checkoutTotal,
      error: err.message,
    }));
  }

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
  // Set once ncbaSubmitMobileB2wPayment has actually confirmed the payout —
  // from that point on, a later local failure (e.g. Transaction.create
  // throwing) must NOT trigger the catch block's refund below, since the
  // money has already genuinely left for the recipient. Carries the fields
  // needed for a best-effort Transaction record + loud alert in that case,
  // since transactionId/merchant/etc are otherwise scoped to the try block.
  let ncbaConfirmedContext = null;
  try {
    const { amount, destination, reference, pin } = req.body;
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
    // debitAvailableBalance also holds back money credited in the last 2
    // minutes (see utils/availableBalance.js) so a bad/duplicate credit
    // can't be withdrawn before it's had a chance to be caught.
    totalDebit = Math.round((Number(amount) + b2cFee) * 100) / 100;
    const merchant = await debitAvailableBalance(merchantId, totalDebit);
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient available KES balance for this transfer, including the M-Pesa B2C charge — a recent credit may still be briefly held.' });
    }
    debited = true;

    // Mobile B2W payout via NCBA (or simulated — see
    // services/ncbaOpenBankingService.js's NCBA_OPENBANKING_LIVE_ENABLED gate).
    // No pre-payout wallet-number validation — NCBA's MobileB2WValidation
    // service isn't live yet and was blocking every payout.
    const transactionId = `PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    // `destination` is a UI category label ("Primary M-PESA Number"/"Any
    // M-PESA Number"), not a person's name — reference (if the merchant
    // typed one) is the actual name NCBA's beneficiaryName field wants,
    // same as the Bank branch already sends it as accountName.
    const beneficiaryName = reference || destination;
    try {
      await ncbaSubmitMobileB2wPayment({
        transactionId,
        beneficiaryName,
        amount,
        recipientNumber: phone,
        narration: `Withdrawal to ${destination}`,
      });
    } catch (ncbaErr) {
      // NcbaOpenBankingRequestError means NCBA actually received and
      // processed the request — this is not the same as the request never
      // reaching NCBA. A live test (2026-08-26) confirmed NCBA can accept
      // and complete a transfer (recipient paid) while returning a
      // response this integration couldn't confidently read as success —
      // refunding the merchant here on top of that would double-cost
      // PayChain (real payout + refund) with zero record of what
      // happened. Recorded as 'pending' instead of refunded so there's a
      // paper trail, resolved later like every other async rail's
      // uncertain case (webhook callback, or the reconciliation sweep in
      // ncbaOpenBankingReconciliationService.js) rather than assumed
      // failed here.
      if (ncbaErr instanceof NcbaOpenBankingRequestError) {
        const tx = await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
          type: 'ncba_mobile_b2w',
          amount: amount,
          kesAmount: amount,
          currency: 'KES',
          status: 'pending',
          // A clear "insufficient funds" rejection means nothing moved —
          // safe for ncbaPayoutRetryService.js to actively resubmit later.
          // Anything else stays 'ambiguous_response' (unchanged behaviour):
          // never auto-retried, only ever resolved by a real callback or
          // the stuck-payout reconciliation sweep.
          pendingReason: ncbaErr.isInsufficientFunds ? 'insufficient_funds' : 'ambiguous_response',
          retryPayload: ncbaErr.isInsufficientFunds
            ? { rail: 'ncba_mobile_b2w', beneficiaryName, recipientNumber: phone, narration: `Withdrawal to ${destination}` }
            : null,
          reference: transactionId,
          sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
          recipient: { name: destination, id: phone },
          mobileNetwork: provider,
        });
        return res.status(202).json({
          success: true,
          pending: true,
          message: "We've submitted your transfer but couldn't immediately confirm the outcome with NCBA. We'll update this transaction shortly — please don't retry with the same details in the meantime.",
          transaction: tx,
        });
      }
      throw ncbaErr;
    }

    // Past this point NCBA has confirmed the transfer — nothing below may
    // trigger the catch block's refund anymore.
    ncbaConfirmedContext = {
      transactionId, merchantId: merchant._id, amount, destination, phone, provider,
      beneficiaryName, businessName: merchant.businessName, ncbaMerchantCode: merchant.ncbaMerchantCode,
    };

    // type: 'ncba_mobile_b2w' — status is 'completed', not 'pending':
    // reaching this line means submitMobileB2wPayment's broadened success
    // check actually confirmed the transfer (see that function's own doc
    // comment) — NCBA's documented "resolves later via callback" shape
    // has never actually been observed arriving for this rail in
    // practice, so a real success left 'pending' here would eventually
    // get auto-marked 'failed' and refunded by the reconciliation sweep
    // (ncbaOpenBankingReconciliationService.js) purely because no callback
    // ever came — the exact double-loss bug this rail already had once,
    // just delayed 20 minutes instead of immediate. See utils/feeCalculator.js
    // for the fee branch.
    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
      type: 'ncba_mobile_b2w',
      amount: amount,
      kesAmount: amount,
      currency: 'KES',
      status: 'completed',
      reference: transactionId,
      sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
      recipient: { name: destination, id: phone },
      mobileNetwork: provider,
    });

    // Fire-and-forget, matching bulkPayController.js's identical pattern —
    // never blocks the response on an SMS provider hiccup.
    const { date: txDate, time: txTime } = formatTransactionDateTime();
    if (merchant.phone) {
      const { message: merchantSmsMessage } = buildPayoutSentSms({
        ref: transactionId,
        label: 'Withdrawal',
        amount,
        recipientName: beneficiaryName,
        date: txDate,
        time: txTime,
        balance: merchant.kesBalance,
      });
      safeSendSMS({ to: merchant.phone, message: merchantSmsMessage }).then((result) => {
        if (!result.success) console.error(`B2C merchant SMS failed for merchant ${merchant._id}:`, result.error);
      });
    }
    const { message: recipientSmsMessage } = buildPayoutRecipientReceivedSms({
      ref: transactionId,
      amount,
      businessName: merchant.businessName,
      date: txDate,
      time: txTime,
    });
    safeSendSMS({ to: phone, message: recipientSmsMessage }).then((result) => {
      if (!result.success) console.error(`B2C recipient SMS failed for transaction ${transactionId}:`, result.error);
    });

    res.status(200).json({ success: true, message: 'Transfer initiated successfully', transaction: tx });

  } catch (error) {
    if (ncbaConfirmedContext) {
      // NCBA already confirmed this payout landed — refunding now would pay
      // the merchant back for money that genuinely left the pooled account,
      // a real, unrecovered loss. Never refund past this point; best-effort
      // record the completed Transaction (the thing that actually failed
      // above) so there's still a paper trail, and alert loudly either way
      // since this always needs a human to confirm nothing's missing.
      console.error(JSON.stringify({
        level: 'error',
        event: 'b2c_local_failure_after_ncba_confirmed',
        message: 'A B2C payout was confirmed by NCBA but a local step afterward failed — the merchant was NOT refunded (the transfer already happened). Verify a Transaction record exists for this reference; if not, one was reconstructed below on a best-effort basis.',
        ...ncbaConfirmedContext,
        merchantId: String(ncbaConfirmedContext.merchantId),
        error: error.message,
      }));
      try {
        await Transaction.findOneAndUpdate(
          { reference: ncbaConfirmedContext.transactionId },
          {
            $setOnInsert: {
              merchantId: ncbaConfirmedContext.merchantId,
              accountNumber: ncbaConfirmedContext.ncbaMerchantCode || 'WALLET_FUND',
              type: 'ncba_mobile_b2w',
              amount: ncbaConfirmedContext.amount,
              kesAmount: ncbaConfirmedContext.amount,
              currency: 'KES',
              status: 'completed',
              reference: ncbaConfirmedContext.transactionId,
              sender: { name: ncbaConfirmedContext.businessName, id: ncbaConfirmedContext.ncbaMerchantCode },
              recipient: { name: ncbaConfirmedContext.destination, id: ncbaConfirmedContext.phone },
              mobileNetwork: ncbaConfirmedContext.provider,
            },
          },
          { upsert: true }
        );
      } catch (reconcileErr) {
        console.error('❌ B2C post-confirmation Transaction reconstruction also failed — needs manual reconciliation:', reconcileErr.message);
      }
      return serverError(res, 500, 'Your transfer went through, but we hit an error recording it. Please check your transaction history shortly.', error, '❌ B2C Transfer Error (post-confirmation):');
    }

    // Refund the merchant only if the deduction actually happened — an
    // earlier failure (e.g. PIN check) never touched the balance. Refunds
    // the full totalDebit (amount + B2C fee), matching what was actually
    // reserved above. Only reached for errors before NCBA ever received
    // the request (validation, config, etc.) — see the NcbaOpenBankingRequestError
    // branch above for the case where NCBA did receive it.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    if (error.response?.data) console.error('❌ B2C Transfer Error (NCBA response):', error.response.data);
    serverError(res, 500, 'Failed to initiate transfer', error, '❌ B2C Transfer Error:');
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
  // Set once NCBA has accepted the submission — from that point on, a
  // local failure (e.g. Transaction.create throwing) must NOT refund the
  // merchant, since NCBA has already taken on the transfer. See the
  // matching comment in initiateB2C above for the full reasoning.
  let ncbaAcceptedContext = null;
  try {
    const { billType, partyB, accountReference, amount, reference, pin } = req.body;
    const merchantId = req.merchant._id;

    if (!isLipaNaMpesaBetaMerchant(merchantId)) {
      return res.status(403).json({ error: LIPA_NA_MPESA_NOT_AVAILABLE_MESSAGE });
    }

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

    // No pre-payout Paybill/Till validation — takes the merchant's own
    // billType selection as given rather than resolving it against NCBA.
    const paymentType = billType === 'paybill' ? 'Paybill' : 'Till';

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

    // Atomic conditional deduct — same race-avoidance as initiateB2C, also
    // holding back any still-unmatured recent credit (see
    // utils/availableBalance.js).
    totalDebit = Math.round((numericAmount + fee) * 100) / 100;
    const merchant = await debitAvailableBalance(merchantId, totalDebit);
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient available KES balance for this transfer, including the PayChain service fee — a recent credit may still be briefly held.' });
    }
    debited = true;

    const recipientName = reference || `${paymentType} ${partyB}`;
    // No hyphens — NCBA's Lipa na M-Pesa endpoint rejects reqChnlId/
    // reqTransactionReferenceNo values containing special characters (per
    // Rose, NCBA support, 2026-08-27).
    const transactionId = `PAYOUTB2B${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    // NCBA's Lipa na M-Pesa endpoint needs reqMobileNumber in 254XXXXXXXXX
    // form, not merchant.phone's stored 07XXXXXXXX (per Rose, NCBA support)
    // — every other NCBA Open Banking rail in this file already normalizes
    // its own msisdn field the same way; this one was the exception. Falls
    // back to the raw value on a malformed phone rather than blocking the
    // payout over a notification-only field.
    let notifyMobileNumber = merchant.phone;
    try { notifyMobileNumber = validatePhoneNumber(merchant.phone); } catch { /* left as raw */ }

    try {
      await ncbaSubmitLnmPayment({
        transactionId,
        paymentType,
        payBillTillNo: partyB,
        amount: numericAmount,
        accountReference: paymentType === 'Paybill' ? accountReference : undefined,
        recipientName,
        notifyMobileNumber,
        narration: reference || `Payout to ${partyB}`,
      });
    } catch (ncbaErr) {
      // Same reasoning as initiateB2C above: NcbaOpenBankingRequestError
      // means NCBA actually received the request and responded with a
      // rejection (e.g. "Insufficient Funds For Transaction") — but this
      // integration has already proven live that an NCBA rejection
      // response isn't a reliable signal the transfer never landed (see
      // submitMobileB2wPayment's doc comment). Refunding here on top of a
      // transfer NCBA actually processed would double-cost PayChain the
      // same way. Recorded 'pending' instead of refunded — 'ncba_lipa_na_mpesa'
      // is already covered by the reconciliation sweep
      // (ncbaOpenBankingReconciliationService.js), which refunds it for
      // real after STUCK_AFTER_MS only if no success callback ever arrives,
      // so a genuine rejection like insufficient funds still gets refunded,
      // just up to 20 minutes later instead of instantly.
      if (ncbaErr instanceof NcbaOpenBankingRequestError) {
        const tx = await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.ncbaMerchantCode || 'WALLET_FUND',
          type: 'ncba_lipa_na_mpesa',
          amount: numericAmount,
          kesAmount: numericAmount,
          currency: 'KES',
          status: 'pending',
          pendingReason: ncbaErr.isInsufficientFunds ? 'insufficient_funds' : 'ambiguous_response',
          retryPayload: ncbaErr.isInsufficientFunds
            ? {
                rail: 'ncba_lipa_na_mpesa',
                paymentType,
                payBillTillNo: partyB,
                accountReference: paymentType === 'Paybill' ? accountReference : undefined,
                recipientName,
                notifyMobileNumber,
                narration: reference || `Payout to ${partyB}`,
              }
            : null,
          reference: transactionId,
          sender: { name: merchant.businessName, id: merchant.ncbaMerchantCode },
          recipient: { name: recipientName, id: partyB },
        });
        return res.status(202).json({
          success: true,
          pending: true,
          message: "We've submitted your transfer but couldn't immediately confirm the outcome with NCBA. We'll update this transaction shortly — please don't retry with the same details in the meantime.",
          transaction: tx,
        });
      }
      throw ncbaErr;
    }

    // Past this point NCBA has accepted the submission — nothing below may
    // trigger the catch block's refund anymore.
    ncbaAcceptedContext = {
      transactionId, merchantId: merchant._id, amount: numericAmount,
      businessName: merchant.businessName, ncbaMerchantCode: merchant.ncbaMerchantCode,
      recipientName, partyB,
    };

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
    if (error.response?.data) console.error('❌ B2B Transfer Error (NCBA response):', error.response.data);

    if (ncbaAcceptedContext) {
      // NCBA already accepted this payout for processing — refunding now
      // risks a double-payment once it settles. Also, without a Transaction
      // row for this reference, handlePesaLinkCallback/the reconciliation
      // sweep would have nothing to resolve later — so best-effort create
      // the same 'pending' row the happy path would have, letting the
      // normal async resolution machinery (webhook or stuck-payout sweep)
      // decide the real outcome instead of guessing here.
      console.error(JSON.stringify({
        level: 'error',
        event: 'b2b_local_failure_after_ncba_accepted',
        message: 'A B2B payout was accepted by NCBA but a local step afterward failed — the merchant was NOT refunded. Verify a pending Transaction record exists for this reference.',
        ...ncbaAcceptedContext,
        merchantId: String(ncbaAcceptedContext.merchantId),
        error: error.message,
      }));
      try {
        await Transaction.findOneAndUpdate(
          { reference: ncbaAcceptedContext.transactionId },
          {
            $setOnInsert: {
              merchantId: ncbaAcceptedContext.merchantId,
              accountNumber: ncbaAcceptedContext.ncbaMerchantCode || 'WALLET_FUND',
              type: 'ncba_lipa_na_mpesa',
              amount: ncbaAcceptedContext.amount,
              kesAmount: ncbaAcceptedContext.amount,
              currency: 'KES',
              status: 'pending',
              reference: ncbaAcceptedContext.transactionId,
              sender: { name: ncbaAcceptedContext.businessName, id: ncbaAcceptedContext.ncbaMerchantCode },
              recipient: { name: ncbaAcceptedContext.recipientName, id: ncbaAcceptedContext.partyB },
            },
          },
          { upsert: true }
        );
      } catch (reconcileErr) {
        console.error('❌ B2B post-acceptance Transaction reconstruction also failed — needs manual reconciliation:', reconcileErr.message);
      }
      return serverError(res, 500, 'Your transfer was submitted, but we hit an error recording it. Please check your transaction history shortly.', error, '❌ B2B Transfer Error (post-acceptance):');
    }

    // Refund the merchant only if the deduction actually happened.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    serverError(res, 500, 'Failed to initiate transfer', error, '❌ B2B Transfer Error:');
  }
};
