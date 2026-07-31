import axios from 'axios';
import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, buildStrictSms } from '../utils/smsSanitizer.js';
import { calculateMerchantFee, processSplitTransaction, splitCustomerSurcharge, getCheckoutTotal, RAW_C2B_FLAT_MARKUP_KES, PricingEngineError } from '../utils/pricingEngine.js';
import { sendInvoicePaidReceiptEmail } from '../utils/resend.js';
import { settleInflationShield } from '../utils/stellarHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import STKRequest from '../models/STKRequest.js';
import PayoutBatch from '../models/PayoutBatch.js';
import PaymentLink from '../models/PaymentLink.js';
import Invoice from '../models/Invoice.js';
import { createNotification } from './notificationController.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { getB2cTariff, B2cTariffBoundsError } from '../config/mpesaB2cTariffCard.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { AUTO_INFLATION_SHIELD_ENABLED } from '../config/inflationShieldFlag.js';

// ── M-PESA configuration ──────────────────────────────────────────────────────
// MPESA_ENVIRONMENT controls which Daraja endpoint is used.
// Defaults to 'sandbox' — must be explicitly set to 'live' to reach production.
// Never derive this from NODE_ENV: hosting platforms set NODE_ENV='production'
// even for staging deployments, which would accidentally hit the live API.
const mpesaEnv      = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
// Exported so every M-PESA-calling code path in the app (not just this
// file) derives live/sandbox and the target Daraja host from the same
// single source of truth — a second, independently-computed copy of this
// logic elsewhere (e.g. keyed off NODE_ENV instead) is exactly how a
// token/endpoint mismatch bug happens: generateToken below fetches an
// OAuth token scoped to one Daraja host, and a caller using a different
// host for the actual API call gets rejected.
export const isLive        = mpesaEnv === 'live';
export const mpesaBaseUrl  = isLive
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

if (isLive) {
  console.log('⚠️  M-PESA running in LIVE mode — real money will move');
} else {
  console.log('🧪 M-PESA running in SANDBOX mode — no real money at risk');
}

const consumerKey     = process.env.MPESA_CONSUMER_KEY;
const consumerSecret  = process.env.MPESA_CONSUMER_SECRET;
export const shortCode = process.env.MPESA_SHORTCODE;
export const passkey   = process.env.MPESA_PASSKEY;
// Public URL Safaricom will POST callbacks to.
// Must be HTTPS and reachable by Safaricom servers.
export const callbackBase = (process.env.MPESA_CALLBACK_URL || '').replace(/\/$/, '');

// Appended to every callback URL handed to Safaricom — routes/mpesaRoutes.js
// rejects any callback that doesn't carry this in ?key=. Daraja has no
// native webhook signature, so a secret embedded in the URL itself is the
// standard practical substitute.
const webhookSecret = process.env.MPESA_WEBHOOK_SECRET || '';
const withWebhookSecret = (url) => `${url}${webhookSecret ? `?key=${encodeURIComponent(webhookSecret)}` : ''}`;


// Generate OAuth Token for Safaricom Daraja API
export const generateToken = async (req, res, next) => {
  if (!consumerKey || !consumerSecret) {
    console.error('❌ M-PESA credentials not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)');
    return res.status(500).json({ error: 'M-PESA is not configured on this server.' });
  }
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const url  = `${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`;

    const response = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000,
    });

    req.mpesaToken = response.data.access_token;
    next();
  } catch (error) {
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`❌ M-PESA Token Error [env=${mpesaEnv} url=${mpesaBaseUrl}]:`, detail);
    res.status(502).json({
      error: 'Failed to reach Safaricom — check your M-PESA credentials and MPESA_ENVIRONMENT setting.',
      detail,
    });
  }
};

// Register C2B URLs
export const registerURLs = async (req, res) => {
  try {
    const token = req.mpesaToken;
    const { validationUrl, confirmationUrl } = req.body;

    const url = `${mpesaBaseUrl}/mpesa/c2b/v1/registerurl`;

    const data = {
      ShortCode: shortCode,
      ResponseType: 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ M-PESA Register URLs Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to register M-PESA URLs' });
  }
};

// Validation Webhook (Safaricom hits this to check if transaction should proceed)
export const validationURL = (req, res) => {
  // We accept all transactions by returning ResultCode 0
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: 'Accepted'
  });
};

