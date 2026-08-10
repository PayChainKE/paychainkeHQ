import axios from 'axios';
import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, sendStaggeredSms, buildStrictSms } from '../utils/smsSanitizer.js';
import { calculateMerchantFee, processSplitTransaction, splitCustomerSurcharge, getCheckoutTotal, calculateRawC2bMarkup, PricingEngineError } from '../utils/pricingEngine.js';
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
import { PAYCHAIN_TXN_RATE } from '../config/revenueRateCard.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { AUTO_INFLATION_SHIELD_ENABLED } from '../config/inflationShieldFlag.js';
import { logAudit } from '../utils/auditLog.js';
import { buildPaymentReceivedSms, buildPaymentSentSms, buildCustomerPaidSms } from '../utils/paymentSmsTemplates.js';
import { initiateStkPush as ncbaInitiateStkPush, queryStkPush as ncbaQueryStkPush } from '../services/ncbaStkPushService.js';
import { validateMobileWalletNumber as ncbaValidateMobileWalletNumber, submitMobileB2wPayment as ncbaSubmitMobileB2wPayment } from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';

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

// Kill-switch while PayChain migrates STK Push (customer collections) and
// B2C (merchant payouts to phone numbers) off Safaricom Daraja onto an NCBA
// equivalent — no NCBA spec exists yet, so this defaults OFF rather than
// leaving two live money-movement rails running unreviewed. Everything else
// (token generation, callbacks, B2B, registerURLs) is untouched: those
// aren't part of the migration and existing in-flight requests still need
// their callbacks to resolve. Flip DARAJA_STK_B2C_ENABLED=true in the
// hosting env to restore STK/B2C immediately if the NCBA side stalls —
// no redeploy of this code required.
export const DARAJA_STK_B2C_ENABLED = process.env.DARAJA_STK_B2C_ENABLED === 'true';

// Migration switch: when true, STK Push (collections) and B2C/Mobile B2W
// (payouts to phone numbers) route to NCBA instead of Daraja — see
// services/ncbaStkPushService.js and services/ncbaOpenBankingService.js's
// submitMobileB2wPayment. Checked BEFORE DARAJA_STK_B2C_ENABLED everywhere
// both are consulted, so flipping this on is what actually cuts traffic
// over; DARAJA_STK_B2C_ENABLED alone still restores Daraja immediately if
// NCBA needs to be turned back off.
export const NCBA_STK_B2C_ENABLED = process.env.NCBA_STK_B2C_ENABLED === 'true';


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

// Skips the Daraja OAuth token fetch entirely when NCBA is the active
// provider for STK Push/B2C — generateToken would otherwise fail these
// requests with "M-PESA is not configured" once Daraja consumer key/secret
// are eventually left unset. Used in place of generateToken only for the
// four STK/B2C route handlers that branch on NCBA_STK_B2C_ENABLED
// (stk-push, b2c-request, payment-link pay, pay-account) — B2B and the
// webhook/register-urls routes always need a real Daraja token regardless
// of this flag, so they keep using generateToken directly.
export const generateTokenUnlessNcba = (req, res, next) => {
  if (NCBA_STK_B2C_ENABLED) return next();
  return generateToken(req, res, next);
};

