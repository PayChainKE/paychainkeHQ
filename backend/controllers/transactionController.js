import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import PaymentLink from '../models/PaymentLink.js';
import crypto from 'crypto';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import STKRequest from '../models/STKRequest.js';
import { isLive, mpesaBaseUrl, shortCode, passkey, callbackBase, stkCallback } from './mpesaController.js';
import { settleInflationShield, provisionMerchantWallet, getWalletBalance, swapUsdcToKesOnChain } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import { sendWalletActivationEmail, sendStatementEmail } from '../utils/resend.js';
import { createNotification } from './notificationController.js';
import { getCheckoutTotal } from '../utils/pricingEngine.js';
import { safeSendSMS } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { getNcbaVirtualAccountNumber } from '../utils/ncbaValidators.js';

// Resolves either the 12-digit NCBA virtual account number or the 8-digit
// interim merchant code (see getNcbaVirtualAccountNumber) to a merchant.
// A 12-digit input's merchant code is always its last 8 digits, by
// construction — same positional extraction used in
// utils/ncbaAccountNotificationValidators.js.
async function findMerchantByAccountNumber(account) {
  const raw = String(account || '').trim();
  let merchantCode = null;
  if (/^\d{8}$/.test(raw)) merchantCode = raw;
  else if (/^\d{12}$/.test(raw)) merchantCode = raw.slice(-8);
  else return null;
  return Merchant.findOne({ ncbaMerchantCode: merchantCode });
}

// @desc    Get merchant transactions
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ merchantId: req.merchant._id })
      .sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ error: 'Server Error: Failed to fetch transactions' });
  }
};

