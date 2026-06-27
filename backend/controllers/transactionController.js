import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import PaymentLink from '../models/PaymentLink.js';
import crypto from 'crypto';
import axios from 'axios';
import STKRequest from '../models/STKRequest.js';
import { settleInflationShield, provisionMerchantWallet, getWalletBalance, swapUsdcToKesOnChain } from '../utils/stellarHelper.js';
import { encryptKey } from '../utils/cryptoHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import { sendWalletActivationEmail } from '../utils/resend.js';

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

// @desc    Simulate incoming M-PESA payment
// @route   POST /api/transactions/simulate
// @access  Public (for testing)
export const simulateIncomingPayment = async (req, res) => {
  try {
    const { accountNumber, amount, senderName, senderPhone } = req.body;

    if (!accountNumber || !amount) {
      return res.status(400).json({ error: 'Account number and amount are required' });
    }

    // Find the merchant by paybill account
    const merchant = await Merchant.findOne({ paybillAccount: accountNumber });

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
      if (merchant.kesBalance < amount) {
        return res.status(400).json({ error: 'Insufficient KES balance' });
      }

      const usdcPayoutValue = (amount * liveRate).toFixed(7);
      console.log(`💱 Manual Swap: Converting ${amount} KES to ${usdcPayoutValue} USDC for ${merchant.paybillAccount}`);
      
      merchant.kesBalance -= amount;
      await merchant.save();

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

        merchant.usdcBalance = (merchant.usdcBalance || 0) + parseFloat(usdcPayoutValue);
        await merchant.save();

        res.status(200).json({
          success: true,
          message: 'Swap successful',
          newKesBalance: merchant.kesBalance,
          newUsdcBalance: merchant.usdcBalance,
          txHash
        });

      } catch (e) {
        console.error('❌ KES→USDC swap failed:', e.message);
        merchant.kesBalance += amount;
        await merchant.save();
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

        merchant.kesBalance = (merchant.kesBalance || 0) + kesPayoutValue;
        merchant.usdcBalance = liveUsdcBalance - amount;
        await merchant.save();

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
    const { destination, amount, fee, reference } = req.body;
    const merchantId = req.merchant._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }

    const totalDeduction = Number(amount) + Number(fee || 0);

    // Verify balance
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found.' });
    }

    if (merchant.kesBalance < totalDeduction) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer.' });
    }

    // Deduct balance
    merchant.kesBalance -= totalDeduction;
    await merchant.save();

    // Create Transaction Record
    const transaction = await Transaction.create({
      merchantId,
      receiptNumber: `OUT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      amount: totalDeduction,
      kesAmount: totalDeduction,
      type: 'outbound',
      senderName: 'PayChain Merchant',
      senderPhone: merchant.phone,
      reference: reference || `Transfer to ${destination}`,
    });

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
    
    // Set exactly 24 hours expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

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

// @desc    Get Secure Payment Link Details
// @route   GET /api/transactions/payment-link/:linkId
// @access  Public
export const getPaymentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await PaymentLink.findOne({ linkId }).populate('merchantId', 'businessName paybillAccount');
    
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
      account: link.merchantId.paybillAccount,
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
    const token = req.mpesaToken; // From generateToken middleware
    
    const link = await PaymentLink.findOne({ linkId }).populate('merchantId');
    if (!link || link.status !== 'active') {
      return res.status(400).json({ error: 'Payment link is invalid or expired.' });
    }

    const stkShortCode = '174379'; 
    const passkey = process.env.MPESA_PASSKEY;

    const date = new Date();
    const timestamp = date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    const password = Buffer.from(`${stkShortCode}${passkey}${timestamp}`).toString('base64');
    
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    const url = process.env.NODE_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const data = {
      BusinessShortCode: stkShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: link.amount,
      PartyA: formattedPhone,
      PartyB: stkShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: 'https://shiny-horses-write.loca.lt/api/callbacks/stk-callback', 
      AccountReference: `Link ${linkId}`,
      TransactionDesc: 'Payment Link Settlement'
    };

    const response = await axios.post(url, data, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const checkoutRequestId = response.data.CheckoutRequestID;
    await STKRequest.create({
      merchantId: link.merchantId._id,
      checkoutRequestId,
      amount: link.amount,
      phone: formattedPhone,
      status: 'pending'
    });

    link.status = 'paid';
    await link.save();

    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent to phone' });

  } catch (error) {
    console.error('❌ Payment Link Processing Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to trigger payment on your phone.' });
  }
};
