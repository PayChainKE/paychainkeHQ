import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import PaymentLink from '../models/PaymentLink.js';
import STKRequest from '../models/STKRequest.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { initiateAndTrackNcbaStk } from './mpesaController.js';
import { settleInflationShield, provisionMerchantWallet, getWalletBalance, swapUsdcToKesOnChain } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import { sendWalletActivationEmail, sendStatementEmail } from '../utils/resend.js';
import { createNotification } from './notificationController.js';
import { getCheckoutTotal, getInvoiceCheckoutTotal, calculateCustomerSurcharge, calculateInvoiceClientMarkup, PricingEngineError } from '../utils/pricingEngine.js';
import { safeSendSMS, formatKes } from '../utils/smsSanitizer.js';
import { formatTransactionDateTime } from '../utils/transactionDateFormat.js';
import { assertPinNotLocked, recordFailedPinAttempt, resetPinAttempts, PinLockedError } from '../utils/pinLockout.js';
import { getNcbaVirtualAccountNumber, validatePhoneNumber, NcbaValidationError } from '../utils/ncbaValidators.js';
import { generateMerchantStickerPdf } from '../utils/stickerGenerator.js';
import { claimPayoutSubmission, DuplicateSubmissionError } from '../utils/idempotencyGuard.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';

// Transfers at or above this amount get an admin visibility alert — not a
// block, just a heads-up. Configurable since "large" depends on the
// merchant base's real transaction sizes; defaults to a conservative
// KES 500,000 in case the env var is unset.
const LARGE_TRANSACTION_ALERT_KES = Number(process.env.LARGE_TRANSACTION_ALERT_KES) || 500_000;

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