// @desc    Email the merchant a copy of the statement PDF they just
//          generated in the dashboard (same document, not regenerated).
// @route   POST /api/transactions/statement/email
// @access  Private
export const emailStatement = async (req, res) => {
  try {
    const { pdfBase64, periodLabel, filename } = req.body;

    if (!pdfBase64) return res.status(400).json({ error: 'No statement PDF was provided.' });
    if (!req.merchant.email) return res.status(400).json({ error: 'No email address is on file for this account.' });

    await sendStatementEmail({
      to: req.merchant.email,
      businessName: req.merchant.businessName,
      periodLabel: periodLabel || 'All transactions',
      pdfBase64,
      filename,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error emailing statement:', error);
    res.status(500).json({ error: 'Failed to email the statement.' });
  }
};

// @desc    Simulate incoming M-PESA payment — dev/staging tool only, never
//          reachable in production. Previously public with zero auth and a
//          client-supplied accountNumber, which let anyone credit any
//          merchant's real balance for free; now requires a session and can
//          only ever credit the caller's own account.
// @route   POST /api/transactions/simulate
// @access  Private (non-production only)
export const simulateIncomingPayment = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { amount, senderName, senderPhone } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Always the caller's own account — never trust a client-supplied one.
    const merchant = await Merchant.findById(req.merchant._id);

    if (!merchant) {
      return res.status(404).json({ error: 'No merchant found with this account number' });
    }

    // Generate a mock M-PESA receipt (e.g., SGH2D8X1P)
    const receipt = Math.random().toString(36).substring(2, 11).toUpperCase();

    // Create the transaction
    const transaction = await Transaction.create({
      merchantId: merchant._id,
      accountNumber: merchant.paybillAccount,
      type: 'inbound',
      amount: Number(amount),
      kesAmount: Number(amount),
      currency: 'KES',
      status: 'completed',
      reference: receipt,
      sender: {
        name: senderName || 'JOHN DOE',
        id: senderPhone || '254700000000'
      },
      recipient: {
        name: merchant.businessName,
        id: merchant.paybillAccount
      }
    });

    // Update merchant's balance
    merchant.kesBalance = (merchant.kesBalance || 0) + Number(amount);
    await merchant.save();

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${Number(amount).toLocaleString()} from ${senderName || 'a customer'} via your PayChain Account Number ${merchant.paybillAccount}.`,
    });

    res.status(201).json({
      message: 'Payment simulated successfully',
      transaction,
      newBalance: merchant.kesBalance
    });
  } catch (error) {
    console.error('❌ Error simulating payment:', error);
    res.status(500).json({ error: 'Server Error: Failed to simulate payment' });
  }
};

// @desc    Swap KES to USDC or USDC to KES manually
// @route   POST /api/transactions/swap
// @access  Private
export const swapKesToUsdc = async (req, res) => {
  try {
    const { amount, direction = 'KES_TO_USDC' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const merchant = await Merchant.findById(req.merchant._id).select('+stellarEncryptedSecretKey');

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (!merchant.stellarPublicKey) {
      return res.status(400).json({ error: 'No Stellar wallet configured for this merchant' });
    }

    const liveRate = await getLiveKesToUsdcRate(); // Returns USDC per 1 KES

    if (direction === 'KES_TO_USDC') {
      // Atomic conditional deduct — avoids two concurrent swaps both
      // passing a stale in-memory balance check.
      const debited = await Merchant.findOneAndUpdate(
        { _id: merchant._id, kesBalance: { $gte: amount } },
        { $inc: { kesBalance: -amount } },
        { returnDocument: 'after' }
      );
      if (!debited) {
        return res.status(400).json({ error: 'Insufficient KES balance' });
      }

      const usdcPayoutValue = (amount * liveRate).toFixed(7);
      console.log(`💱 Manual Swap: Converting ${amount} KES to ${usdcPayoutValue} USDC for ${merchant.paybillAccount}`);

      try {
        const txHash = await settleInflationShield(merchant.stellarPublicKey, usdcPayoutValue);

        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.paybillAccount,
          type: 'fx_swap',
          amount: parseFloat(usdcPayoutValue),
          kesAmount: amount,
          usdcAmount: parseFloat(usdcPayoutValue),
          currency: 'USDC',
          status: 'completed',
          reference: txHash,
          sender: { name: 'Manual Swap', id: 'MASTER_WALLET' },
          recipient: { name: merchant.businessName, id: merchant.stellarPublicKey }
        });

        const credited = await Merchant.findByIdAndUpdate(
          merchant._id,
          { $inc: { usdcBalance: parseFloat(usdcPayoutValue) } },
          { returnDocument: 'after' }
        );

        if (merchant.phone) {
          const { date, time } = formatTransactionDateTime();
          safeSendSMS({
            to: merchant.phone,
            message: `Swap Confirmed. KES ${Number(amount).toLocaleString()} converted to ${usdcPayoutValue} USDC on ${date} at ${time}. New KES balance: KES ${debited.kesBalance.toLocaleString()}.`,
          }).then((result) => {
            if (!result.success) console.error(`Swap SMS failed for merchant ${merchant._id}:`, result.error);
          });
        }

        res.status(200).json({
          success: true,
          message: 'Swap successful',
          newKesBalance: debited.kesBalance,
          newUsdcBalance: credited.usdcBalance,
          txHash
        });

      } catch (e) {
        console.error('❌ KES→USDC swap failed:', e.message);
        await Merchant.findByIdAndUpdate(merchant._id, { $inc: { kesBalance: amount } });
        return res.status(500).json({ error: e.message || 'Blockchain settlement failed. KES balance refunded.' });
      }
    } else if (direction === 'USDC_TO_KES') {
      const liveUsdcBalance = await getWalletBalance(merchant.stellarPublicKey);
      if (liveUsdcBalance < amount) {
        return res.status(400).json({ error: 'Insufficient USDC balance' });
      }

      const kesPayoutValue = amount / liveRate;
      console.log(`💱 Manual Swap: Converting ${amount} USDC to ${kesPayoutValue} KES for ${merchant.paybillAccount}`);

      try {
        const txHash = await swapUsdcToKesOnChain(merchant.stellarEncryptedSecretKey, amount);

        // usdcBalance is set (not $inc'd) to match the just-fetched live
        // chain balance minus this swap — kesBalance is a pure atomic
        // credit, consistent with the KES_TO_USDC branch above.
        const updated = await Merchant.findByIdAndUpdate(
          merchant._id,
          { $inc: { kesBalance: kesPayoutValue }, $set: { usdcBalance: liveUsdcBalance - amount } },
          { returnDocument: 'after' }
        );
        merchant.kesBalance = updated.kesBalance;
        merchant.usdcBalance = updated.usdcBalance;

        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.paybillAccount,
          type: 'fx_swap',
          amount: kesPayoutValue,
          kesAmount: kesPayoutValue,
          usdcAmount: amount,
          currency: 'KES',
          status: 'completed',
          reference: txHash,
          sender: { name: merchant.businessName, id: merchant.stellarPublicKey },
          recipient: { name: 'Manual Swap', id: 'MASTER_WALLET' }
        });

        if (merchant.phone) {
          const { date, time } = formatTransactionDateTime();
          safeSendSMS({
            to: merchant.phone,
            message: `Swap Confirmed. ${Number(amount).toLocaleString()} USDC converted to KES ${kesPayoutValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} on ${date} at ${time}. New KES balance: KES ${merchant.kesBalance.toLocaleString()}.`,
          }).then((result) => {
            if (!result.success) console.error(`Swap SMS failed for merchant ${merchant._id}:`, result.error);
          });
        }

        res.status(200).json({
          success: true,
          message: 'Swap successful',
          newKesBalance: merchant.kesBalance,
          newUsdcBalance: merchant.usdcBalance,
          txHash
        });
      } catch (e) {
        console.error('❌ USDC→KES sweep failed:', e.message);
        return res.status(500).json({ error: e.message || 'Blockchain sweep failed. USDC was not converted.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid swap direction' });
    }

  } catch (error) {
    console.error('❌ Error swapping currency:', error);
    res.status(500).json({ error: 'Server Error: Failed to swap currency' });
  }
};

// @desc    Activate Digital Wallet (Provision Stellar)
// @route   POST /api/transactions/activate-wallet
// @access  Private
export const activateWallet = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (merchant.stellarPublicKey) {
      return res.status(400).json({ error: 'Wallet is already activated' });
    }

    console.log(`🌟 Activating digital wallet for ${merchant.paybillAccount}...`);
    
    const stellarWallet = await provisionMerchantWallet();
    
    merchant.stellarPublicKey = stellarWallet.publicKey;
    merchant.stellarEncryptedSecretKey = encryptKey(stellarWallet.secretKey);
    await merchant.save();

    // Send congratulations email with the newly activated wallet address
    console.log(`📧 Dispatching Wallet Activation Congratulations Email to: ${merchant.email}`);
    sendWalletActivationEmail(merchant.email, merchant.name, merchant.stellarPublicKey).catch(err => {
      console.error(`📧 Resend Error: Failed to send wallet activation email to ${merchant.email}:`, err);
    });

    createNotification({
      merchantId: merchant._id,
      kind: 'wallet',
      title: 'Digital Wallet activated',
      message: 'Your PayChain digital wallet is now active and ready to receive USDC settlements.',
    });

    res.status(200).json({
      success: true,
      message: 'Wallet activated successfully',
      stellarPublicKey: merchant.stellarPublicKey
    });

  } catch (error) {
    console.error('❌ Error activating wallet:', error.message);
    res.status(500).json({ error: 'Failed to activate digital wallet' });
  }
};

// @desc    Get live KES to USDC rate
// @route   GET /api/transactions/live-rate
// @access  Private
export const getLiveRate = async (req, res) => {
  try {
    const rateUsdcPerKes = await getLiveKesToUsdcRate();
    const rateKesPerUsdc = 1 / rateUsdcPerKes;
    res.json({ success: true, rate: rateKesPerUsdc });
  } catch (error) {
    console.error('❌ Error fetching live rate:', error.message);
    res.status(500).json({ error: 'Failed to fetch live rate' });
  }
};

// @desc    Simulate sending money (Move Money)
// @route   POST /api/transactions/send-money
// @access  Private
export const sendMoney = async (req, res) => {
  try {
    const { destination, amount, fee, reference, pin } = req.body;
    const merchantId = req.merchant._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'Payment PIN is required.' });
    }

    const totalDeduction = Number(amount) + Number(fee || 0);

    const merchantWithPin = await Merchant.findById(merchantId).select('+appPin');
    if (!merchantWithPin) {
      return res.status(404).json({ error: 'Merchant not found.' });
    }
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

    // Atomic conditional deduct — avoids the read-then-write race of
    // fetching balance, checking it, then saving separately, where two
    // concurrent requests could both pass the check against the same
    // starting balance.
    const merchant = await Merchant.findOneAndUpdate(
      { _id: merchantId, kesBalance: { $gte: totalDeduction } },
      { $inc: { kesBalance: -totalDeduction } },
      { returnDocument: 'after' }
    );
    if (!merchant) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer.' });
    }

    const ref = `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const transaction = await Transaction.create({
      merchantId,
      accountNumber: merchant.paybillAccount,
      amount: totalDeduction,
      kesAmount: totalDeduction,
      currency: 'KES',
      type: 'withdrawal',
      status: 'completed',
      reference: ref,
      sender: { name: merchant.businessName, id: merchant.phone },
      recipient: { name: reference || destination || 'Withdrawal', id: destination },
    });

    if (merchant.phone) {
      const { date, time } = formatTransactionDateTime();
      safeSendSMS({
        to: merchant.phone,
        message: `${ref} Sent. KES ${totalDeduction.toLocaleString()} sent to ${reference || destination || 'recipient'} on ${date} at ${time}. New balance: KES ${merchant.kesBalance.toLocaleString()}.`,
      }).then((result) => {
        if (!result.success) console.error(`Send-money SMS failed for merchant ${merchant._id}:`, result.error);
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully transferred ${amount} KES.`,
      transaction,
      newBalance: merchant.kesBalance
    });

  } catch (error) {
    console.error('❌ Error in sendMoney:', error);
    res.status(500).json({ error: 'Server Error: Failed to process transfer' });
  }
};

// @desc    Sync Merchant Wallet Balance from Stellar Blockchain
// @route   POST /api/transactions/sync-wallet
// @access  Private
export const syncWalletBalance = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id);

    if (!merchant || !merchant.stellarPublicKey) {
      return res.status(400).json({ error: 'Digital Wallet not activated' });
    }

    const liveBalance = await getWalletBalance(merchant.stellarPublicKey);
    
    // If the live on-chain balance is strictly greater, it means an external deposit occurred.
    // If it's different in any way, sync the DB to match the chain.
    if (liveBalance !== merchant.usdcBalance) {
      console.log(`🔄 Syncing ledger for ${merchant.businessName}: ${merchant.usdcBalance} -> ${liveBalance}`);
      
      // Optionally log external deposits
      if (liveBalance > (merchant.usdcBalance || 0)) {
        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.paybillAccount,
          type: 'inbound',
          amount: liveBalance - (merchant.usdcBalance || 0),
          kesAmount: 0,
          currency: 'USDC',
          status: 'completed',
          reference: 'External Deposit',
          sender: { name: 'External Wallet', id: 'Blockchain' },
          recipient: { name: merchant.businessName, id: merchant.stellarPublicKey }
        });
      }

      merchant.usdcBalance = liveBalance;
      await merchant.save();
    }

    res.status(200).json({ success: true, usdcBalance: liveBalance });
  } catch (error) {
    console.error('❌ Error syncing wallet:', error);
    res.status(500).json({ error: 'Server Error: Failed to sync wallet' });
  }
};

// @desc    Generate Secure Payment Link
// @route   POST /api/transactions/payment-link
// @access  Private
export const generatePaymentLink = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }

    const merchant = await Merchant.findById(req.merchant._id);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found.' });
    }

    // Generate secure 8-character ID
    const linkId = crypto.randomBytes(4).toString('hex');
    
    // Every payment link on the platform expires exactly 48 hours after creation.
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const paymentLink = await PaymentLink.create({
      merchantId: merchant._id,
      linkId,
      amount: Number(amount),
      expiresAt,
      status: 'active'
    });

    // Note: The frontend will construct the absolute URL using window.location.origin
    const url = `/pay/${linkId}`;

    res.status(201).json({
      success: true,
      linkId: paymentLink.linkId,
      url,
      expiresAt: paymentLink.expiresAt
    });

  } catch (error) {
    console.error('❌ Error generating payment link:', error);
    res.status(500).json({ error: 'Failed to generate secure payment link.' });
  }
};

// @desc    List merchant's recent payment links
// @route   GET /api/transactions/payment-link
// @access  Private
export const listPaymentLinks = async (req, res) => {
  try {
    const links = await PaymentLink.find({ merchantId: req.merchant._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      links: links.map((link) => ({
        linkId: link.linkId,
        amount: link.amount,
        currency: link.currency,
        status: link.status,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error listing payment links:', error);
    res.status(500).json({ error: 'Failed to fetch payment link history.' });
  }
};

// @desc    Get Secure Payment Link Details
// @route   GET /api/transactions/payment-link/:linkId
// @access  Public
export const getPaymentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await PaymentLink.findOne({ linkId }).populate('merchantId', 'businessName ncbaMerchantCode');

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found or has expired.' });
    }

    if (link.status !== 'active') {
      return res.status(400).json({ error: `This payment link is ${link.status}.` });
    }

    res.json({
      success: true,
      amount: link.amount,
      currency: link.currency,
      merchantName: link.merchantId.businessName,
      // Was merchant.paybillAccount (PayChain's internal 5-digit STK
      // reference) mislabeled as "account" — same conflation bug fixed
      // everywhere else this session. Customers here should see the real
      // PayChain Account, not an internal reference that means nothing to
      // them.
      account: getNcbaVirtualAccountNumber(link.merchantId.ncbaMerchantCode) || link.merchantId.ncbaMerchantCode || 'Pending',
      expiresAt: link.expiresAt
    });
  } catch (error) {
    console.error('❌ Error fetching payment link:', error);
    res.status(500).json({ error: 'Failed to fetch payment link details.' });
  }
};

// @desc    Process Payment for Secure Link
// @route   POST /api/transactions/payment-link/:linkId/pay
// @access  Public
export const processPaymentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const { phone } = req.body;

    const link = await PaymentLink.findOne({ linkId }).populate('merchantId');
    if (!link || link.status !== 'active') {
      return res.status(400).json({ error: 'Payment link is invalid or expired.' });
    }

    let formattedPhone = String(phone || '').trim();
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    // Checkout initializer: the amount actually prompted on the customer's
    // handset — base bill + PayChain's customer surcharge (currently 0
    // until pricing sheets are finalized, see utils/pricingEngine.js).
    // Computed once, up front, so what the customer sees and approves on
    // their phone already includes any surcharge — never added silently
    // after the fact. stkCallback re-derives the split from this same total
    // plus link.amount (the base) once Safaricom confirms.
    const checkoutTotal = getCheckoutTotal(link.amount);

    // ── SANDBOX MODE: local simulation, no real Safaricom call ──────────────
    // Mirrors mpesaController.js#initiateSTKPush's sandbox branch — no live
    // money at risk, and no dependency on Safaricom's sandbox-specific
    // shortcode/passkey pairing (which differ from this deploy's real
    // MPESA_SHORTCODE/MPESA_PASSKEY, reserved for live use only). The
    // simulated confirmation is fed through the real stkCallback handler
    // (by linkId) so it exercises the exact same completion logic — link/
    // invoice status, ledger credit, notifications, SMS — as a real payment
    // would, rather than a second hand-maintained copy of that logic.
    if (!isLive) {
      const checkoutRequestId = `SANDBOX-LINK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`🧪 [SANDBOX] Simulating Payment Link STK Push for ${formattedPhone} KES ${checkoutTotal} (base KES ${link.amount}) | Link: ${linkId}`);

      await STKRequest.create({
        merchantId: link.merchantId._id,
        checkoutRequestId,
        linkId: link.linkId,
        amount: checkoutTotal,
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
                CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: `SBXLINK-${checkoutRequestId.slice(-8)}` }] },
              },
            },
          },
        };
        const fakeRes = { status: () => ({ json: () => {} }) };
        stkCallback(fakeReq, fakeRes).catch((e) => console.error('❌ [SANDBOX] Payment link auto-confirm error:', e.message));
      }, 4000);

      return res.status(200).json({
        success: true,
        checkoutRequestId,
        message: '[Sandbox] STK simulated — funds will confirm in ~4 seconds. No real money moved.',
      });
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────
    if (process.env.MPESA_LIVE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Live M-PESA payments are not enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
    }
    if (!shortCode || !passkey) {
      return res.status(500).json({ error: 'STK Push not fully configured (MPESA_SHORTCODE / MPESA_PASSKEY missing).' });
    }
    if (!callbackBase) {
      return res.status(500).json({ error: 'MPESA_CALLBACK_URL is not set.' });
    }

    const token = req.mpesaToken; // From generateToken middleware — same mpesaBaseUrl this call targets

    const date = new Date();
    const timestamp = date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const data = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: checkoutTotal,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${callbackBase}/api/callbacks/stk-callback`,
      AccountReference: `Link ${linkId}`,
      TransactionDesc: 'Payment Link Settlement'
    };

    const response = await axios.post(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const checkoutRequestId = response.data.CheckoutRequestID;
    await STKRequest.create({
      merchantId: link.merchantId._id,
      checkoutRequestId,
      linkId: link.linkId,
      amount: checkoutTotal,
      phone: formattedPhone,
      status: 'pending'
    });

    // Do NOT mark the link/invoice paid here — the customer has only just
    // received the STK prompt and may still cancel or fail to enter their
    // PIN. The real Safaricom confirmation lands on stkCallback, which
    // resolves this STKRequest by linkId and flips status there.

    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent to phone' });

  } catch (error) {
    console.error('❌ Payment Link Processing Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to trigger payment on your phone.' });
  }
};

// @desc    Look up a merchant by their PayChain Account number (the 12-digit
//          NCBA virtual account, or the 8-digit interim merchant code before
//          NCBA's institution prefix is assigned) — powers the static
//          "Settlement QR" every merchant has on their Wallet page, as
//          opposed to a one-off, fixed-amount PaymentLink above. The
//          customer picks their own amount on the next screen.
// @route   GET /api/transactions/pay-account/:account
// @access  Public
export const getMerchantByAccount = async (req, res) => {
  try {
    const merchant = await findMerchantByAccountNumber(req.params.account);
    if (!merchant || merchant.status === 'locked') {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json({
      success: true,
      merchantName: merchant.businessName,
      account: getNcbaVirtualAccountNumber(merchant.ncbaMerchantCode) || merchant.ncbaMerchantCode,
    });
  } catch (error) {
    console.error('❌ Error fetching merchant by account:', error);
    res.status(500).json({ error: 'Failed to fetch account details.' });
  }
};

// @desc    Pay an arbitrary amount directly to a merchant's PayChain Account
//          number — the open-amount counterpart to processPaymentLink above
//          (which settles one specific, pre-set-amount link). Reuses the
//          exact same STKRequest + stkCallback machinery: creating the
//          STKRequest with no linkId routes the confirmation through
//          stkCallback's plain-wallet-top-up branch, crediting this
//          merchant directly — no new completion-handling logic needed.
// @route   POST /api/transactions/pay-account/:account
// @access  Public
export const payToMerchantAccount = async (req, res) => {
  try {
    const merchant = await findMerchantByAccountNumber(req.params.account);
    if (!merchant || merchant.status === 'locked') {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount.' });
    }

    let formattedPhone = String(req.body.phone || '').trim();
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    const checkoutTotal = getCheckoutTotal(amount);

    // ── SANDBOX MODE — mirrors processPaymentLink's sandbox branch exactly. ──
    if (!isLive) {
      const checkoutRequestId = `SANDBOX-ACCT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      console.log(`🧪 [SANDBOX] Simulating direct-account STK Push for ${formattedPhone} KES ${checkoutTotal} → merchant ${merchant._id}`);

      await STKRequest.create({
        merchantId: merchant._id,
        checkoutRequestId,
        amount: checkoutTotal,
        baseAmount: amount,
        kind: 'pay_account',
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
                CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: `SBXACCT-${checkoutRequestId.slice(-8)}` }] },
              },
            },
          },
        };
        const fakeRes = { status: () => ({ json: () => {} }) };
        stkCallback(fakeReq, fakeRes).catch((e) => console.error('❌ [SANDBOX] Direct-account auto-confirm error:', e.message));
      }, 4000);

      return res.status(200).json({
        success: true,
        checkoutRequestId,
        message: '[Sandbox] STK simulated — funds will confirm in ~4 seconds. No real money moved.',
      });
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────
    if (process.env.MPESA_LIVE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Live M-PESA payments are not enabled. Set MPESA_LIVE_ENABLED=true to activate.' });
    }
    if (!shortCode || !passkey) {
      return res.status(500).json({ error: 'STK Push not fully configured (MPESA_SHORTCODE / MPESA_PASSKEY missing).' });
    }
    if (!callbackBase) {
      return res.status(500).json({ error: 'MPESA_CALLBACK_URL is not set.' });
    }

    const token = req.mpesaToken;

    const date = new Date();
    const timestamp = date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const data = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: checkoutTotal,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${callbackBase}/api/callbacks/stk-callback`,
      AccountReference: `Acct ${req.params.account}`,
      TransactionDesc: 'Direct Account Payment',
    };

    const response = await axios.post(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const checkoutRequestId = response.data.CheckoutRequestID;
    await STKRequest.create({
      merchantId: merchant._id,
      checkoutRequestId,
      amount: checkoutTotal,
      baseAmount: amount,
      kind: 'pay_account',
      phone: formattedPhone,
      status: 'pending',
    });

    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent to phone' });

  } catch (error) {
    console.error('❌ Direct Account Payment Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to trigger payment on your phone.' });
  }
};