// Confirmation Webhook (Safaricom hits this when transaction completes)
export const confirmationURL = async (req, res) => {
  try {
    const payload = req.body;
    // Summary only, not the full payload — it carries customer MSISDN/name
    // (PII) which doesn't need to sit in plaintext stdout logs.
    console.log(`📥 M-PESA Confirmation: TransID=${payload?.TransID} Amount=${payload?.TransAmount} BillRef=${payload?.BillRefNumber}`);

    /*
      Expected Payload:
      {
        TransactionType: 'Pay Bill',
        TransID: 'SGH2D8X1P',
        TransTime: '20250622143000',
        TransAmount: '1000.00',
        BusinessShortCode: '400200',
        BillRefNumber: '84729',
        InvoiceNumber: '',
        OrgAccountBalance: '...',
        ThirdPartyTransID: '',
        MSISDN: '254700000000',
        FirstName: 'JOHN',
        MiddleName: 'DOE',
        LastName: ''
      }
    */

    const {
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      FirstName,
      MiddleName,
      LastName
    } = payload;

    // Acknowledge receipt to Safaricom immediately
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });

    const accountNumber = BillRefNumber?.trim();
    const amount = Number(TransAmount);
    
    if (!accountNumber) return;

    // Find the merchant by their unique Paybill Account number
    const merchant = await Merchant.findOne({ paybillAccount: accountNumber });

    if (!merchant) {
      console.warn(`⚠️ Received M-PESA payment for unknown account: ${accountNumber}`);
      return;
    }

    // Check if transaction already exists (idempotency)
    const existingTx = await Transaction.findOne({ reference: TransID });
    if (existingTx) {
      console.log(`⚠️ Transaction ${TransID} already processed.`);
      return;
    }

    // Combine names
    const senderName = [FirstName, MiddleName, LastName].filter(Boolean).join(' ');

    // Save the real transaction
    const transaction = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount,
      type: 'inbound',
      amount: amount,
      kesAmount: amount,
      currency: 'KES',
      status: 'completed',
      reference: TransID,
      sender: {
        name: senderName || 'M-PESA CUSTOMER',
        id: formatPhoneDisplay(MSISDN)
      },
      recipient: {
        name: merchant.businessName,
        id: merchant.paybillAccount
      }
    });

    // PayChain's own tiered merchant fee, plus a flat KES 5 markup on every
    // C2B paybill deposit (RAW_C2B_FLAT_MARKUP_KES — see pricingEngine.js)
    // — both deducted from the gross receipt before it ever reaches the
    // merchant's balance or the Inflation Shield FX conversion below.
    // Clamped so the combined fee never exceeds the gross amount itself.
    const tieredMerchantFee = calculateMerchantFee(amount);
    const merchantFee = Math.min(amount, Math.round((tieredMerchantFee + RAW_C2B_FLAT_MARKUP_KES) * 100) / 100);
    const netKESAmount = Math.round((amount - merchantFee) * 100) / 100;
    console.log(`💰 M-PESA C2B fee for ${TransID}: gross KES ${amount}, PayChain fee KES ${merchantFee} (tiered KES ${tieredMerchantFee} + flat KES ${RAW_C2B_FLAT_MARKUP_KES}), net KES ${netKESAmount}`);

    // The Transaction pre-save hook (utils/feeCalculator.js) only knows the
    // tiered portion (it calls calculateMerchantFee the same way, on the
    // same amount) — top up paychainFee with whatever's left of the flat
    // markup on top (normally the full RAW_C2B_FLAT_MARKUP_KES, less only
    // if the clamp above capped the total at the gross amount for a very
    // small deposit), so the persisted field always matches what was
    // actually deducted below, not just the tiered part.
    const flatMarkupApplied = Math.round((merchantFee - tieredMerchantFee) * 100) / 100;
    if (flatMarkupApplied > 0) {
      await Transaction.updateOne({ _id: transaction._id }, { $inc: { paychainFee: flatMarkupApplied } });
    }

    const { date, time } = formatTransactionDateTime(payload.TransTime);

    // Customer receipt SMS fired here, immediately after the base
    // Transaction record above — it only needs TransID/amount/name/account,
    // none of which depend on the balance credit or Inflation Shield
    // settlement below. Previously this was built after that settlement
    // block, so a slow/retrying Stellar submission delayed the customer's
    // receipt for no reason; sending it here means it goes out at the same
    // speed regardless of whether this merchant has a Stellar wallet.
    // Deliberately omits a "New M-PESA balance" line — that figure is the
    // *paying customer's own personal M-Pesa wallet balance*, which
    // Safaricom's C2B confirmation payload never includes (it belongs to
    // the other side of the transaction). Fabricating a number there would
    // be a real customer-facing correctness problem, not a cosmetic one.
    const customerSms = MSISDN
      ? safeSendSMS({
          to: MSISDN,
          // businessName is the only unbounded field here — never the
          // reference, amount, account number, date or time.
          message: buildStrictSms(
            ({ ref, amt, name, acct, date, time }) =>
              `${ref} Confirmed. KES ${amt} sent to ${name} for account ${acct} on ${date} at ${time}. Thank you for your payment.`,
            {
              fixed: { ref: TransID, amt: amount.toLocaleString(), acct: accountNumber, date, time },
              truncatable: [{ key: 'name', value: merchant.businessName, minLength: 10 }],
            }
          ).message,
        }).then((result) => {
          if (!result.success) console.error(`Customer SMS receipt failed for ${TransID}:`, result.error);
        })
      : Promise.resolve();

    // Live FX rate is only needed for the Inflation Shield conversion below
    // — fetched inside that branch now instead of unconditionally here, so
    // merchants without a Stellar wallet (the common case) never pay the
    // latency of an external exchangerate-api.com round trip (up to 5s on a
    // slow response) before their balance update and SMS.
    //
    // Atomic $inc rather than a read-modify-write on the in-memory `merchant`
    // doc — the gap between fetching `merchant` above and saving here spans
    // several awaits (getLiveKesToUsdcRate, settleInflationShield), during
    // which a concurrent webhook for the same merchant could read the same
    // stale balance and silently clobber it on save(). $inc is race-free
    // regardless of how long this branch takes.
    let updatedMerchant;
    if (merchant.stellarPublicKey && AUTO_INFLATION_SHIELD_ENABLED) {
      try {
        const liveRate = await getLiveKesToUsdcRate();
        const usdcPayoutValue = (netKESAmount * liveRate).toFixed(7);

        console.log(`🛡️ Executing Inflation Shield for Acc ${accountNumber}:`);
        console.log(`   - Gross M-Pesa KES: ${amount}`);
        console.log(`   - Live KES/USDC Rate (Fractional): ${liveRate}`);
        console.log(`   - Exact On-Chain Payout: ${usdcPayoutValue} USDC`);

        const txHash = await settleInflationShield(merchant.stellarPublicKey, usdcPayoutValue);

        // Log the blockchain settlement transaction
        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.paybillAccount,
          type: 'settlement',
          amount: parseFloat(usdcPayoutValue),
          kesAmount: netKESAmount,
          currency: 'USDC',
          status: 'completed',
          reference: txHash,
          sender: { name: 'PayChain Settlement', id: 'MASTER_WALLET' },
          recipient: { name: merchant.businessName, id: merchant.stellarPublicKey }
        });

        updatedMerchant = await Merchant.findByIdAndUpdate(
          merchant._id,
          { $inc: { usdcBalance: parseFloat(usdcPayoutValue) } },
          { returnDocument: 'after' }
        );

      } catch (e) {
        console.error(`❌ Inflation Shield failed for ${accountNumber}:`, e.message);
        // If settlement fails, funds remain as KES balance
        updatedMerchant = await Merchant.findByIdAndUpdate(
          merchant._id,
          { $inc: { kesBalance: netKESAmount } },
          { returnDocument: 'after' }
        );
      }
    } else {
      // If no Stellar wallet, just add to KES balance
      updatedMerchant = await Merchant.findByIdAndUpdate(
        merchant._id,
        { $inc: { kesBalance: netKESAmount } },
        { returnDocument: 'after' }
      );
    }

    console.log(`✅ Successfully processed M-PESA payment of KES ${amount} for account ${accountNumber}`);

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${amount.toLocaleString()} from ${senderName || 'a customer'} via your PayChain Account Number ${merchant.paybillAccount}.`,
    });

    // Merchant transaction alert SMS — new balance here IS real data we
    // hold (updatedMerchant.kesBalance from the atomic $inc above).
    const merchantSms = merchant.phone
      ? safeSendSMS({
          to: merchant.phone,
          // The payer's own display name is the only unbounded field here.
          message: buildStrictSms(
            ({ ref, amt, name, phone, date, time, balance }) =>
              `${ref} Payment Received. KES ${amt} received from ${name} (${phone}) on ${date} at ${time}. Your updated PayChain available balance is KES ${balance}.`,
            {
              fixed: { ref: TransID, amt: amount.toLocaleString(), phone: formatPhoneDisplay(MSISDN), date, time, balance: (updatedMerchant.kesBalance || 0).toLocaleString() },
              truncatable: [{ key: 'name', value: senderName || 'a customer', minLength: 10 }],
            }
          ).message,
        }).then((result) => {
          if (!result.success) console.error(`Merchant SMS alert failed for ${merchant._id}:`, result.error);
        })
      : Promise.resolve();

    // Both dispatches never throw (see utils/sms.js) — awaited together
    // purely so both attempts fire before this handler returns, not because
    // a delivery failure here could ever affect the response already sent
    // to Safaricom above.
    await Promise.all([customerSms, merchantSms]);

  } catch (error) {
    console.error('❌ M-PESA Confirmation Webhook Error:', error);
    // Safaricom expects a 200 even if internal processing fails to avoid retries
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal Failure' });
  }
};

// ================= STK PUSH (LIPA NA M-PESA ONLINE) =================

export const initiateSTKPush = async (req, res) => {
  try {
    const { amount, phone, purpose } = req.body;
    // Always the authenticated caller's own account — never trust a
    // client-supplied merchantId (route requires protectMerchant). Taking
    // it from req.body let any authenticated merchant credit an arbitrary
    // merchant's balance, which the sandbox auto-confirm made instant.
    const merchantId = req.merchant._id;
    const token = req.mpesaToken;

    // Normalise phone to 254XXXXXXXXX
    let formattedPhone = String(phone).replace(/\s+/g, '');
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);

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

    // ── SANDBOX MODE: full local simulation — NO call to Safaricom ────────────
    // This prevents any real M-PESA deductions during testing. The sandbox
    // simulation auto-confirms after 4 seconds, routed through the real
    // stkCallback handler (mirrors processPaymentLink/payToMerchantAccount's
    // sandbox branches in transactionController.js) so it exercises the
    // exact same fee-split/credit logic a real callback would, rather than
    // a second hand-maintained copy of it.
    if (!isLive) {
      const checkoutRequestId = `SANDBOX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`🧪 [SANDBOX] Simulating STK Push for ${formattedPhone} KES ${checkoutTotal} | ID: ${checkoutRequestId}`);

      await STKRequest.create({
        merchantId,
        checkoutRequestId,
        amount: checkoutTotal,
        baseAmount: intAmount,
        kind,
        phone: formattedPhone,
        status: 'pending',
      });

      setTimeout(() => {
        const fakeReq = {
          body: {
            Body: {
              stkCallback: {
                CheckoutRequestID: checkoutRequestId,
                ResultCode: 0,
                ResultDesc: 'Sandbox simulation — no real money moved',
                CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: `SBX-${checkoutRequestId.slice(-8)}` }] },
              },
            },
          },
        };
        const fakeRes = { status: () => ({ json: () => {} }) };
        stkCallback(fakeReq, fakeRes).catch((e) => console.error('❌ [SANDBOX] STK top-up auto-confirm error:', e.message));
      }, 4000);

      return res.status(200).json({
        success: true,
        checkoutRequestId,
        message: '[Sandbox] STK simulated — funds will credit in ~4 seconds. No real money moved.',
      });
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────────
    if (process.env.MPESA_LIVE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Live M-PESA payments are not enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
    }
    if (!shortCode || !passkey) {
      return res.status(500).json({ error: 'STK Push not fully configured (MPESA_SHORTCODE / MPESA_PASSKEY missing).' });
    }
    if (!callbackBase) {
      return res.status(500).json({ error: 'MPESA_CALLBACK_URL is not set.' });
    }

    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const stkPassword = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: shortCode,
      Password: stkPassword,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: checkoutTotal,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: withWebhookSecret(`${callbackBase}/api/callbacks/stk-callback`),
      AccountReference: 'PayChain Wallet',
      TransactionDesc: 'Wallet Top Up',
    };

    console.log(`📲 [LIVE] STK Push → ${formattedPhone} KES ${checkoutTotal}`);

    const response = await axios.post(
      `${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = response.data;

    if (String(ResponseCode) !== '0') {
      console.error('❌ Safaricom rejected STK Push:', response.data);
      return res.status(400).json({ error: ResponseDescription || 'Safaricom rejected the STK Push.' });
    }

    // Safaricom accepted — STK prompt is on the customer's phone.
    // Save the tracking record but do NOT let a DB failure kill the response;
    // the callback will still arrive and credit the balance even if this save fails.
    try {
      await STKRequest.create({
        merchantId: merchantId || null,
        checkoutRequestId: CheckoutRequestID,
        amount: checkoutTotal,
        baseAmount: intAmount,
        kind,
        phone: formattedPhone,
        status: 'pending',
      });
    } catch (dbErr) {
      console.warn('⚠️ STKRequest save failed (STK was still sent):', dbErr.message);
    }

    res.status(200).json({
      success: true,
      checkoutRequestId: CheckoutRequestID,
      message: 'STK Push sent — check your phone for the M-PESA prompt.',
    });

  } catch (error) {
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error('❌ STK Push Error:', detail);
    res.status(502).json({ error: error.response?.data?.errorMessage || 'Failed to send STK Push — please try again.', detail });
  }
};

export const stkCallback = async (req, res) => {
  try {
    const payload = req.body.Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = payload;
    // Summary only, not the full payload — CallbackMetadata carries the
    // customer's phone number (PII) which doesn't need to sit in plaintext
    // stdout logs.
    console.log(`📥 STK Push Callback: CheckoutRequestID=${CheckoutRequestID} ResultCode=${ResultCode} ResultDesc=${ResultDesc}`);
    
    const stkReq = await STKRequest.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!stkReq) {
      console.warn('⚠️ Received STK callback for unknown request:', CheckoutRequestID);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Success
      stkReq.status = 'success';
      stkReq.resultDesc = ResultDesc;
      await stkReq.save();

      const receiptItem = CallbackMetadata?.Item.find(i => i.Name === 'MpesaReceiptNumber');
      const receipt = receiptItem ? receiptItem.Value : CheckoutRequestID;
      const transDateItem = CallbackMetadata?.Item.find(i => i.Name === 'TransactionDate');
      const { date, time } = formatTransactionDateTime(transDateItem?.Value);

      if (stkReq.linkId) {
        // Settling a PaymentLink (optionally backing an Invoice) — this is
        // the customer-facing "pay this link" flow, not a wallet top-up.
        const link = await PaymentLink.findOne({ linkId: stkReq.linkId }).populate('merchantId');
        if (link && link.status === 'active') {
          link.status = 'paid';
          await link.save();

          let paidInvoice = null;
          if (link.invoiceId) {
            paidInvoice = await Invoice.findByIdAndUpdate(link.invoiceId, { status: 'paid', paidAt: new Date() }, { returnDocument: 'after' });
          }

          const merchant = link.merchantId;
          if (merchant) {
            // Dual-sided split: stkReq.amount is the TOTAL Safaricom just
            // confirmed (base + any customer surcharge, from
            // getCheckoutTotal at checkout-initiation time); link.amount is
            // the original base bill. Wrapped defensively — this only
            // throws on a genuine ledger-integrity failure (see
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
              ({ merchantFee, merchantNetSettlement, paychainTotalRevenue, customerFee } =
                processSplitTransaction(stkReq.amount, link.amount));
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
            // post-credit balance for the SMS below, same reasoning as
            // confirmationURL above.
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
              accountNumber: merchant.paybillAccount || 'WALLET_FUND',
              type: 'inbound',
              amount: link.amount,
              kesAmount: link.amount,
              currency: 'KES',
              status: 'completed',
              reference: receipt,
              sender: { name: 'M-PESA Express', id: formatPhoneDisplay(stkReq.phone) },
              recipient: { name: merchant.businessName, id: merchant.paybillAccount },
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

            // Customer receipt + merchant alert, same pattern as the C2B
            // confirmationURL above — never blocks, never throws. Account
            // reference mirrors M-Pesa's own "for account X" convention:
            // the invoice number if this settled an invoice, else the
            // merchant's paybill account if they have one, else the raw
            // payment-link id as a last resort (some merchants — e.g. ones
            // predating the paybillAccount field — have none).
            const payerLabel = link.invoiceId ? 'invoice' : 'payment link';
            const accountRef = paidInvoice?.invoiceNumber || merchant.paybillAccount || stkReq.linkId;
            const customerSms = stkReq.phone
              ? safeSendSMS({
                  to: stkReq.phone,
                  // businessName is the only unbounded field — receipt,
                  // amount, account ref, date and time are always fixed.
                  message: buildStrictSms(
                    ({ ref, amt, name, acct, date, time }) =>
                      `${ref} Confirmed. KES ${amt} paid to ${name} for account ${acct} on ${date} at ${time}. Thank you for your payment.`,
                    {
                      fixed: { ref: receipt, amt: stkReq.amount.toLocaleString(), acct: accountRef, date, time },
                      truncatable: [{ key: 'name', value: merchant.businessName, minLength: 10 }],
                    }
                  ).message,
                }).then((r) => { if (!r.success) console.error(`STK ${payerLabel} customer SMS failed for ${receipt}:`, r.error); })
              : Promise.resolve();
            // Merchant sees their base bill amount, not the customer's
            // total (which may include a surcharge that was never the
            // merchant's money) — matches merchantNetSettlement/link.amount
            // being what actually moves their balance.
            // Safaricom's STK callback never includes the payer's registered
            // name (unlike the C2B Confirmation payload, which does) — only
            // their phone number, which we do have via stkReq.phone. Include
            // it here to match the C2B merchant SMS format above.
            const payerPhoneDisplay = formatPhoneDisplay(stkReq.phone);
            const merchantSms = merchant.phone
              ? safeSendSMS({
                  to: merchant.phone,
                  message: `${receipt} Payment Received. KES ${link.amount.toLocaleString()} received${payerPhoneDisplay ? ` from ${payerPhoneDisplay}` : ''} via M-PESA (${link.invoiceId ? 'Invoice' : 'Payment Link'}) on ${date} at ${time}. Your updated PayChain available balance is KES ${(updatedMerchant.kesBalance || 0).toLocaleString()}.`,
                }).then((r) => { if (!r.success) console.error(`STK ${payerLabel} merchant SMS failed for ${receipt}:`, r.error); })
              : Promise.resolve();
            await Promise.all([customerSms, merchantSms]);
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
            accountNumber: merchant.paybillAccount || 'WALLET_FUND',
            type: 'top_up',
            amount: merchantCredit,
            kesAmount: merchantCredit,
            currency: 'KES',
            status: 'completed',
            reference: receipt,
            sender: { name: 'M-PESA Express', id: formatPhoneDisplay(stkReq.phone) },
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

          // Self-funded top-up — one SMS to the merchant's own registered
          // number is enough (no separate "customer" in this flow).
          if (merchant.phone) {
            safeSendSMS({
              to: merchant.phone,
              message: `${receipt} Confirmed. KES ${merchantCredit.toLocaleString()} added to your PayChain wallet via M-PESA on ${date} at ${time}. Your updated available balance is KES ${(updatedMerchant.kesBalance || 0).toLocaleString()}.`,
            }).then((r) => { if (!r.success) console.error(`Wallet top-up SMS failed for merchant ${merchant._id}:`, r.error); });
          }
        }
      }
    } else {
      // Cancelled or Failed — leave the PaymentLink 'active' so the customer can retry.
      stkReq.status = 'failed';
      stkReq.resultDesc = ResultDesc;
      await stkReq.save();
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('❌ STK Callback Error:', error);
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
};

export const getSTKStatus = async (req, res) => {
  try {
    const { checkoutId } = req.params;
    const stkReq = await STKRequest.findOne({ checkoutRequestId: checkoutId });
    if (!stkReq) return res.status(404).json({ error: 'Request not found' });

    res.status(200).json({ 
      status: stkReq.status, 
      resultDesc: stkReq.resultDesc 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching STK status' });
  }
};

import { generateSecurityCredential } from '../utils/safaricomCrypto.js';

// --- DARAJA B2C (OUTBOUND PAYMENTS) ---

export const initiateB2C = async (req, res) => {
  let debited = false;
  let totalDebit = 0;
  try {
    const token = req.mpesaToken;
    const { phone, amount, destination, pin } = req.body;
    const merchantId = req.merchant._id;

    // Standard Safaricom M-Pesa B2C ("Business Bouquet") tariff — the real
    // cost Safaricom charges PayChain per B2C payout, passed through to
    // the merchant. No PayChain markup on top yet (PAYCHAIN_B2C_MARKUP is
    // 0 until that's decided) — see config/mpesaB2cTariffCard.js.
    let b2cFee;
    try {
      ({ totalFee: b2cFee } = getB2cTariff(amount));
    } catch (e) {
      if (e instanceof B2cTariffBoundsError) return res.status(400).json({ error: e.message });
      throw e;
    }

    // Safety: block live transactions unless explicitly enabled
    if (isLive && process.env.MPESA_LIVE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Live M-PESA payments are not yet enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
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

    // Atomic conditional deduct — avoids two concurrent B2C requests both
    // passing a stale in-memory balance check and over-withdrawing. Amount
    // requested to Safaricom stays the raw `amount` (see Amount: amount
    // below) — the fee is PayChain's own separate deduction, never sent
    // to Daraja as part of the payout.
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

    // 1. Security Credential Generation
    const b2cPassword = process.env.MPESA_B2C_PASSWORD || 'Safaricom999!@#';
    const securityCredential = generateSecurityCredential(b2cPassword);
    
    // 2. Daraja B2C Endpoint (Sandbox)
    const url = `${mpesaBaseUrl}/mpesa/b2c/v1/paymentrequest`;

    let b2cRes;
    try {
      b2cRes = await axios.post(url, {
        InitiatorName: process.env.MPESA_B2C_INITIATOR || 'testapi',
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: process.env.MPESA_SHORTCODE || '600000',
        PartyB: phone,
        Remarks: `Withdrawal to ${destination}`,
        QueueTimeOutURL: withWebhookSecret(`${callbackBase}/api/callbacks/b2c-timeout`),
        ResultURL: withWebhookSecret(`${callbackBase}/api/callbacks/b2c-callback`),
        Occasion: 'PayChain Settlement'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      // Only pretend-succeed in sandbox, where Daraja's own test environment
      // is flaky/unavailable by design and merchants aren't real. In live
      // mode this used to swallow a genuine Safaricom rejection/outage and
      // tell the merchant "Transfer initiated successfully" with their
      // balance already debited and no real money ever sent — rethrowing
      // here instead lets the outer catch below refund them and report the
      // real failure.
      if (isLive) throw err;
      console.warn('Daraja B2C API failed, falling back to simulation. Error:', err.response?.data?.errorMessage || err.message);
      b2cRes = { data: { OriginatorConversationID: `SIM_B2C_${Date.now()}` } };
    }

    // Transaction successfully sent to Daraja. type: 'mpesa_b2c' (not the
    // generic 'withdrawal' used by other zero-fee ledger debits) so the fee
    // calculator's dedicated branch stamps paychainFee/safaricomFee from
    // the same getB2cTariff(amount) band used above to compute b2cFee —
    // previously this fee vanished untracked (paychainFee always 0 for
    // 'withdrawal'), invisible to revenue reporting and to any pool-balance
    // reconciliation despite being real money deducted from the merchant.
    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount || 'WALLET_FUND',
      type: 'mpesa_b2c',
      amount: amount,
      kesAmount: amount,
      currency: 'KES',
      status: 'pending', // Daraja transactions are pending until callback
      reference: b2cRes.data.OriginatorConversationID || `B2C_${Date.now()}`,
      sender: { name: merchant.businessName, id: merchant.paybillAccount },
      recipient: { name: destination, id: phone }
    });

    res.status(200).json({ success: true, message: 'Transfer initiated successfully via Daraja', transaction: tx });

  } catch (error) {
    console.error('❌ B2C Transfer Error:', error.response?.data || error);
    // Refund the merchant only if the deduction actually happened — an
    // earlier failure (e.g. PIN check) never touched the balance. Refunds
    // the full totalDebit (amount + B2C fee), matching what was actually
    // reserved above.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    res.status(500).json({ error: error.response?.data?.errorMessage || 'Failed to initiate Daraja B2C transfer' });
  }
};

// Daraja's B2C result payload carries a ResultParameters.ResultParameter
// array of { Key, Value } pairs, one of which (when present) is
// ReceiverPartyPublicName — Safaricom's own verified "254712345678 - JOHN
// DOE" string for who the money actually landed with. Extracts just the
// name portion, or null if the field is missing (older Daraja response
// shapes, or a failed payout never reaching a named recipient).
function extractReceiverName(result) {
  const params = result?.ResultParameters?.ResultParameter;
  if (!Array.isArray(params)) return null;
  const entry = params.find((p) => p?.Key === 'ReceiverPartyPublicName');
  const value = entry?.Value;
  if (!value || typeof value !== 'string') return null;
  // Split only on the first " - " so a name that itself contains a hyphen
  // (e.g. "MARY-JANE DOE") survives intact.
  const match = value.match(/^[^-]*-\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

export const b2cCallback = async (req, res) => {
  // Summary only, not the full payload — ResultParameters carries the
  // recipient's name/phone (PII) which doesn't need to sit in plaintext
  // stdout logs.
  const resultSummary = req.body?.Result;
  console.log(`--- DARAJA B2C CALLBACK RECEIVED --- ResultCode=${resultSummary?.ResultCode} ResultDesc=${resultSummary?.ResultDesc} Ref=${resultSummary?.OriginatorConversationID || resultSummary?.ConversationID}`);

  // Acknowledge receipt immediately — Safaricom retries on anything but a fast 200.
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const result = req.body?.Result;
    if (!result) return;

    const reference = result.OriginatorConversationID || result.ConversationID;
    if (!reference) return;

    const succeeded = result.ResultCode === 0;

    // Update the ledger entry this callback confirms (single B2C transfer or a bulk-pay row)
    const transaction = await Transaction.findOne({ reference });
    // Bulk-pay rows get ONE summary SMS when the whole batch resolves
    // (below), not one per row — texting the merchant once per supplier in
    // a multi-payee batch would be spam. Single B2C withdrawals get an
    // immediate SMS since there's no batch to summarize.
    const isBulkPayRow = transaction?.type === 'bulk_pay';

    if (transaction && transaction.status === 'pending') {
      transaction.status = succeeded ? 'completed' : 'failed';
      // Reconcile the merchant's self-typed recipient label with Safaricom's
      // own verified name for who the payout actually reached — covers both
      // single B2C sends and bulk-pay Mobile Money rows, which both resolve
      // through this same callback. Never overwrite a good label with
      // nothing: only applied when Daraja actually included the field.
      if (succeeded) {
        const receiverName = extractReceiverName(result);
        if (receiverName) {
          transaction.recipient.name = receiverName;
        }
      }
      await transaction.save();

      let merchantForSms = null;
      if (!succeeded) {
        // The payout never landed — return the funds to the merchant's
        // balance. For mpesa_b2c specifically, the Safaricom B2C fee was
        // ALSO deducted alongside `amount` at initiation (initiateB2C's
        // totalDebit) — refunding only `amount` here used to permanently
        // cost the merchant that fee even though the transfer never went
        // through and PayChain never actually paid it to Safaricom either.
        let refundAmount = transaction.amount;
        if (transaction.type === 'mpesa_b2c') {
          const { totalFee } = getB2cTariff(transaction.amount);
          refundAmount += totalFee;
        }
        merchantForSms = await Merchant.findByIdAndUpdate(
          transaction.merchantId,
          { $inc: { kesBalance: refundAmount } },
          { returnDocument: 'after' }
        );
      } else if (!isBulkPayRow) {
        merchantForSms = await Merchant.findById(transaction.merchantId).select('phone');
      }

      createNotification({
        merchantId: transaction.merchantId,
        kind: 'payment',
        title: succeeded ? 'Payout completed' : 'Payout failed',
        message: succeeded
          ? `KES ${transaction.amount.toLocaleString()} was successfully paid to ${transaction.recipient?.name || 'the recipient'}.`
          : `KES ${transaction.amount.toLocaleString()} payout to ${transaction.recipient?.name || 'the recipient'} failed and was refunded to your balance.`,
      });

      if (!isBulkPayRow && merchantForSms?.phone) {
        // B2C result callbacks carry no transaction-time field of their own
        // — "now" is accurate here since this fires at the moment the
        // payout actually resolves.
        const { date, time } = formatTransactionDateTime();
        const recipientName = transaction.recipient?.name || 'the recipient';
        // Recipient display name is the only unbounded field — reference,
        // amount, date, time and balance are always fixed-format.
        const { message } = succeeded
          ? buildStrictSms(
              ({ ref, amt, name, date, time }) => `${ref} Payout Sent. KES ${amt} paid to ${name} on ${date} at ${time}.`,
              { fixed: { ref: reference, amt: transaction.amount.toLocaleString(), date, time }, truncatable: [{ key: 'name', value: recipientName, minLength: 8 }] }
            )
          : buildStrictSms(
              ({ ref, amt, name, date, time, balance }) => `${ref} Payout Failed. KES ${amt} to ${name} could not be completed on ${date} at ${time} and has been refunded. Your updated PayChain available balance is KES ${balance}.`,
              { fixed: { ref: reference, amt: transaction.amount.toLocaleString(), date, time, balance: (merchantForSms.kesBalance || 0).toLocaleString() }, truncatable: [{ key: 'name', value: recipientName, minLength: 8 }] }
            );
        safeSendSMS({ to: merchantForSms.phone, message }).then((r) => {
          if (!r.success) console.error(`B2C payout SMS failed for merchant ${transaction.merchantId}:`, r.error);
        });
      }
    }

    // Update the matching row inside a bulk-pay batch, if this reference belongs to one
    const batch = await PayoutBatch.findOne({ 'transactions.receiptNumber': reference });
    if (batch) {
      const row = batch.transactions.find((t) => t.receiptNumber === reference);
      if (row && row.status === 'pending') {
        const previousBatchStatus = batch.status;
        row.status = succeeded ? 'completed' : 'failed';

        const statuses = batch.transactions.map((t) => t.status);
        if (statuses.every((s) => s === 'completed')) batch.status = 'Processed';
        else if (statuses.some((s) => s === 'pending')) batch.status = 'Pending';
        else if (statuses.some((s) => s === 'failed')) batch.status = 'Partial';

        await batch.save();

        // Every row just settled (batch left 'Pending' for the first time)
        // — send the one summary SMS for the whole batch here.
        const justResolved = previousBatchStatus === 'Pending' && batch.status !== 'Pending';
        if (justResolved) {
          const merchant = await Merchant.findById(batch.merchantId).select('phone');
          if (merchant?.phone) {
            const succeededCount = statuses.filter((s) => s === 'completed').length;
            const failedCount = statuses.filter((s) => s === 'failed').length;
            const { date, time } = formatTransactionDateTime();
            const message = `${batch.batchReference} Bulk Payout ${batch.status} on ${date} at ${time}. ${succeededCount} of ${batch.transactions.length} payout(s) completed (KES ${batch.totalNetAmount.toLocaleString()} total)${failedCount > 0 ? `; ${failedCount} failed and refunded` : ''}.`;
            safeSendSMS({ to: merchant.phone, message }).then((r) => {
              if (!r.success) console.error(`Bulk payout batch SMS failed for merchant ${batch.merchantId}:`, r.error);
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing B2C callback:', error);
  }
};
