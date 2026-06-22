import axios from 'axios';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { sendSMS } from '../utils/sms.js';

// Configuration from environment variables
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortCode = process.env.MPESA_SHORTCODE;
const passkey = process.env.MPESA_PASSKEY;

// Generate OAuth Token for Safaricom Daraja API
export const generateToken = async (req, res, next) => {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    // Default to sandbox for safety if not in production
    const url = process.env.NODE_ENV === 'production' 
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    req.mpesaToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('❌ M-PESA Token Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to generate M-PESA access token' });
  }
};

// Register C2B URLs
export const registerURLs = async (req, res) => {
  try {
    const token = req.mpesaToken;
    const { validationUrl, confirmationUrl } = req.body;

    const url = process.env.NODE_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl'
      : 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl';

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

    // Update merchant's real-time KES balance
    merchant.kesBalance = (merchant.kesBalance || 0) + amount;
    await merchant.save();

    console.log(`✅ Successfully processed M-PESA payment of KES ${amount} for account ${accountNumber}`);

    // Send SMS notification to the customer
    if (MSISDN) {
      const smsMessage = `Confirmed. Ksh${amount.toLocaleString()} paid to ${merchant.businessName} (Acc: ${merchant.paybillAccount}). Ref: ${TransID}. Thank you for your payment.`;
      await sendSMS(MSISDN, smsMessage);
    }

  } catch (error) {
    console.error('❌ M-PESA Confirmation Webhook Error:', error);
    // Safaricom expects a 200 even if internal processing fails to avoid retries
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal Failure' });
  }
};
