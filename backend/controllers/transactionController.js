import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';

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
