import axios from 'axios';
import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, sendStaggeredSms } from '../utils/smsSanitizer.js';
import { calculateMerchantFee, processSplitTransaction, processInvoiceSplitTransaction, splitCustomerSurcharge, getCheckoutTotal, calculateRawC2bMarkup, PricingEngineError } from '../utils/pricingEngine.js';
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
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { getB2cTariff, B2cTariffBoundsError } from '../config/mpesaB2cTariffCard.js';
import { NCBA_LIPA_NA_MPESA_FLAT_FEE_KES } from '../config/revenueRateCard.js';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay.js';
import { AUTO_INFLATION_SHIELD_ENABLED } from '../config/inflationShieldFlag.js';
import { logAudit } from '../utils/auditLog.js';
import { buildPaymentReceivedSms, buildCustomerPaidSms } from '../utils/paymentSmsTemplates.js';
import { initiateStkPush as ncbaInitiateStkPush, queryStkPush as ncbaQueryStkPush, generateQrCode as ncbaGenerateQrCode } from '../services/ncbaStkPushService.js';
import { validateMobileWalletNumber as ncbaValidateMobileWalletNumber, submitMobileB2wPayment as ncbaSubmitMobileB2wPayment, validateLipaNaMpesaAccount as ncbaValidateLnmAccount, submitLipaNaMpesaPayment as ncbaSubmitLnmPayment, NcbaOpenBankingValidationError } from '../services/ncbaOpenBankingService.js';
import { validatePhoneNumber, NcbaValidationError, getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';

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
// Public URL Safaricom will POST callbacks to.
// Must be HTTPS and reachable by Safaricom servers.
export const callbackBase = (process.env.MPESA_CALLBACK_URL || '').replace(/\/$/, '');

// Appended to every callback URL handed to Safaricom — routes/mpesaRoutes.js
// rejects any callback that doesn't carry this in ?key=. Daraja has no
// native webhook signature, so a secret embedded in the URL itself is the
// standard practical substitute.
const webhookSecret = process.env.MPESA_WEBHOOK_SECRET || '';
const withWebhookSecret = (url) => `${url}${webhookSecret ? `?key=${encodeURIComponent(webhookSecret)}` : ''}`;

// Generate OAuth Token for Safaricom Daraja API — STK Push, B2C and B2B all
// route through NCBA now (see initiateSTKPush/initiateB2C/initiateB2B
// below); this token is only needed by registerURLs, which points
// Safaricom's C2B confirmation/validation webhooks at this deployment for
// the Stellar demo-merchant pipeline (see confirmationURL's doc comment).
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
    //
    // For real merchants, also requires merchant.features.inflationShield —
    // "hidden until an admin enables it" (2026-08-11) has to mean the
    // automatic conversion doesn't silently run in the background either,
    // not just that the UI is hidden. !== false (not === true) so this
    // can't change behavior for any merchant who already had the feature on
    // before this per-merchant gate existed — only merchants whose flag is
    // explicitly false (new signups, or one an admin explicitly turned off)
    // are affected.
    if (merchant.stellarPublicKey && (merchant.isDemoMerchant || (AUTO_INFLATION_SHIELD_ENABLED && merchant.features?.inflationShield !== false))) {
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

// @desc    Generate an OPEN-AMOUNT Dynamic QR Code for the merchant's own
//          NCBA Virtual Account — "my QR", a standing code (Wallet page,
//          MyAccounts per-row modal) rather than a one-time checkout. No
//          amount is baked in (NCBA's `amount` field is optional — the
//          customer enters it themselves when they scan), so there's no
//          checkout total to track: this settles through the same generic
//          ncba_inbound account-notification path any other Virtual
//          Account collection does (services/ncbaLedgerService.js), not
//          through STKRequest/resolveStkOutcome — there's no customer
//          surcharge concept for an open amount the merchant didn't set.
//          Replaces the old client-side qrcode.react QR that just encoded
//          a link to PayChain's own /pay/account/:id page — this is a real
//          M-PESA-scannable code instead.
// @route   GET /api/callbacks/account-qr
// @access  Private (merchant)
export const generateAccountQr = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id).select('ncbaMerchantCode ncbaAccountQrCodeDataUri');
    if (!merchant?.ncbaMerchantCode) {
      return res.status(400).json({ error: 'This merchant has no NCBA virtual account assigned yet.' });
    }
    // This QR's content never changes once ncbaMerchantCode is assigned, so
    // a cached copy is always still correct — skip the live NCBA round trip
    // entirely once one exists (that round trip, repeated on every page/
    // modal load, was the source of the reported QR loading delay).
    if (merchant.ncbaAccountQrCodeDataUri) {
      return res.status(200).json({ success: true, qrCodeDataUri: merchant.ncbaAccountQrCodeDataUri });
    }
    const { qrCodeDataUri } = await ncbaGenerateQrCode({ amount: undefined, narration: merchant.ncbaMerchantCode });
    // $set via updateOne, not merchant.save() — the doc above was fetched
    // with a narrow .select(), and .save() would run full-document
    // validation against fields that were never loaded.
    await Merchant.updateOne({ _id: merchant._id }, { $set: { ncbaAccountQrCodeDataUri: qrCodeDataUri } });
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
    const transactionId = `PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { validationId } = await ncbaValidateMobileWalletNumber({ provider, msisdn: phone });
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
      accountNumber: merchant.paybillAccount || 'WALLET_FUND',
      type: 'ncba_mobile_b2w',
      amount: amount,
      kesAmount: amount,
      currency: 'KES',
      status: 'pending',
      reference: transactionId,
      sender: { name: merchant.businessName, id: merchant.paybillAccount },
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
//          as async rather than synchronous like PesaLink/EFT).
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

    const paymentType = billType === 'paybill' ? 'Paybill' : 'Till';

    // Fail fast on a bad destination before ever touching the merchant's
    // balance or asking for their PIN.
    let destination;
    try {
      destination = await ncbaValidateLnmAccount({ paymentType, payBillTillNo: partyB });
    } catch (e) {
      if (e instanceof NcbaOpenBankingValidationError) return res.status(400).json({ error: e.message });
      throw e;
    }

    // NCBA hasn't published a cost schedule for this rail — this is purely
    // PayChain's own flat margin (2026-08-11: flat KES fee, not a percentage
    // cut, per standing instruction). Sourced from the same constant the
    // Transaction pre-save hook's fee calculator reads
    // (config/revenueRateCard.js), so the debit and the persisted
    // paychainFee can never disagree.
    const fee = NCBA_LIPA_NA_MPESA_FLAT_FEE_KES;

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
      accountReference: billType === 'paybill' ? accountReference : undefined,
      recipientName,
      notifyMobileNumber: merchant.phone,
      narration: reference || `Payout to ${partyB}`,
    });

    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount || 'WALLET_FUND',
      type: 'ncba_lipa_na_mpesa',
      amount: numericAmount,
      kesAmount: numericAmount,
      currency: 'KES',
      status: 'pending', // resolved asynchronously via handlePesaLinkCallback
      reference: transactionId,
      sender: { name: merchant.businessName, id: merchant.paybillAccount },
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