// Register C2B URLs. Always builds the confirmation/validation URLs itself
// from callbackBase + the real MPESA_WEBHOOK_SECRET (same withWebhookSecret
// helper every other Daraja callback URL in this file uses) rather than
// trusting a caller-supplied URL — there's no legitimate reason to point
// Safaricom's C2B callbacks anywhere other than this deployment's own
// routes, and requiring the secret to be manually retyped into a request
// body every time this is called is exactly the kind of manual step that
// gets fumbled (e.g. registered with a placeholder/wrong key by mistake).
// `shortCode` is an optional override in the body: MPESA_SHORTCODE is the
// shared STK Push test paybill in sandbox, which Safaricom's C2B product
// rejects outright — a *different* sandbox shortcode with C2B enabled must
// be passed here to actually register successfully.
export const registerURLs = async (req, res) => {
  try {
    const token = req.mpesaToken;
    const { shortCode: shortCodeOverride } = req.body || {};
    const targetShortCode = shortCodeOverride || shortCode;

    if (!callbackBase) {
      return res.status(500).json({ error: 'MPESA_CALLBACK_URL is not configured.' });
    }

    const url = `${mpesaBaseUrl}/mpesa/c2b/v1/registerurl`;

    const data = {
      ShortCode: targetShortCode,
      ResponseType: 'Completed',
      ConfirmationURL: withWebhookSecret(`${callbackBase}/api/callbacks/confirmation`),
      ValidationURL: withWebhookSecret(`${callbackBase}/api/callbacks/validation`),
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    res.status(200).json({ ...response.data, registeredShortCode: targetShortCode });
  } catch (error) {
    console.error('❌ M-PESA Register URLs Error:', error.response?.data || error.message);
    res.status(400).json({ error: error.response?.data?.errorMessage || 'Failed to register M-PESA URLs' });
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
// Shared by the live Safaricom C2B webhook (confirmationURL) below and the
// owner-only debug endpoint (simulateMpesaConfirmation) further down —
// both run this exact same processing, so a manually-triggered run is
// genuine proof the production pipeline works, not a reimplementation that
// could silently drift from what a real webhook actually does. Returns a
// small summary (merchant, transaction, txHash if an on-chain settlement
// happened) so the debug endpoint has something useful to show back.
async function processMpesaC2bPayload(payload) {
    const {
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      FirstName,
      MiddleName,
      LastName
    } = payload;

    const accountNumber = BillRefNumber?.trim();
    const amount = Number(TransAmount);

    if (!accountNumber) return { skipped: 'no_account_number' };

    // Find the merchant by their unique Paybill Account number
    const merchant = await Merchant.findOne({ paybillAccount: accountNumber });

    if (!merchant) {
      console.warn(`⚠️ Received M-PESA payment for unknown account: ${accountNumber}`);
      return { skipped: 'unknown_account', accountNumber };
    }

    // Check if transaction already exists (idempotency)
    const existingTx = await Transaction.findOne({ reference: TransID });
    if (existingTx) {
      console.log(`⚠️ Transaction ${TransID} already processed.`);
      return { skipped: 'duplicate', accountNumber };
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
    // C2B paybill deposit above FLAT_FEE_FREE_TIER_MAX_KES
    // (calculateRawC2bMarkup — see pricingEngine.js) — both deducted from
    // the gross receipt before it ever reaches the merchant's balance or
    // the Inflation Shield FX conversion below. Clamped so the combined
    // fee never exceeds the gross amount itself.
    const tieredMerchantFee = calculateMerchantFee(amount);
    const rawC2bMarkup = calculateRawC2bMarkup(amount);
    const merchantFee = Math.min(amount, Math.round((tieredMerchantFee + rawC2bMarkup) * 100) / 100);
    const netKESAmount = Math.round((amount - merchantFee) * 100) / 100;
    console.log(`💰 M-PESA C2B fee for ${TransID}: gross KES ${amount}, PayChain fee KES ${merchantFee} (tiered KES ${tieredMerchantFee} + flat KES ${rawC2bMarkup}), net KES ${netKESAmount}`);

    // The Transaction pre-save hook (utils/feeCalculator.js) only knows the
    // tiered portion (it calls calculateMerchantFee the same way, on the
    // same amount) — top up paychainFee with whatever's left of the flat
    // markup on top (normally the full rawC2bMarkup, less only if the
    // clamp above capped the total at the gross amount for a very small
    // deposit), so the persisted field always matches what was actually
    // deducted below, not just the tiered part.
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
          message: buildCustomerPaidSms({
            ref: TransID,
            amount,
            businessName: merchant.businessName,
            accountRef: accountNumber,
            date,
            time,
          }).message,
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
    let settlementTxHash = null;
    // Demo/evidence merchants (Stellar grant deliverable pipeline) always
    // get the automatic conversion, regardless of AUTO_INFLATION_SHIELD_ENABLED
    // — that flag exists purely to protect real merchants from this on-chain
    // dependency sitting in their live payment path, and isDemoMerchant is
    // never set on a real merchant (see models/Merchant.js), so this can't
    // change behavior for anyone but the demo accounts it's built for.
    if (merchant.stellarPublicKey && (merchant.isDemoMerchant || AUTO_INFLATION_SHIELD_ENABLED)) {
      try {
        const liveRate = await getLiveKesToUsdcRate();
        const usdcPayoutValue = (netKESAmount * liveRate).toFixed(7);

        console.log(`🛡️ Executing Inflation Shield for Acc ${accountNumber}:`);
        console.log(`   - Gross M-Pesa KES: ${amount}`);
        console.log(`   - Live KES/USDC Rate (Fractional): ${liveRate}`);
        console.log(`   - Exact On-Chain Payout: ${usdcPayoutValue} USDC`);

        const txHash = await settleInflationShield(merchant.stellarPublicKey, usdcPayoutValue);
        settlementTxHash = txHash;

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

    // Explicit pause before the merchant SMS, only when a customer SMS was
    // actually sent above too — confirmed live (2026-08-04) that firing two
    // SMS too close together gets the second one queued by Africa's
    // Talking for minutes (100% hit rate across every real multi-recipient
    // transaction sampled). The Inflation Shield branch above sometimes
    // already provides enough of a gap on its own, but the common
    // no-Stellar-wallet path resolves in milliseconds — not enough. Safe to
    // await here regardless: the response to Safaricom was already sent
    // above this block (see the Promise.all comment below).
    if (MSISDN) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Merchant transaction alert SMS — new balance here IS real data we
    // hold (updatedMerchant.kesBalance from the atomic $inc above).
    const merchantSms = merchant.phone
      ? safeSendSMS({
          to: merchant.phone,
          message: buildPaymentReceivedSms({
            ref: TransID,
            amount,
            payerName: senderName,
            payerPhone: MSISDN,
            date,
            time,
            balance: updatedMerchant.kesBalance || 0,
          }).message,
        }).then((result) => {
          if (!result.success) console.error(`Merchant SMS alert failed for ${merchant._id}:`, result.error);
        })
      : Promise.resolve();

    // Both dispatches never throw (see utils/sms.js) — awaited together
    // purely so both attempts fire before this handler returns, not because
    // a delivery failure here could ever affect the response already sent
    // to Safaricom above.
    await Promise.all([customerSms, merchantSms]);

    return { merchant: updatedMerchant, transaction, txHash: settlementTxHash };
}

// Public webhook — Safaricom hits this when a real (or sandboxed) C2B
// payment completes. Acks immediately, then runs the actual processing
// (processMpesaC2bPayload above) without the response waiting on it.
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

    // Acknowledge receipt to Safaricom immediately
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });

    await processMpesaC2bPayload(payload);
  } catch (error) {
    console.error('❌ M-PESA Confirmation Webhook Error:', error);
    // Safaricom expects a 200 even if internal processing fails to avoid retries
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal Failure' });
  }
};

// @desc    Manually run the exact same confirmation pipeline as the live
//          Safaricom webhook above, for a demo merchant — Safaricom's C2B
//          sandbox callback delivery is well known to be unreliable/slow,
//          so this gives a deterministic way to produce a real Stellar
//          settlement + tx hash without waiting on it. Restricted to
//          isDemoMerchant accounts only: this fabricates a real balance
//          credit and (if the merchant has a wallet) a real on-chain
//          transaction, so it must never be reachable against a real
//          merchant's account.
// @route   POST /api/admin/merchants/:id/simulate-mpesa-confirmation
// @access  Private (Admin, owner only)
export const simulateMpesaConfirmation = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, senderName, senderPhone } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'A valid positive amount is required.' });
    }

    const merchant = await Merchant.findById(id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    if (!merchant.isDemoMerchant) {
      return res.status(403).json({ error: 'This debug tool only works on demo merchants, so it can never fabricate a credit against a real merchant account.' });
    }
    if (!merchant.paybillAccount) {
      return res.status(400).json({ error: 'This demo merchant has no paybillAccount assigned — cannot match it to a simulated payment.' });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const transTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const nameParts = String(senderName || 'TEST SIMULATION').trim().split(/\s+/);

    const payload = {
      TransactionType: 'Pay Bill',
      TransID: `TESTSIM${Date.now()}`,
      TransTime: transTime,
      TransAmount: String(numericAmount),
      BusinessShortCode: shortCode || '',
      BillRefNumber: merchant.paybillAccount,
      MSISDN: senderPhone || '254700000000',
      FirstName: nameParts[0],
      MiddleName: '',
      LastName: nameParts.slice(1).join(' '),
    };

    const result = await processMpesaC2bPayload(payload);

    logAudit({
      action: 'admin.mpesa.simulate_confirmation', category: 'admin', severity: 'success',
      message: `Manually triggered M-PESA confirmation pipeline for demo merchant ${merchant.businessName} (KES ${numericAmount})`,
      merchant,
      actor: req.admin ? { type: 'admin', id: req.admin._id || null, email: req.admin.email || null, name: req.admin.name || req.admin.email || 'admin' } : { type: 'admin', id: null, email: null, name: 'admin' },
      req,
      metadata: { amount: numericAmount, transId: payload.TransID, txHash: result?.txHash || null },
    });

    res.status(200).json({
      success: true,
      transId: payload.TransID,
      txHash: result?.txHash || null,
      settled: !!result?.txHash,
      transaction: result?.transaction || null,
    });
  } catch (error) {
    console.error('❌ Simulate M-PESA Confirmation Error:', error);
    res.status(500).json({ error: error.message || 'Simulation failed' });
  }
};

