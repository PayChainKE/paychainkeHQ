import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { settleInflationShield, provisionMerchantWallet } from '../utils/stellarHelper.js';
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

// @desc    Swap KES to USDC manually
// @route   POST /api/transactions/swap
// @access  Private
export const swapKesToUsdc = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const merchant = await Merchant.findById(req.merchant._id);

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (merchant.kesBalance < amount) {
      return res.status(400).json({ error: 'Insufficient KES balance' });
    }

    if (!merchant.stellarPublicKey) {
      return res.status(400).json({ error: 'No Stellar wallet configured for this merchant' });
    }

    // Process Swap
    const liveRate = await getLiveKesToUsdcRate();
    const usdcPayoutValue = (amount * liveRate).toFixed(7);

    console.log(`💱 Manual Swap: Converting ${amount} KES to ${usdcPayoutValue} USDC for ${merchant.paybillAccount}`);
    
    // Deduct immediately to prevent double spending
    merchant.kesBalance -= amount;
    await merchant.save();

    try {
      const txHash = await settleInflationShield(merchant.stellarPublicKey, usdcPayoutValue);
      
      // Log the transaction
      await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount,
        type: 'swap',
        amount: parseFloat(usdcPayoutValue),
        kesAmount: amount,
        currency: 'USDC',
        status: 'completed',
        reference: txHash,
        sender: { name: 'Manual Swap', id: 'MASTER_WALLET' },
        recipient: { name: merchant.businessName, id: merchant.stellarPublicKey }
      });

      // Update USDC balance cache
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
      // Revert if blockchain fails
      console.error('❌ Swap Failed on blockchain:', e.message);
      merchant.kesBalance += amount;
      await merchant.save();
      return res.status(500).json({ error: 'Blockchain settlement failed. Balance refunded.' });
    }

  } catch (error) {
    console.error('❌ Error swapping KES:', error);
    res.status(500).json({ error: 'Server Error: Failed to swap KES' });
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