// @desc    Download the branded PayChain/NCBA paybill sticker (PDF), filled
//          in with this merchant's own business name and real 12-digit
//          account number.
// @route   GET /api/transactions/sticker
// @access  Private
export const downloadSticker = async (req, res) => {
  try {
    const accountNumber = getNcbaVirtualAccountNumber(req.merchant.ncbaMerchantCode);
    if (!accountNumber) {
      return res.status(400).json({ error: 'Your bank account number is still being assigned — the sticker will be available once that\'s complete.' });
    }

    const pdfBytes = await generateMerchantStickerPdf({
      businessName: req.merchant.businessName,
      accountNumber,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PayChain-Sticker-${accountNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('❌ Error generating sticker:', error);
    res.status(500).json({ error: 'Failed to generate sticker.' });
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
      accountNumber: merchant.ncbaMerchantCode,
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
        id: merchant.ncbaMerchantCode
      }
    });

    // Update merchant's balance
    merchant.kesBalance = (merchant.kesBalance || 0) + Number(amount);
    await merchant.save();

    createNotification({
      merchantId: merchant._id,
      kind: 'payment',
      title: 'Payment received',
      message: `You received KES ${Number(amount).toLocaleString()} from ${senderName || 'a customer'} via your PayChain Account Number ${merchant.ncbaMerchantCode}.`,
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

    // Same server-side enforcement as activateWallet above — the client-side
    // FeatureGuard alone doesn't stop a direct API call. This endpoint backs
    // BOTH the Wallet page (digitalWallet) and Inflation Shield page
    // (inflationShield), so only block when an admin has explicitly turned
    // off both — turning off just one shouldn't silently break the other.
    if (merchant.features && merchant.features.digitalWallet === false && merchant.features.inflationShield === false) {
      return res.status(403).json({ error: 'This feature is not available on your account right now.' });
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
      console.log(`💱 Manual Swap: Converting ${amount} KES to ${usdcPayoutValue} USDC for ${merchant.ncbaMerchantCode}`);

      try {
        const txHash = await settleInflationShield(merchant.stellarPublicKey, usdcPayoutValue);

        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.ncbaMerchantCode,
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
            message: `Swap Confirmed. Ksh ${formatKes(amount)} converted to ${usdcPayoutValue} USDC on ${date} at ${time}. New KES balance: Ksh ${formatKes(debited.kesBalance)}.`,
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
      console.log(`💱 Manual Swap: Converting ${amount} USDC to ${kesPayoutValue} KES for ${merchant.ncbaMerchantCode}`);

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
          accountNumber: merchant.ncbaMerchantCode,
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
            message: `Swap Confirmed. ${Number(amount).toLocaleString()} USDC converted to Ksh ${formatKes(kesPayoutValue)} on ${date} at ${time}. New KES balance: Ksh ${formatKes(merchant.kesBalance)}.`,
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

    // The frontend only hides the Wallet page behind FeatureGuard when this
    // is false — that's UI convenience, not enforcement. Without this check
    // any merchant could call this endpoint directly regardless of whether
    // an admin explicitly disabled digital wallet access on their account.
    if (merchant.features && merchant.features.digitalWallet === false) {
      return res.status(403).json({ error: 'Digital wallet is not available on your account right now.' });
    }

    if (merchant.stellarPublicKey) {
      return res.status(400).json({ error: 'Wallet is already activated' });
    }

    console.log(`🌟 Activating digital wallet for ${merchant.ncbaMerchantCode}...`);
    
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
    // fee is client-supplied — a negative value would make totalDeduction
    // negative, which passes the kesBalance >= totalDeduction check for
    // free and then credits the merchant via $inc: { kesBalance:
    // -totalDeduction }. Same guard as bulkPayController.js's batch rows.
    const numericFee = Number(fee || 0);
    if (!Number.isFinite(numericFee) || numericFee < 0) {
      return res.status(400).json({ error: 'Invalid fee.' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'Payment PIN is required.' });
    }

    const totalDeduction = Number(amount) + numericFee;

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

    // Same fingerprint-based dedup used by B2C/B2B/bulk-pay/bank-transfer —
    // this endpoint was the one payout path without it, so a double-click
    // or a client's automatic retry on a slow response could double-debit
    // the merchant before this.
    try {
      await claimPayoutSubmission(merchantId, ['send-money', destination, amount, reference]);
    } catch (e) {
      if (e instanceof DuplicateSubmissionError) return res.status(409).json({ error: e.message });
      throw e;
    }

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

    if (totalDeduction >= LARGE_TRANSACTION_ALERT_KES) {
      notifyAdmins({
        type: 'large_transaction',
        severity: 'info',
        subject: 'Large transfer sent',
        heading: 'Large Transaction Alert',
        details: `Merchant <strong>${escapeHtml(merchant.businessName || merchant.phone)}</strong> sent <strong>KES ${totalDeduction.toLocaleString()}</strong> to ${escapeHtml(reference || destination || 'a recipient')}.`,
        metadata: { merchantId: String(merchant._id), amount: totalDeduction, destination: reference || destination || null },
      });
    }

    const ref = `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const transaction = await Transaction.create({
      merchantId,
      accountNumber: merchant.ncbaMerchantCode,
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
        message: `${ref} Sent. Ksh ${formatKes(totalDeduction)} sent to ${reference || destination || 'recipient'} on ${date} at ${time}. New balance: Ksh ${formatKes(merchant.kesBalance)}.`,
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
          accountNumber: merchant.ncbaMerchantCode,
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

    // Same fee/total the STK prompt will actually charge (processPaymentLink
    // uses this exact invoiceId branch below) — shown up front here since
    // NCBA's STK Push payload has no room for a fee breakdown, only a
    // single total Amount (see getCheckoutPreview's doc comment above).
    const fee = link.invoiceId ? calculateInvoiceClientMarkup(link.amount) : calculateCustomerSurcharge(link.amount);

    res.json({
      success: true,
      amount: link.amount,
      fee,
      total: Math.round((link.amount + fee) * 100) / 100,
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

    // Public route — validate strictly rather than best-effort normalise,
    // since anyone on the internet can hit this (rate-limited, but not
    // otherwise authenticated) and this number becomes both the STK
    // destination and the stored transaction counterparty.
    let formattedPhone;
    try {
      formattedPhone = validatePhoneNumber(phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
      throw e;
    }

    // Checkout initializer: the amount actually prompted on the customer's
    // handset — base bill + PayChain's customer-facing markup. Computed
    // once, up front, so what the customer sees and approves on their phone
    // already includes any surcharge — never added silently after the fact.
    // resolveStkOutcome re-derives the split from this same total plus
    // link.amount (the base) once the payment is confirmed. An
    // invoice-backed link (link.invoiceId set) uses the Electronic
    // Invoicing tariff's own Client Markup schedule instead of the standard
    // Hosted Payment Link one — see utils/pricingEngine.js.
    const checkoutTotal = link.invoiceId
      ? getInvoiceCheckoutTotal(link.amount)
      : getCheckoutTotal(link.amount);

    // Real STK Push via NCBA's shared Paybill 880100 (or simulated — see
    // services/ncbaStkPushService.js's NCBA_STK_LIVE_ENABLED gate).
    const checkoutRequestId = await initiateAndTrackNcbaStk({
      merchantId: link.merchantId._id,
      phone: formattedPhone,
      checkoutTotal,
      extra: { linkId: link.linkId },
    });
    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent to phone' });

  } catch (error) {
    console.error('❌ Payment Link Processing Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to trigger payment on your phone.' });
  }
};

// @desc    Public STK status poll for the three unauthenticated checkout
//          pages (PaymentPage/PayAccountPage/InvoiceView — no merchant JWT
//          to gate on, unlike getSTKStatus in mpesaController.js which is
//          protectMerchant-scoped). These pages previously showed a fixed
//          `setTimeout` "Payment triggered successfully" message with no
//          real confirmation — a customer whose M-Pesa PIN was wrong,
//          cancelled, or timed out still saw "success". checkoutRequestId
//          is a bank-issued opaque transaction reference (not a guessable
//          sequence) only ever handed to the customer who just triggered
//          this exact STK push, and this only ever returns a bare
//          status/message — same minimal shape as the authenticated
//          version, no amount/merchant/phone detail — so exposing it
//          without a merchant JWT carries the same trust model as the
//          public payment-link/pay-account lookups already on this router.
// @route   GET /api/transactions/public-stk-status/:checkoutId
// @access  Public (rate-limited at the route layer)
export const getPublicSTKStatus = async (req, res) => {
  try {
    const { checkoutId } = req.params;
    const stkReq = await STKRequest.findOne({ checkoutRequestId: checkoutId });
    if (!stkReq) return res.status(404).json({ error: 'Request not found' });

    res.status(200).json({
      status: stkReq.status,
      resultDesc: stkReq.resultDesc,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching payment status' });
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

// @desc    Preview the customer-facing fee breakdown for a given amount,
//          BEFORE the STK prompt is triggered. NCBA's STK Push API has no
//          free-text/description field (TelephoneNo, Amount, PayBillNo,
//          AccountNo, Network, TransactionType only — confirmed against
//          NCBA's own spec) — the actual M-PESA prompt on the customer's
//          phone is a fixed Safaricom template showing just the total
//          Amount, so a fee line can never appear inside the prompt
//          itself. This is the next best thing: reuses the exact same
//          calculateCustomerSurcharge the real charge uses (never a
//          separate/duplicated calculation that could drift), so what the
//          customer sees here always matches what they're actually
//          charged.
// @route   GET /api/transactions/checkout-preview?amount=X
// @access  Public
export const getCheckoutPreview = (req, res) => {
  const baseAmount = Number(req.query.amount);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return res.status(400).json({ error: 'A valid amount is required.' });
  }
  try {
    const fee = calculateCustomerSurcharge(baseAmount);
    res.json({ success: true, baseAmount, fee, total: Math.round((baseAmount + fee) * 100) / 100 });
  } catch (err) {
    if (err instanceof PricingEngineError) return res.status(400).json({ error: err.message });
    console.error('❌ Error computing checkout preview:', err);
    res.status(500).json({ error: 'Failed to calculate transaction fee.' });
  }
};

// @desc    Pay an arbitrary amount directly to a merchant's PayChain Account
//          number — the open-amount counterpart to processPaymentLink above
//          (which settles one specific, pre-set-amount link). Reuses the
//          exact same STKRequest machinery: creating the STKRequest with no
//          linkId routes the eventual resolution through
//          resolveStkOutcome's plain-wallet-top-up branch, crediting this
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

    // Public route — same reasoning as processPaymentLink above: validate
    // strictly rather than best-effort normalise.
    let formattedPhone;
    try {
      formattedPhone = validatePhoneNumber(req.body.phone);
    } catch (e) {
      if (e instanceof NcbaValidationError) return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
      throw e;
    }

    const checkoutTotal = getCheckoutTotal(amount);

    // Real STK Push via NCBA's shared Paybill 880100 (or simulated — see
    // services/ncbaStkPushService.js's NCBA_STK_LIVE_ENABLED gate).
    const checkoutRequestId = await initiateAndTrackNcbaStk({
      merchantId: merchant._id,
      phone: formattedPhone,
      checkoutTotal,
      extra: { baseAmount: amount, kind: 'pay_account' },
    });
    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent to phone' });

  } catch (error) {
    console.error('❌ Direct Account Payment Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to trigger payment on your phone.' });
  }
};