// ================= STK PUSH (LIPA NA M-PESA ONLINE) =================

export const initiateSTKPush = async (req, res) => {
  if (!NCBA_STK_B2C_ENABLED && !DARAJA_STK_B2C_ENABLED) {
    return res.status(503).json({ error: 'M-PESA STK Push is temporarily unavailable while we migrate to a new payment provider. Please try again later.' });
  }
  try {
    const { amount, phone, purpose } = req.body;
    // Always the authenticated caller's own account — never trust a
    // client-supplied merchantId (route requires protectMerchant). Taking
    // it from req.body let any authenticated merchant credit an arbitrary
    // merchant's balance, which the sandbox auto-confirm made instant.
    const merchantId = req.merchant._id;
    const token = req.mpesaToken;

    // Normalise + validate to 254XXXXXXXXX — rejects malformed numbers here
    // rather than letting them reach Safaricom/NCBA or get stored as the
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

    // ── NCBA MODE: real STK Push via NCBA's paybill 880100 (or simulated —
    // see services/ncbaStkPushService.js's NCBA_STK_LIVE_ENABLED gate) ──────
    if (NCBA_STK_B2C_ENABLED) {
      const checkoutRequestId = await initiateAndTrackNcbaStk({
        merchantId,
        phone: formattedPhone,
        checkoutTotal,
        extra: { baseAmount: intAmount, kind },
      });
      return res.status(200).json({
        success: true,
        checkoutRequestId,
        message: 'STK Push sent — check your phone for the M-PESA prompt.',
      });
    }

    // ── SANDBOX MODE (Daraja): full local simulation — NO call to Safaricom ──
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

// Shared by the real Daraja stkCallback webhook (below) and the NCBA poll
// loop (pollAndResolveNcbaStkPush, further below) — both learn a resolved
// outcome through completely different mechanisms (a pushed webhook vs a
// polled query), but from here on the settlement logic (Payment Link split,
// invoice paid, wallet credit, surcharge split, SMS) must be identical
// regardless of which rail confirmed it, not a second hand-maintained copy.
export async function resolveStkOutcome(stkReq, { succeeded, receipt, resultDesc, transTime }) {
  // Both Safaricom and NCBA can redeliver a confirmation (Safaricom retries
  // on a slow/ambiguous ack; NCBA's poll and the separate generic
  // account-notification webhook can both observe the same underlying
  // transaction). Everything below this point credits a merchant's balance,
  // so once a request has already resolved (success or failed), any further
  // resolution for the same checkoutRequestId is a duplicate — no-op.
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
              // Unlike C2B (processMpesaC2bPayload above), Safaricom's STK
              // Push callback never includes the payer's registered name —
              // only their phone number. That's the one real sender detail
              // available, so it's the sender identity here too, same as a
              // real M-Pesa confirmation SMS falls back to showing the
              // number when it has no name to show.
              sender: { name: formatPhoneDisplay(stkReq.phone), id: formatPhoneDisplay(stkReq.phone) },
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
            // merchant's paybill account if they have one, else the raw
            // payment-link id as a last resort (some merchants — e.g. ones
            // predating the paybillAccount field — have none).
            const payerLabel = link.invoiceId ? 'invoice' : 'payment link';
            const accountRef = paidInvoice?.invoiceNumber || merchant.paybillAccount || stkReq.linkId;
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
            accountNumber: merchant.paybillAccount || 'WALLET_FUND',
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
                accountRef: merchant.paybillAccount,
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
}

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

    const receiptItem = CallbackMetadata?.Item.find(i => i.Name === 'MpesaReceiptNumber');
    const receipt = receiptItem ? receiptItem.Value : CheckoutRequestID;
    const transDateItem = CallbackMetadata?.Item.find(i => i.Name === 'TransactionDate');

    await resolveStkOutcome(stkReq, {
      succeeded: ResultCode === 0,
      receipt,
      resultDesc: ResultDesc,
      transTime: transDateItem?.Value,
    });

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('❌ STK Callback Error:', error);
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
};

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

// Shared by every real STK-initiation call site (this file's initiateSTKPush,
// plus transactionController.js's processPaymentLink and payToMerchantAccount)
// once NCBA_STK_B2C_ENABLED is on — creates the same STKRequest shape those
// call sites already build for Daraja, keyed by NCBA's own TransactionID
// instead of Safaricom's CheckoutRequestID, and starts the poll loop above.
// `extra` carries whatever call-site-specific fields apply (linkId, or
// baseAmount+kind) — merged in exactly as each call site already does for
// its Daraja STKRequest.create() today.
export async function initiateAndTrackNcbaStk({ merchantId, phone, checkoutTotal, extra = {} }) {
  const merchant = await Merchant.findById(merchantId).select('paybillAccount');
  if (!merchant?.paybillAccount) {
    throw new Error('This merchant has no PayChain Account Number assigned yet — cannot process this payment request.');
  }

  const { transactionId } = await ncbaInitiateStkPush({ phone, amount: checkoutTotal, accountNo: merchant.paybillAccount });

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

import { generateSecurityCredential } from '../utils/safaricomCrypto.js';

// --- DARAJA B2C (OUTBOUND PAYMENTS) ---

export const initiateB2C = async (req, res) => {
  if (!NCBA_STK_B2C_ENABLED && !DARAJA_STK_B2C_ENABLED) {
    return res.status(503).json({ error: 'M-PESA payouts are temporarily unavailable while we migrate to a new payment provider. Please try again later.' });
  }
  let debited = false;
  let totalDebit = 0;
  try {
    const token = req.mpesaToken;
    const { amount, destination, pin } = req.body;
    const merchantId = req.merchant._id;

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

    // Standard Safaricom M-Pesa B2C ("Business Bouquet") tariff — the real
    // cost Safaricom charges PayChain per B2C payout — plus PayChain's own
    // flat KES 10 margin (PAYCHAIN_B2C_MARKUP), both passed through to the
    // merchant — see config/mpesaB2cTariffCard.js.
    let b2cFee;
    try {
      ({ totalFee: b2cFee } = getB2cTariff(amount));
    } catch (e) {
      if (e instanceof B2cTariffBoundsError) return res.status(400).json({ error: e.message });
      throw e;
    }

    // Daraja-specific safety gates — irrelevant once NCBA is the active
    // provider (its own liveCallsEnabled/credential checks live in
    // services/ncbaOpenBankingService.js instead).
    if (!NCBA_STK_B2C_ENABLED) {
      // Safety: block live transactions unless explicitly enabled
      if (isLive && process.env.MPESA_LIVE_ENABLED !== 'true') {
        return res.status(503).json({ error: 'Live M-PESA payments are not yet enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
      }

      // Safety: never let a live payout silently fall back to Safaricom's
      // public sandbox initiator/password ('testapi' / 'Safaricom999!@#')
      // just because the real credentials weren't configured — fail loudly
      // here, before any debit, rather than attempting a live B2C call that
      // Safaricom will reject for an unclear reason downstream.
      if (isLive && (!process.env.MPESA_B2C_INITIATOR || !process.env.MPESA_B2C_PASSWORD)) {
        return res.status(503).json({ error: 'Live B2C initiator credentials are not configured (MPESA_B2C_INITIATOR / MPESA_B2C_PASSWORD).' });
      }
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

    // ── NCBA MODE: Mobile B2W payout (or simulated — see
    // services/ncbaOpenBankingService.js's NCBA_OPENBANKING_LIVE_ENABLED
    // gate) ───────────────────────────────────────────────────────────────
    if (NCBA_STK_B2C_ENABLED) {
      const transactionId = `PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      // Daraja B2C only ever targeted Safaricom-registered numbers — the
      // existing UI has no provider picker, so 'safaricom' preserves
      // identical behavior. Airtel Money support just needs a provider
      // field threaded through from the frontend later.
      const { validationId } = await ncbaValidateMobileWalletNumber({ provider: 'safaricom', msisdn: phone });
      await ncbaSubmitMobileB2wPayment({
        transactionId,
        validationId,
        provider: 'safaricom',
        amount,
        recipientNumber: phone,
        narration: `Withdrawal to ${destination}`,
      });

      // type: 'ncba_mobile_b2w' (not 'mpesa_b2c') — see utils/feeCalculator.js
      // for the matching fee branch and ncbaOpenBankingController.js's
      // handlePesaLinkCallback for how this resolves from 'pending'.
      const tx = await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: 'ncba_mobile_b2w',
        amount: amount,
        kesAmount: amount,
        currency: 'KES',
        status: 'pending',
        reference: transactionId,
        sender: { name: merchant.businessName, id: merchant.paybillAccount },
        recipient: { name: destination, id: phone },
      });

      return res.status(200).json({ success: true, message: 'Transfer initiated successfully', transaction: tx });
    }

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
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
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
    // This catch is shared by both the NCBA and Daraja branches above —
    // "Daraja" in the fallback message was wrong (and actively misleading
    // for debugging) whenever the NCBA path is the one that actually threw.
    const fallbackMessage = NCBA_STK_B2C_ENABLED ? 'Failed to initiate transfer' : 'Failed to initiate Daraja B2C transfer';
    res.status(500).json({ error: error.response?.data?.errorMessage || error.message || fallbackMessage });
  }
};

// @desc    Merchant-initiated single payout to another business's Paybill or
//          Till number, via Safaricom's Daraja B2B API. Same "accepted now,
//          confirmed later" async shape as initiateB2C above — b2cCallback
//          below reconciles both mpesa_b2c and mpesa_b2b transactions.
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

    // Safaricom's own B2B tariff isn't modeled anywhere in this codebase
    // (see bulkPayController.js's Mobile Money branch, which charges B2B
    // rows nothing) — this is purely PayChain's own flat margin, the same
    // PAYCHAIN_TXN_RATE every other outbound rail charges, not a Safaricom
    // cost pass-through. Computed once here and reused unchanged as the
    // pre-save hook's basis (Transaction.amount) below, so the debit and
    // the persisted paychainFee can never disagree.
    const fee = Math.round(numericAmount * PAYCHAIN_TXN_RATE * 100) / 100;

    // Safety: block live transactions unless explicitly enabled
    if (isLive && process.env.MPESA_LIVE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Live M-PESA payments are not yet enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
    }

    // Safety: never let a live payout silently fall back to Safaricom's
    // public sandbox initiator/password ('testapi' / 'Safaricom999!@#')
    // just because the real credentials weren't configured — fail loudly
    // here, before any debit, rather than attempting a live B2C call that
    // Safaricom will reject for an unclear reason downstream.
    if (isLive && (!process.env.MPESA_B2C_INITIATOR || !process.env.MPESA_B2C_PASSWORD)) {
      return res.status(503).json({ error: 'Live B2C initiator credentials are not configured (MPESA_B2C_INITIATOR / MPESA_B2C_PASSWORD).' });
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

    const b2cPassword = process.env.MPESA_B2C_PASSWORD || 'Safaricom999!@#';
    const securityCredential = generateSecurityCredential(b2cPassword);

    const url = `${mpesaBaseUrl}/mpesa/b2b/v1/paymentrequest`;

    let b2bRes;
    try {
      b2bRes = await axios.post(url, {
        Initiator: process.env.MPESA_B2C_INITIATOR || 'testapi',
        SecurityCredential: securityCredential,
        CommandID: billType === 'paybill' ? 'BusinessPayBill' : 'BusinessBuyGoods',
        SenderIdentifierType: '4',
        RecieverIdentifierType: '4',
        Amount: numericAmount,
        PartyA: shortCode || '600000',
        PartyB: partyB,
        AccountReference: accountReference || 'Settlement',
        Remarks: reference || `Payout to ${partyB}`,
        QueueTimeOutURL: withWebhookSecret(`${callbackBase}/api/callbacks/b2c-timeout`),
        ResultURL: withWebhookSecret(`${callbackBase}/api/callbacks/b2c-callback`),
      }, {
        headers: { Authorization: `Bearer ${req.mpesaToken}` },
        timeout: 20000,
      });
    } catch (err) {
      // Same sandbox-only simulation fallback as initiateB2C — never on live.
      if (isLive) throw err;
      console.warn('Daraja B2B API failed, falling back to simulation. Error:', err.response?.data?.errorMessage || err.message);
      b2bRes = { data: { OriginatorConversationID: `SIM_B2B_${Date.now()}` } };
    }

    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount || 'WALLET_FUND',
      type: 'mpesa_b2b',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      status: 'pending', // Daraja transactions are pending until callback
      reference: b2bRes.data.OriginatorConversationID || `B2B_${Date.now()}`,
      sender: { name: merchant.businessName, id: merchant.paybillAccount },
      recipient: { name: reference || `${billType === 'paybill' ? 'Paybill' : 'Till'} ${partyB}`, id: partyB },
    });

    res.status(200).json({ success: true, message: 'Transfer initiated successfully via Daraja', transaction: tx });

  } catch (error) {
    console.error('❌ B2B Transfer Error:', error.response?.data || error);
    // Refund the merchant only if the deduction actually happened.
    if (debited && totalDebit > 0) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: totalDebit } });
    }
    res.status(500).json({ error: error.response?.data?.errorMessage || 'Failed to initiate Daraja B2B transfer' });
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

    const rawReference = result.OriginatorConversationID || result.ConversationID;
    // Reject anything that isn't a plain string before it ever reaches a
    // Mongo query filter below — a body-derived object here (e.g. an
    // {"$ne": null}-shaped value, whether from a compromised sender or a
    // parsing quirk) would otherwise be interpreted as a query operator
    // instead of an equality match, potentially matching an arbitrary
    // pending transaction rather than the one this callback is actually
    // about.
    if (typeof rawReference !== 'string' || !rawReference) return;
    const reference = rawReference;

    const succeeded = result.ResultCode === 0;
    // Reconcile the merchant's self-typed recipient label with Safaricom's
    // own verified name for who the payout actually reached — covers both
    // single B2C sends and bulk-pay Mobile Money rows, which both resolve
    // through this same callback. Never overwrite a good label with
    // nothing: only applied when Daraja actually included the field.
    const receiverName = succeeded ? extractReceiverName(result) : null;

    // Atomic claim on the pending->resolved transition — same reasoning as
    // resolveStkOutcome's identical fix: Safaricom redelivers on a slow/
    // ambiguous ack, and this exact handler is ALSO wired as the
    // b2c-timeout webhook (routes/mpesaRoutes.js), so two deliveries
    // landing close together is a real scenario. A plain
    // `if (transaction.status === 'pending')` read followed by a separate
    // `.save()` is a TOCTOU race that could double-refund a failed payout —
    // handing the merchant their money back twice. The status:'pending'
    // filter here is what makes only one caller ever win the transition.
    const setFields = { status: succeeded ? 'completed' : 'failed' };
    if (receiverName) setFields['recipient.name'] = receiverName;
    const transaction = await Transaction.findOneAndUpdate(
      { reference, status: 'pending' },
      { $set: setFields },
      { returnDocument: 'after' }
    );
    // Bulk-pay rows get ONE summary SMS when the whole batch resolves
    // (below), not one per row — texting the merchant once per supplier in
    // a multi-payee batch would be spam. Single B2C withdrawals get an
    // immediate SMS since there's no batch to summarize.
    const isBulkPayRow = transaction?.type === 'bulk_pay';

    if (transaction) {
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
        } else if (transaction.type === 'mpesa_b2b') {
          // Same reasoning as mpesa_b2c above — initiateB2B also deducted a
          // PayChain fee (PAYCHAIN_TXN_RATE of amount) alongside the payout
          // itself, which needs refunding too when the transfer never lands.
          refundAmount += Math.round(transaction.amount * PAYCHAIN_TXN_RATE * 100) / 100;
        }
        merchantForSms = await Merchant.findByIdAndUpdate(
          transaction.merchantId,
          { $inc: { kesBalance: refundAmount } },
          { returnDocument: 'after' }
        );
      } else if (!isBulkPayRow) {
        merchantForSms = await Merchant.findById(transaction.merchantId).select('phone kesBalance');
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
          ? buildPaymentSentSms({
              ref: reference,
              amount: transaction.amount,
              recipientName,
              recipientPhone: transaction.recipient?.id,
              date,
              time,
              balance: merchantForSms.kesBalance || 0,
              fee: transaction.type === 'mpesa_b2c' ? getB2cTariff(transaction.amount).totalFee : null,
            })
          : buildStrictSms(
              ({ ref, amt, name, date, time, balance }) => `${ref} Payout Failed. KES ${amt} to ${name} could not be completed on ${date} at ${time} and has been refunded. Your updated PayChain available balance is KES ${balance}.`,
              { fixed: { ref: reference, amt: transaction.amount.toLocaleString(), date, time, balance: (merchantForSms.kesBalance || 0).toLocaleString() }, truncatable: [{ key: 'name', value: recipientName, minLength: 8 }] }
            );
        safeSendSMS({ to: merchantForSms.phone, message }).then((r) => {
          if (!r.success) console.error(`B2C payout SMS failed for merchant ${transaction.merchantId}:`, r.error);
        });
      }
    }

    // Update the matching row inside a bulk-pay batch, if this reference belongs to one.
    // Same atomic-claim reasoning as the Transaction update above — the
    // positional $ operator, filtered on the row's own 'pending' status,
    // means only one concurrent redelivery ever flips this specific row;
    // the batch-level aggregate `status` below is then a compare-and-swap
    // keyed off the previous status this same call observed, rather than a
    // blind overwrite, so two different rows in the same batch resolving
    // near-simultaneously can't stomp each other's aggregate update either.
    const batch = await PayoutBatch.findOneAndUpdate(
      { 'transactions.receiptNumber': reference, 'transactions.status': 'pending' },
      { $set: { 'transactions.$.status': succeeded ? 'completed' : 'failed' } },
      { returnDocument: 'after' }
    );
    if (batch) {
      const previousBatchStatus = batch.status;
      const statuses = batch.transactions.map((t) => t.status);
      let newBatchStatus = previousBatchStatus;
      if (statuses.every((s) => s === 'completed')) newBatchStatus = 'Processed';
      else if (statuses.some((s) => s === 'pending')) newBatchStatus = 'Pending';
      else if (statuses.some((s) => s === 'failed')) newBatchStatus = 'Partial';

      if (newBatchStatus !== previousBatchStatus) {
        await PayoutBatch.updateOne({ _id: batch._id, status: previousBatchStatus }, { $set: { status: newBatchStatus } });
      }

      // Every row just settled (batch left 'Pending' for the first time)
      // — send the one summary SMS for the whole batch here.
      const justResolved = previousBatchStatus === 'Pending' && newBatchStatus !== 'Pending';
      if (justResolved) {
        const merchant = await Merchant.findById(batch.merchantId).select('phone');
        if (merchant?.phone) {
          const succeededCount = statuses.filter((s) => s === 'completed').length;
          const failedCount = statuses.filter((s) => s === 'failed').length;
          const { date, time } = formatTransactionDateTime();
          const message = `${batch.batchReference} Bulk Payout ${newBatchStatus} on ${date} at ${time}. ${succeededCount} of ${batch.transactions.length} payout(s) completed (KES ${batch.totalNetAmount.toLocaleString()} total)${failedCount > 0 ? `; ${failedCount} failed and refunded` : ''}.`;
          safeSendSMS({ to: merchant.phone, message }).then((r) => {
            if (!r.success) console.error(`Bulk payout batch SMS failed for merchant ${batch.merchantId}:`, r.error);
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing B2C callback:', error);
  }
};
