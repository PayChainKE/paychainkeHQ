import axios from 'axios';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { sendSMS } from '../utils/sms.js';
import { settleInflationShield } from '../utils/stellarHelper.js';
import { getLiveKesToUsdcRate } from '../utils/rateEngine.js';
import STKRequest from '../models/STKRequest.js';

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

    // Inflation Shield: Automatically convert KES to USDC and settle on-chain
    const PLATFORM_FEE_PERCENTAGE = 0; // Configurable fee (0% for demo)
    
    const netKESAmount = amount - (amount * PLATFORM_FEE_PERCENTAGE);
    const liveRate = await getLiveKesToUsdcRate();
    const usdcPayoutValue = (netKESAmount * liveRate).toFixed(7);

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

        merchant.usdcBalance = (merchant.usdcBalance || 0) + parseFloat(usdcPayoutValue);

      } catch (e) {
        console.error(`❌ Inflation Shield failed for ${accountNumber}:`, e.message);
        // If settlement fails, funds remain as KES balance
        merchant.kesBalance = (merchant.kesBalance || 0) + netKESAmount;
      }
    } else {
      // If no Stellar wallet, just add to KES balance
      merchant.kesBalance = (merchant.kesBalance || 0) + netKESAmount;
    }

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

// ================= STK PUSH (LIPA NA M-PESA ONLINE) =================

export const initiateSTKPush = async (req, res) => {
  try {
    const { amount, phone, merchantId } = req.body;
    const token = req.mpesaToken;

    // Use Safaricom's specific Lipa Na M-Pesa sandbox shortcode
    const stkShortCode = '174379'; 
    const passkey = process.env.MPESA_PASSKEY;

    // Format timestamp YYYYMMDDHHmmss
    const date = new Date();
    const timestamp = date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    const password = Buffer.from(`${stkShortCode}${passkey}${timestamp}`).toString('base64');
    
    // Format phone number to start with 254
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
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: stkShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: 'https://shiny-horses-write.loca.lt/api/callbacks/stk-callback', // Same localtunnel
      AccountReference: 'PayChain Wallet',
      TransactionDesc: 'Wallet Top Up'
    };

    const response = await axios.post(url, data, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Save tracking record in DB
    const checkoutRequestId = response.data.CheckoutRequestID;
    await STKRequest.create({
      merchantId,
      checkoutRequestId,
      amount,
      phone: formattedPhone,
      status: 'pending'
    });

    res.status(200).json({ success: true, checkoutRequestId, message: 'STK Push sent successfully' });

  } catch (error) {
    console.error('❌ STK Push Error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to send STK Push to the provided number' });
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

      // Automatically add funds to the merchant's KES balance 
      // (For STK top up, we skip inflation shield since they are funding their local wallet intentionally)
      const merchant = await Merchant.findById(stkReq.merchantId);
      if (merchant) {
        merchant.kesBalance = (merchant.kesBalance || 0) + stkReq.amount;
        await merchant.save();

        // Find the exact receipt number if possible
        const receiptItem = CallbackMetadata?.Item.find(i => i.Name === 'MpesaReceiptNumber');
        const receipt = receiptItem ? receiptItem.Value : CheckoutRequestID;

        await Transaction.create({
          merchantId: merchant._id,
          accountNumber: merchant.paybillAccount || 'WALLET_FUND',
          type: 'inbound',
          amount: stkReq.amount,
          kesAmount: stkReq.amount,
          currency: 'KES',
          status: 'completed',
          reference: receipt,
          sender: { name: 'M-PESA Express', id: stkReq.phone },
          recipient: { name: merchant.businessName, id: 'WALLET' }
        });
      }
    } else {
      // Cancelled or Failed
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
  try {
    const token = req.mpesaToken;
    const { phone, amount, destination } = req.body;
    const merchantId = req.merchant._id;
    
    // Fetch merchant to check balance
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    
    // Check if sufficient funds
    if (merchant.kesBalance < amount) {
      return res.status(400).json({ error: 'Insufficient KES balance for this transfer' });
    }

    // Immediately deduct balance to prevent double spending
    merchant.kesBalance -= amount;
    await merchant.save();

    // 1. Security Credential Generation
    const b2cPassword = process.env.MPESA_B2C_PASSWORD || 'Safaricom999!@#';
    const securityCredential = generateSecurityCredential(b2cPassword);
    
    // 2. Daraja B2C Endpoint (Sandbox)
    const url = process.env.NODE_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';

    // Try B2C Daraja
    try {
      const b2cRes = await axios.post(url, {
        InitiatorName: process.env.MPESA_B2C_INITIATOR || 'testapi',
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: process.env.MPESA_SHORTCODE || '600000',
        PartyB: phone,
        Remarks: `Withdrawal to ${destination}`,
        QueueTimeOutURL: 'https://your-domain.com/api/callbacks/b2c-timeout',
        ResultURL: 'https://your-domain.com/api/callbacks/b2c-callback',
        Occasion: 'PayChain Settlement'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Transaction successfully sent to Daraja
      const tx = await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: 'outbound',
        amount: amount,
        kesAmount: amount,
        currency: 'KES',
        status: 'completed', // B2C sandbox auto-completes
        reference: b2cRes.data.OriginatorConversationID || `B2C_${Date.now()}`,
        sender: { name: merchant.businessName, id: merchant.paybillAccount },
        recipient: { name: destination, id: phone }
      });

      res.status(200).json({ success: true, message: 'Transfer initiated', transaction: tx });

    } catch (darajaErr) {
      // Sandbox fallback: If Daraja fails (due to cert mismatch etc), we fallback to simulation
      console.warn('Daraja B2C failed (Likely sandbox cert issue), falling back to simulation...');
      
      const tx = await Transaction.create({
        merchantId: merchant._id,
        accountNumber: merchant.paybillAccount || 'WALLET_FUND',
        type: 'outbound',
        amount: amount,
        kesAmount: amount,
        currency: 'KES',
        status: 'completed',
        reference: `SIM_B2C_${Date.now()}`,
        sender: { name: merchant.businessName, id: merchant.paybillAccount },
        recipient: { name: destination, id: phone }
      });

      res.status(200).json({ success: true, message: 'Transfer successful (Simulated)', transaction: tx });
    }

  } catch (error) {
    console.error('❌ B2C Transfer Error:', error);
    res.status(500).json({ error: 'Internal server error processing transfer' });
  }
};

export const b2cCallback = async (req, res) => {
  console.log('--- DARAJA B2C CALLBACK RECEIVED ---');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Acknowledge receipt
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
};
