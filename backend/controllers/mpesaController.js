import axios from 'axios';
import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { safeSendSMS, buildStrictSms } from '../utils/smsSanitizer.js';
import { calculateMerchantFee, processSplitTransaction, PricingEngineError } from '../utils/pricingEngine.js';
import { sendInvoicePaidReceiptEmail } from '../utils/resend.js';
import { settleInflationShield } from '../utils/stellarHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import STKRequest from '../models/STKRequest.js';
import PayoutBatch from '../models/PayoutBatch.js';
import PaymentLink from '../models/PaymentLink.js';
import Invoice from '../models/Invoice.js';
import { createNotification } from './notificationController.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';

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
    console.log('📥 Received M-PESA Confirmation payload:', payload);

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
    await Transaction.create({
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
        id: MSISDN
      },
      recipient: {
        name: merchant.businessName,
        id: merchant.paybillAccount
      }
    });

    // PayChain's own tiered merchant fee — deducted from the gross receipt
    // before it ever reaches the merchant's balance or the Inflation Shield
    // FX conversion below. Same lookup utils/feeCalculator.js's Transaction
    // pre-save hook uses to stamp paychainFee on the record just created
    // above, so the ledger and this real deduction can never disagree.
    const merchantFee = calculateMerchantFee(amount);
    const netKESAmount = Math.round((amount - merchantFee) * 100) / 100;
    console.log(`💰 M-PESA C2B fee for ${TransID}: gross KES ${amount}, PayChain fee KES ${merchantFee}, net KES ${netKESAmount}`);

    const liveRate = await getLiveKesToUsdcRate();
    const usdcPayoutValue = (netKESAmount * liveRate).toFixed(7);

    // Atomic $inc rather than a read-modify-write on the in-memory `merchant`
    // doc — the gap between fetching `merchant` above and saving here spans
    // several awaits (getLiveKesToUsdcRate, settleInflationShield), during
    // which a concurrent webhook for the same merchant could read the same
    // stale balance and silently clobber it on save(). $inc is race-free
    // regardless of how long this branch takes.
    let updatedMerchant;
    if (merchant.stellarPublicKey) {
      try {
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

    const { date, time } = formatTransactionDateTime(payload.TransTime);

    // Customer receipt SMS, styled after M-Pesa's own confirmation format.
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
              fixed: { ref: TransID, amt: amount.toLocaleString(), phone: MSISDN, date, time, balance: (updatedMerchant.kesBalance || 0).toLocaleString() },
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
    const { amount, phone, merchantId } = req.body;
    const token = req.mpesaToken;

    // Normalise phone to 254XXXXXXXXX
    let formattedPhone = String(phone).replace(/\s+/g, '');
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);

    const intAmount = Math.ceil(Number(amount));

    // ── SANDBOX MODE: full local simulation — NO call to Safaricom ────────────
    // This prevents any real M-PESA deductions during testing. The sandbox
    // simulation auto-confirms after 4 seconds, exactly like the real callback.
    if (!isLive) {
      const checkoutRequestId = `SANDBOX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`🧪 [SANDBOX] Simulating STK Push for ${formattedPhone} KES ${intAmount} | ID: ${checkoutRequestId}`);

      await STKRequest.create({
        merchantId,
        checkoutRequestId,
        amount: intAmount,
        phone: formattedPhone,
        status: 'pending',
      });

      // Auto-confirm after 4 s — simulates the Safaricom callback
      setTimeout(async () => {
        try {
          const stkReq = await STKRequest.findOne({ checkoutRequestId });
          if (!stkReq || stkReq.status !== 'pending') return;

          stkReq.status = 'success';
          stkReq.resultDesc = 'Sandbox simulation — no real money moved';
          await stkReq.save();

          const merchant = await Merchant.findById(merchantId);
          if (merchant) {
            merchant.kesBalance = (merchant.kesBalance || 0) + intAmount;
            await merchant.save();

            await Transaction.create({
              merchantId: merchant._id,
              accountNumber: merchant.paybillAccount || 'WALLET_FUND',
              type: 'top_up',
              amount: intAmount,
              kesAmount: intAmount,
              currency: 'KES',
              status: 'completed',
              reference: `SBX-${checkoutRequestId.slice(-8)}`,
              sender: { name: 'M-PESA Sandbox', id: formattedPhone },
              recipient: { name: merchant.businessName, id: 'WALLET' },
            });
            console.log(`✅ [SANDBOX] Auto-confirmed KES ${intAmount} for merchant ${merchant.paybillAccount}`);
          }
        } catch (e) {
          console.error('❌ [SANDBOX] Auto-confirm error:', e.message);
        }
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
      Amount: intAmount,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${callbackBase}/api/callbacks/stk-callback`,
      AccountReference: 'PayChain Wallet',
      TransactionDesc: 'Wallet Top Up',
    };

    console.log(`📲 [LIVE] STK Push → ${formattedPhone} KES ${intAmount}`);

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
        amount: intAmount,
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
    console.log('📥 STK Push Callback:', JSON.stringify(payload, null, 2));

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = payload;
    
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
            // paychainFee always equals `merchantFee` above exactly. The
            // customer-surcharge portion of PayChain's revenue
            // (paychainTotalRevenue - merchantFee) isn't yet captured on a
            // per-transaction ledger field — tracked via the structured log
            // line above until a dedicated revenue stream/field is added
            // once real surcharge pricing lands.
            await Transaction.create({
              merchantId: merchant._id,
              accountNumber: merchant.paybillAccount || 'WALLET_FUND',
              type: 'inbound',
              amount: link.amount,
              kesAmount: link.amount,
              currency: 'KES',
              status: 'completed',
              reference: receipt,
              sender: { name: 'M-PESA Express', id: stkReq.phone },
              recipient: { name: merchant.businessName, id: merchant.paybillAccount },
            });

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
            const merchantSms = merchant.phone
              ? safeSendSMS({
                  to: merchant.phone,
                  message: `${receipt} Payment Received. KES ${link.amount.toLocaleString()} received via M-PESA (${link.invoiceId ? 'Invoice' : 'Payment Link'}) on ${date} at ${time}. Your updated PayChain available balance is KES ${(updatedMerchant.kesBalance || 0).toLocaleString()}.`,
                }).then((r) => { if (!r.success) console.error(`STK ${payerLabel} merchant SMS failed for ${receipt}:`, r.error); })
              : Promise.resolve();
            await Promise.all([customerSms, merchantSms]);
          }
        }
      } else {
        // Plain wallet top-up.
        // (For STK top up, we skip inflation shield since they are funding their local wallet intentionally)
        const merchant = await Merchant.findById(stkReq.merchantId);
        if (merchant) {
          const updatedMerchant = await Merchant.findByIdAndUpdate(
            merchant._id,
            { $inc: { kesBalance: stkReq.amount } },
            { returnDocument: 'after' }
          );

          await Transaction.create({
            merchantId: merchant._id,
            accountNumber: merchant.paybillAccount || 'WALLET_FUND',
            type: 'top_up',
            amount: stkReq.amount,
            kesAmount: stkReq.amount,
            currency: 'KES',
            status: 'completed',
            reference: receipt,
            sender: { name: 'M-PESA Express', id: stkReq.phone },
            recipient: { name: merchant.businessName, id: 'WALLET' }
          });

          createNotification({
            merchantId: merchant._id,
            kind: 'wallet',
            title: 'Wallet topped up',
            message: `KES ${stkReq.amount.toLocaleString()} was added to your balance via M-PESA.`,
          });

          // Self-funded top-up — one SMS to the merchant's own registered
          // number is enough (no separate "customer" in this flow).
          if (merchant.phone) {
            safeSendSMS({
              to: merchant.phone,
              message: `${receipt} Confirmed. KES ${stkReq.amount.toLocaleString()} added to your PayChain wallet via M-PESA on ${date} at ${time}. Your updated available balance is KES ${(updatedMerchant.kesBalance || 0).toLocaleString()}.`,
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
  try {
    const token = req.mpesaToken;
    const { phone, amount, destination, pin } = req.body;
    const merchantId = req.merchant._id;

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
    const pinMatches = await bcrypt.compare(String(pin), merchantWithPin.appPin);
    if (!pinMatches) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }

    // Atomic conditional deduct — avoids two concurrent B2C requests both
    // passing a stale in-memory balance check and over-withdrawing.
    const merchant = await Merchant.findOneAndUpdate(
      { _id: merchantId, kesBalance: { $gte: amount } },
      { $inc: { kesBalance: -amount } },
      { returnDocument: 'after' }
    );
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer' });
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
        QueueTimeOutURL: `${callbackBase}/api/callbacks/b2c-timeout`,
        ResultURL: `${callbackBase}/api/callbacks/b2c-callback`,
        Occasion: 'PayChain Settlement'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('Daraja B2C API failed, falling back to simulation. Error:', err.response?.data?.errorMessage || err.message);
      b2cRes = { data: { OriginatorConversationID: `SIM_B2C_${Date.now()}` } };
    }

    // Transaction successfully sent to Daraja
    const tx = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount || 'WALLET_FUND',
      type: 'withdrawal',
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
    // earlier failure (e.g. PIN check) never touched the balance.
    if (debited && req.body.amount) {
      await Merchant.findByIdAndUpdate(req.merchant._id, { $inc: { kesBalance: req.body.amount } });
    }
    res.status(500).json({ error: error.response?.data?.errorMessage || 'Failed to initiate Daraja B2C transfer' });
  }
};

export const b2cCallback = async (req, res) => {
  console.log('--- DARAJA B2C CALLBACK RECEIVED ---');
  console.log(JSON.stringify(req.body, null, 2));

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
      await transaction.save();

      let merchantForSms = null;
      if (!succeeded) {
        // The payout never landed — return the funds to the merchant's balance
        merchantForSms = await Merchant.findByIdAndUpdate(
          transaction.merchantId,
          { $inc: { kesBalance: transaction.amount } },
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
