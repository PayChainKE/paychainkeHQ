import React, { useState, useEffect, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import domtoimage from 'dom-to-image'
import { ValidatedInput } from '../components/ValidatedInput'
import { useNavigate } from 'react-router-dom'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useNotification } from '../context/NotificationContext'
import { isValidPhoneKE } from '../utils/validators'
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay'
import paychainLogo from '../assets/paychain-logo-dark.png'
import paychainLogoWhite from '../assets/paychain-logo-white.png'
import axios from 'axios'
import FundAccountModal from '../components/modals/FundAccountModal'

export default function BulkPay() {
  const { showAmounts } = usePrivacyMode()
  const { addNotification } = useNotification()
  const { merchant, refreshSession } = useMerchantAuth()
  const [payeesList, setPayeesList] = useState([])
  const navigate = useNavigate()
  
  const isProfileComplete = Boolean(merchant?.kraPin && merchant?.businessNumber)
  
  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const token = localStorage.getItem('paychain_merchant_token')
        if (!token) return;
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const res = await axios.get(`${API_URL}/api/bulkpay/payees`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // The rest of this page reads `p.id` (added/updated payees get it
        // attached locally in handleSavePayee) — the raw API response only
        // has Mongo's `_id`, so without this every payee loaded on initial
        // fetch has `id === undefined`, silently breaking edit (PUTs to
        // /payees/undefined) for any payee that isn't brand new this session.
        // Same story for `salary`/`amount` — the Saved Payees sidebar reads
        // `p.salary || p.amount`, which handleSavePayee sets locally but the
        // raw fetch never did, so it showed "KES 0.00" for every payee that
        // wasn't just added/edited in the current session.
        const mapped = res.data.map(p => ({ ...p, id: p._id, salary: p.defaultAmount, amount: p.defaultAmount }))
        setPayeesList(mapped)

        // payoutAmounts is separate local state (it holds the amount the
        // merchant is about to pay right now, editable per-batch) and was
        // never seeded from each payee's saved `defaultAmount` — so every
        // time this page reloaded, previously-set amounts appeared to
        // "disappear" back to 0 even though they were still saved on the
        // payee record. Seed it here, without clobbering anything already
        // in progress in this session.
        setPayoutAmounts(prev => {
          const next = { ...prev }
          mapped.forEach(p => {
            if (next[p.id] === undefined) next[p.id] = p.defaultAmount || 0
          })
          return next
        })
      } catch (error) {
        console.error('Error fetching payees:', error)
      }
    }
    fetchPayees()
  }, [])
  const [activeFilter, setActiveFilter] = useState('All')
  const [step, setStep] = useState(1)
  
  // Add Payee Modal State
  // Add/Edit Payee Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStep, setAddStep] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [selectedPayees, setSelectedPayees] = useState({})
  const [payoutAmounts, setPayoutAmounts] = useState({})

  const [newPayee, setNewPayee] = useState({
    name: '',
    type: 'Employee',
    utilityType: 'Electricity',
    utilityProvider: '',
    paymentMethod: 'Mobile Money',
    mobileMoneyType: 'Personal Number',
    mobileNetwork: 'safaricom',
    amount: '',
    phone: '',
    accountNumber: '',
    bankName: '',
    bankCode: '',
    paybillNumber: '',
    businessAccount: '',
    tillNumber: '',
    kraPin: '',
    idNumber: '',
    nssfNumber: '',
    shifNumber: '',
    etimsInvoiceNumber: '',
    cuNumber: ''
  })

  // Bank-routed payees need a real NCBA clearing code (bankCode), not just a
  // free-text bank name — authorizeBatch on the backend refuses to route a
  // payout without one. Fetched lazily (same pattern as SendMoney.jsx's
  // Bank destination picker) so payees who never touch Bank never pay for it.
  const [bankCodes, setBankCodes] = useState([])
  useEffect(() => {
    if (newPayee.paymentMethod !== 'Bank' || bankCodes.length > 0) return
    const token = localStorage.getItem('paychain_merchant_token')
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    axios.get(`${API_URL}/api/v1/openbanking/bank-codes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBankCodes(res.data?.bankCodes || []))
      .catch(e => console.error('Failed to load bank codes', e))
  }, [newPayee.paymentMethod])

  // Utility meter verification (KPLC/NCWSC) — pure UX confirmation before
  // saving a payee (shows the merchant the real account holder name +
  // balance due so a typo'd meter number is caught early). Deliberately
  // not persisted: the validationId NCBA returns here is not reused at
  // payment time — the backend re-validates immediately before every
  // actual payout, since a saved payee might not be paid for weeks (see
  // backend's validateKplcMeter/validateNcwscMeter doc comments).
  const [utilityCheck, setUtilityCheck] = useState({ status: 'idle', customerName: '', serviceName: '', balance: null, error: '' })
  const resetUtilityCheck = () => setUtilityCheck({ status: 'idle', customerName: '', serviceName: '', balance: null, error: '' })
  const DEDICATED_RAIL_UTILITIES = ['KPLC', 'KPLC_PREPAID', 'WATER']

  // Filter payees based on active tab
  const filteredPayees = payeesList.filter(p => {
    if (activeFilter === 'All') return true;
    const filterMap = {
      'Employees': 'employee',
      'Suppliers': 'supplier',
      'Utilities': 'utility'
    };
    return (p.type?.toLowerCase() || '') === filterMap[activeFilter].toLowerCase();
  });

  const togglePayee = (id) => {
    setSelectedPayees((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const updateAmount = (id, val) => {
    const num = parseFloat(val.replace(/,/g, ''))
    if (!isNaN(num)) {
      setPayoutAmounts((prev) => ({ ...prev, [id]: num }))
    }
  }

  const handleOpenEdit = (p) => {
    setNewPayee({
      name: p.name,
      type: p.type.charAt(0).toUpperCase() + p.type.slice(1),
      // Only meaningful for Utility payees — defaulting this to 'Electricity'
      // for every payee regardless of type used to make the KPLC Postpaid/
      // Prepaid toggle (gated on utilityType alone, not type) incorrectly
      // appear while editing a Contractor/Employee/Supplier.
      utilityType: p.utilityProvider === 'WATER' ? 'Water' : (p.utilityProvider === 'KPLC' || p.utilityProvider === 'KPLC_PREPAID') ? 'Electricity' : '',
      utilityProvider: p.utilityProvider || '',
      paymentMethod: p.paymentMethod || 'Mobile Money',
      mobileMoneyType: p.mobileMoneyType || 'Personal Number',
      mobileNetwork: p.mobileNetwork || 'safaricom',
      amount: (p.salary || p.amount || 0).toString(),
      phone: p.phone || '',
      accountNumber: p.accountNumber || '',
      bankName: p.bankName || '',
      bankCode: p.bankCode || '',
      paybillNumber: p.paybillNumber || '',
      businessAccount: p.businessAccount || '',
      tillNumber: p.tillNumber || '',
      kraPin: p.kraPin || '',
      idNumber: p.idNumber || '',
      nssfNumber: p.nssfNumber || '',
      shifNumber: p.shifNumber || '',
      etimsInvoiceNumber: p.etimsInvoiceNumber || '',
      cuNumber: p.cuNumber || ''
    });
    resetUtilityCheck();
    setEditingId(p.id);
    setIsEditing(true);
    setAddStep(2);
    setShowAddModal(true);
  }

  const handleDeletePayee = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this payee?')) return;
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      await axios.delete(`${API_URL}/api/bulkpay/payees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayeesList(prev => prev.filter(p => p._id !== id && p.id !== id));
      addNotification({ title: 'Deleted', message: 'Payee has been removed successfully.', type: 'success' });
    } catch (error) {
      console.error('Failed to delete payee:', error);
      addNotification({ title: 'Error', message: 'Failed to delete payee. Please try again.', type: 'error' });
    }
  };

  const UTILITY_VALIDATE_ENDPOINT = { KPLC: 'validate-kplc-meter', KPLC_PREPAID: 'validate-kplc-prepaid-meter', WATER: 'validate-ncwsc-meter' }
  const handleVerifyUtilityMeter = async () => {
    if (!/^\d{5,15}$/.test(newPayee.accountNumber?.trim() || '')) {
      addNotification({ title: 'Invalid Format', message: 'Enter a valid numeric meter number.', type: 'error' });
      return;
    }
    if (!isValidPhoneKE(newPayee.phone)) {
      addNotification({ title: 'Invalid Format', message: 'Enter a valid Kenyan phone number for bill notifications.', type: 'error' });
      return;
    }
    const endpoint = UTILITY_VALIDATE_ENDPOINT[newPayee.utilityProvider]
    if (!endpoint) return;
    setUtilityCheck({ status: 'loading', customerName: '', serviceName: '', balance: null, error: '' });
    try {
      const token = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.post(`${API_URL}/api/bulkpay/${endpoint}`, {
        meterNumber: newPayee.accountNumber.trim(),
        msisdn: newPayee.phone,
      }, { headers: { Authorization: `Bearer ${token}` } })
      setUtilityCheck({
        status: 'success',
        customerName: res.data?.customerName || '',
        serviceName: res.data?.serviceName || '',
        balance: typeof res.data?.balance === 'number' ? res.data.balance : null,
        error: '',
      });
    } catch (error) {
      setUtilityCheck({ status: 'error', customerName: '', serviceName: '', balance: null, error: error.response?.data?.message || 'Could not verify this meter number.' });
    }
  };

  const handleSavePayee = async () => {
    if (!newPayee.name) {
      addNotification({ title: 'Missing Info', message: 'Recipient name is required.', type: 'error' });
      return;
    }

    // KPLC/NCWSC payees route through NCBA's dedicated biller rails, not a
    // Mobile Money/Bank settlement method — accountNumber/phone here mean
    // meter number/notification msisdn, validated against the same shape
    // the backend's authorizeBatch will actually pay against.
    if (newPayee.type === 'Utility' && DEDICATED_RAIL_UTILITIES.includes(newPayee.utilityProvider)) {
      if (!/^\d{5,15}$/.test(newPayee.accountNumber?.trim() || '')) {
        addNotification({ title: 'Invalid Format', message: 'Enter a valid numeric meter number.', type: 'error' });
        return;
      }
      if (!isValidPhoneKE(newPayee.phone)) {
        addNotification({ title: 'Invalid Format', message: 'Enter a valid Kenyan phone number for bill notifications.', type: 'error' });
        return;
      }
    } else if (newPayee.paymentMethod === 'Mobile Money') {
      if (newPayee.mobileMoneyType === 'Personal Number') {
        if (!isValidPhoneKE(newPayee.phone)) {
          addNotification({ title: 'Invalid Format', message: 'Please enter a valid Kenyan phone number (07..., 01..., +2547..., +2541...).', type: 'error' });
          return;
        }
      } else if (newPayee.mobileMoneyType === 'Paybill') {
        if (!/^\d{5,7}$/.test(newPayee.paybillNumber?.trim())) {
          addNotification({ title: 'Invalid Format', message: 'Paybill Number must be exactly 5 to 7 digits.', type: 'error' });
          return;
        }
        if (!newPayee.businessAccount?.trim() || newPayee.businessAccount.length > 20) {
          addNotification({ title: 'Invalid Format', message: 'Account Number is required and must not exceed 20 characters.', type: 'error' });
          return;
        }
      } else if (newPayee.mobileMoneyType === 'Buy Goods') {
        if (!/^\d{6,8}$/.test(newPayee.tillNumber?.trim())) {
          addNotification({ title: 'Invalid Format', message: 'Till Number must be exactly 6 to 8 digits.', type: 'error' });
          return;
        }
      }
    } else if (newPayee.paymentMethod === 'Bank') {
      // bankCode (not just a bank name) is what actually routes the payout
      // through NCBA PesaLink — without it, authorizeBatch refuses to pay
      // this payee at all and silently refunds the row.
      if (!newPayee.bankCode) {
        addNotification({ title: 'Invalid Format', message: 'Select the payee\'s bank.', type: 'error' });
        return;
      }
      if (!/^\d{8,14}$/.test(newPayee.accountNumber?.trim())) {
        addNotification({ title: 'Invalid Format', message: 'Bank Account Number must be between 8 and 14 digits.', type: 'error' });
        return;
      }
    }

    const numericAmount = parseFloat(newPayee.amount.replace(/,/g, '')) || 0;
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const payload = {
        ...newPayee,
        type: newPayee.type.toLowerCase(),
        defaultAmount: numericAmount
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

      if (isEditing) {
        const res = await axios.put(`${API_URL}/api/bulkpay/payees/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const updated = {
          ...res.data,
          id: res.data._id,
          salary: res.data.defaultAmount,
          amount: res.data.defaultAmount
        };

        setPayeesList(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
        setPayoutAmounts(prev => ({ ...prev, [editingId]: numericAmount }));
        addNotification({
          title: 'Payee Updated',
          message: `${newPayee.name}'s details have been saved.`,
          type: 'success'
        });
      } else {
        const res = await axios.post(`${API_URL}/api/bulkpay/payees`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const entry = {
          ...res.data,
          id: res.data._id, // map mongo id
          salary: res.data.defaultAmount,
          amount: res.data.defaultAmount
        };

        setPayeesList(prev => [entry, ...prev]);
        setPayoutAmounts(prev => ({ ...prev, [entry.id]: numericAmount }));
        addNotification({
          title: 'Payee Added',
          message: `${newPayee.name} has been added to your ${newPayee.type} list.`,
          type: 'success'
        });
      }

      setShowAddModal(false);
      setIsEditing(false);
      setEditingId(null);
      setAddStep(1);
    } catch (error) {
      addNotification({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save payee',
        type: 'error'
      });
    }

    resetUtilityCheck();
    setNewPayee({
      name: '',
      type: 'Employee',
      utilityType: 'Electricity',
      utilityProvider: '',
      paymentMethod: 'Mobile Money',
      mobileMoneyType: 'Personal Number',
      mobileNetwork: 'safaricom',
      amount: '',
      phone: '',
      accountNumber: '',
      bankName: '',
      bankCode: '',
      paybillNumber: '',
      businessAccount: '',
      tillNumber: '',
      kraPin: '',
      idNumber: '',
      nssfNumber: '',
      shifNumber: '',
      etimsInvoiceNumber: '',
      cuNumber: ''
    });
  }

  const csvInputRef = React.useRef(null);
  const [csvPreview, setCsvPreview] = useState(null);

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    addNotification({ title: 'Processing CSV', message: 'Analyzing batch payment data...', type: 'info' });
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.post(`${API_URL}/api/bulkpay/upload-csv`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setCsvPreview(res.data);
      addNotification({ title: 'CSV Loaded', message: res.data.message, type: 'success' });
      setStep(1); // Reset step or jump to a special review step
    } catch (error) {
      addNotification({ title: 'Upload Failed', message: error.response?.data?.message || 'Could not process CSV', type: 'error' });
    }
  };

  // Fund Account — showFundModal opens a small method picker; picking one
  // hands off to the shared FundAccountModal (same component
  // Overview.jsx/Wallet.jsx use) for the actual STK-push/bank/paybill flow,
  // instead of duplicating it here.
  const [showFundModal, setShowFundModal] = useState(false)
  const [activeFundMethod, setActiveFundMethod] = useState(null)
  const [selectedTill, setSelectedTill] = useState(null)

  // Security Verification Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [securityStep, setSecurityStep] = useState(1) // 1: OTP, 2: PIN
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpResendCooldown, setOtpResendCooldown] = useState(0)

  // Real, working SMS-OTP infrastructure (merchantSmsAuthController.js) —
  // this modal used to just require 4+ arbitrary characters be typed with
  // no backend call at all, so no OTP was ever actually sent. Reusing the
  // same send/verify endpoints the merchant SMS-login 2FA flow uses.
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

  const sendBulkPayOtp = useCallback(async () => {
    if (!merchant?.phone) {
      setOtpError('No phone number is on file for this account. Add one in Profile first.')
      return
    }
    setIsSendingOtp(true)
    setOtpError('')
    try {
      await axios.post(`${API_BASE}/api/auth/merchant/sms/send-otp`, { phone: merchant.phone })
      setOtpResendCooldown(30)
    } catch (error) {
      setOtpError(error.response?.data?.error || 'Could not send the verification code. Try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }, [merchant?.phone, API_BASE])

  useEffect(() => {
    if (otpResendCooldown <= 0) return
    const t = setTimeout(() => setOtpResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [otpResendCooldown])

  const verifyBulkPayOtp = async () => {
    setIsVerifyingOtp(true)
    setOtpError('')
    try {
      await axios.post(`${API_BASE}/api/auth/merchant/sms/verify-otp`, { phone: merchant?.phone, otp })
      setSecurityStep(2)
    } catch (error) {
      setOtpError(error.response?.data?.error || 'Invalid or expired code.')
      setOtp('')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const maskedPhone = (() => {
    const p = formatPhoneDisplay(merchant?.phone)
    if (!/^0\d{9}$/.test(p || '')) return merchant?.phone || 'your registered number'
    return `${p.slice(0, 4)} ${p.slice(4, 7).replace(/./g, '•')} ${p.slice(7)}`
  })()

  const handleSecurityVerification = () => {
    // Keep modals open until success or let handleAuthorize manage them
    handleAuthorize(pin)
  }

  const [showPinSetupModal, setShowPinSetupModal] = useState(false)
  const [setupPin, setSetupPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    if (merchant) {
      // Bulk pay authorizes with the same single Payment PIN used
      // everywhere else in the app (sendMoney, B2C/B2B) — no separate
      // bulk-pay PIN anymore.
      if (merchant.hasAppPin === false) {
        setShowPinSetupModal(true)
      } else {
        setShowPinSetupModal(false)
      }
    }
  }, [merchant])

  const handleSetupPin = async () => {
    if (setupPin.length !== 4 || setupPin !== confirmPin) {
      addNotification({ title: 'Error', message: 'PINs do not match or are invalid.', type: 'error' });
      return;
    }
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/auth/merchant/set-app-pin`, { pin: setupPin }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowPinSetupModal(false);
      addNotification({ title: 'Success', message: 'Payment PIN set successfully.', type: 'success' });
      // Ideally update auth context here, but reloading or forcing state is fine.
      window.location.reload();
    } catch (error) {
      addNotification({ title: 'Error', message: error.response?.data?.message || 'Failed to set PIN', type: 'error' });
    }
  }

  const batchTotal = Object.keys(selectedPayees)
    .filter((id) => selectedPayees[id])
    .reduce((sum, id) => sum + (payoutAmounts[id] || 0), 0)

  const balance = merchant?.kesBalance ?? 0
  const isLiquidityLow = batchTotal > balance

  const [authorizedReceipts, setAuthorizedReceipts] = useState([])
  const [isAuthorizing, setIsAuthorizing] = useState(false)

  const handleAuthorize = async () => {
    if (isAuthorizing) return
    setIsAuthorizing(true)
    try {
      addNotification({ title: 'Processing', message: 'Authorizing batch...', type: 'info' });
      const token = localStorage.getItem('paychain_merchant_token');

      let batchRows = [];
      if (csvPreview) {
        batchRows = csvPreview.rows;
      } else {
        batchRows = payeesList
          .filter(p => selectedPayees[p.id])
          .map(p => ({
            payeeMatch: p.id,
            name: p.name,
            type: p.type,
            phone: p.phone,
            grossAmount: payoutAmounts[p.id] || 0,
            netAmount: payoutAmounts[p.id] || 0, // Preview only — for Employee payees the backend recalculates PAYE/NSSF/SHIF authoritatively in authorizeBatch and overrides this
          }));
      }

      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.post(`${API_URL}/api/bulkpay/authorize`, {
        batchRows,
        fundingSource: selectedTill || 'Main Business Till',
        pin: pin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const processedBatch = res.data.batch;

      // Transform response to match frontend receipts. `status` is carried
      // through now — it used to be dropped here, so every receipt card
      // rendered as "Confirmed / Settled" even for rows that actually
      // failed (blocked/rejected by NCBA) and were refunded back to the
      // merchant's balance. See the status-aware rendering below.
      const newReceipts = processedBatch.transactions.map(tx => ({
        id: tx.receiptNumber,
        name: tx.name,
        amount: tx.amount,
        method: tx.method,
        phone: tx.accountReference,
        reference: processedBatch.batchReference,
        status: tx.status, // 'completed' | 'pending' | 'failed'
        timestamp: new Date().toLocaleString('en-KE', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      }));

      setAuthorizedReceipts(newReceipts);
      setStep(4);
      setCsvPreview(null); // Clear preview

      // Balance was just debited server-side — refresh now instead of
      // waiting for the ambient 5s poll in MerchantAuthContext, so the
      // sidebar/Overview balance reflects this payout immediately.
      refreshSession();
      fetchBatchHistory();

      const failedCount = newReceipts.filter(r => r.status === 'failed').length;
      const allFailed = failedCount > 0 && failedCount === newReceipts.length;
      addNotification({
        title: allFailed ? 'Batch Failed' : failedCount > 0 ? 'Batch Partially Processed' : 'Batch Processed',
        message: failedCount > 0
          ? `${failedCount} of ${newReceipts.length} payout${newReceipts.length === 1 ? '' : 's'} failed and ${failedCount === 1 ? 'was' : 'were'} refunded to your balance. ${res.data.message}`
          : res.data.message,
        type: allFailed ? 'error' : failedCount > 0 ? 'warning' : 'success'
      });
    } catch (error) {
      addNotification({
        title: 'Authorization Failed',
        message: error.response?.data?.message || 'Could not process batch',
        type: 'error'
      });
      // Allow retry for PIN if it fails
      if (error.response?.status === 401) {
         setPin('');
      } else {
         setShowSecurityModal(false);
      }
    } finally {
      setIsAuthorizing(false)
    }
  }

  const downloadReceipt = async (receipt) => {
    addNotification({ title: 'Generating PDF', message: `Preparing receipt for ${receipt.name}.`, type: 'info' });
    const element = document.getElementById(`receipt-${receipt.id}`);
    if (element) {
      try {
        const dataUrl = await domtoimage.toPng(element, { bgcolor: '#ffffff' });
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [element.clientWidth, element.clientHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, element.clientWidth, element.clientHeight);
        pdf.save(`Receipt_${receipt.id}.pdf`);
        addNotification({ title: 'Download Complete', message: `Receipt ${receipt.id}.pdf has been saved.`, type: 'success' });
      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to generate PDF: ' + err.message, type: 'error' });
      }
    }
  };

  const downloadAllReceipts = () => {
    addNotification({ title: 'Processing', message: 'Generating batch receipts...', type: 'info' });
    setTimeout(() => {
      try {
        const pdf = new jsPDF();
        let y = 20;
        const reportDate = new Date().toLocaleString('en-KE', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Logo — transparent PNG, aspect-correct (source 968x230)
        const logoW = 32, logoH = logoW * (230 / 968);
        try { pdf.addImage(paychainLogo, 'PNG', 20, y - 8, logoW, logoH, undefined, 'FAST') } catch (_) {}
        y += logoH + 6;

        // Header
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text('PAYCHAIN FINANCE - BATCH DISBURSEMENT REPORT', 20, y);
        y += 10;

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Date: ${reportDate}`, 20, y);
        y += 8;
        pdf.text(`Total Recipients: ${authorizedReceipts.length}`, 20, y);
        y += 8;
        pdf.text(`Total Payout: ${formatKES(batchTotal)}`, 20, y);
        y += 15;
        
        pdf.setDrawColor(150);
        pdf.line(20, y, 190, y);
        y += 15;

        // Receipts Iteration
        authorizedReceipts.forEach((r, idx) => {
          if (y > 270) {
            pdf.addPage();
            y = 20;
          }
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text(`Receipt No: ${r.id}`, 20, y);
          y += 8;
          pdf.setFont("helvetica", "normal");
          pdf.text(`Recipient: ${r.name}`, 20, y);
          y += 8;
          pdf.text(`Account/Phone: ${formatPhoneDisplay(r.phone) || r.phone}`, 20, y);
          y += 8;
          pdf.text(`Amount: ${formatKES(r.amount)}`, 20, y);
          y += 8;
          pdf.text(`Reference: ${r.reference}`, 20, y);
          y += 8;
          pdf.text(`Method: ${r.method}`, 20, y);
          y += 15;
          pdf.setDrawColor(220);
          pdf.line(20, y, 190, y);
          y += 10;
        });

        pdf.save(`Batch_Receipts_${new Date().getTime()}.pdf`);
        addNotification({ title: 'Download Complete', message: 'Batch receipts downloaded successfully as PDF.', type: 'success' });
      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to generate Batch PDF: ' + (err.message || err.toString()), type: 'error' });
      }
    }, 1000);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedPayees({});
    setAuthorizedReceipts([]);
    // Optionally keep payoutAmounts or reset them
  }

  return (
    <MerchantLayout title="Bulk Payments">
      <div className="relative">
        {!isProfileComplete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A2540]/90 backdrop-blur-xl p-8 md:p-12 rounded-[32px] md:rounded-[40px] text-center shadow-2xl max-w-lg w-full border border-white/10 animate-fade-in-up">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 text-white/50">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>
              <h2 className="font-headline text-2xl md:text-3xl font-bold text-white mb-3">Profile Incomplete</h2>
              <p className="text-sm md:text-base text-white/70 mb-8 leading-relaxed">
                To unlock Bulk Payments and ensure full regulatory compliance, please add your KRA PIN and Business License Number to your profile.
              </p>
              <button 
                onClick={() => navigate('/profile')}
                className="w-full bg-emerald-500 text-[#06201B] px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-white transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Complete Profile Now
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
        
        <div className={`px-1 lg:px-0 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8 relative transition-all duration-500 ${!isProfileComplete ? 'blur-md pointer-events-none opacity-40 select-none' : ''}`}>
        
        {/* Add/Edit Payee Modal Overlay */}
        {showAddModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-[32px] md:rounded-[40px] shadow-2xl animate-in zoom-in duration-500 border border-white/20 flex flex-col overflow-hidden">
              <div className="p-6 md:p-10 pb-0 shrink-0">
                <div className="flex items-center justify-between mb-6 md:mb-10">
                  <div>
                    <h2 className="font-headline text-2xl md:text-3xl text-primary tracking-tight font-bold">{isEditing ? 'Edit Recipient' : 'Add New Recipient'}</h2>
                    <p className="text-[10px] md:text-xs text-on-surface-variant font-medium mt-1 opacity-60 italic">Step {addStep} of 2: {addStep === 1 ? 'Category Selection' : 'Payment Details'}</p>
                  </div>
                  <button
                    onClick={() => { setShowAddModal(false); setAddStep(1); setIsEditing(false); }}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>

              {/* flex-1 min-h-0 is load-bearing here, not decorative — without it
                  a flex child defaults to min-height:auto, so it grows to fit
                  all its content instead of being capped at the space left
                  under the header, and overflow-y-auto never gets a chance to
                  kick in. That was silently clipping the Save button below
                  the fold on long forms (e.g. Employee) with no way to
                  scroll to it. */}
              <div className="px-6 md:px-10 pb-6 md:pb-10 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                {addStep === 1 ? (
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'employee', label: 'Employee', icon: 'badge', desc: 'Payroll & Salaries' },
                      { id: 'supplier', label: 'Supplier', icon: 'inventory_2', desc: 'Logistics & Stock' },
                      { id: 'utility', label: 'Utility', icon: 'account_balance', desc: 'Rent, Power, Water' },
                      { id: 'contractor', label: 'Contractor', icon: 'engineering', desc: 'One-off Services' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setNewPayee({...newPayee, type: cat.label}); setAddStep(2); }}
                        className={`group relative flex items-center justify-between py-3 px-4 rounded-xl border transition-all duration-300 ${
                          newPayee.type === cat.label 
                            ? 'border-emerald-500 bg-emerald-500/[0.02] shadow-sm scale-[1.005]' 
                            : 'border-outline-variant/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01]'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {/* Selection Tick (Before Icon) */}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${
                            newPayee.type === cat.label 
                              ? 'bg-[#00351D] border-[#00351D] text-white' 
                              : 'border-outline-variant/20 group-hover:border-emerald-500/50'
                          }`}>
                            {newPayee.type === cat.label && <span className="material-symbols-outlined text-[8px] font-black">check</span>}
                          </div>

                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            newPayee.type === cat.label ? 'bg-[#00351D] text-white' : 'bg-surface-container-low text-primary group-hover:bg-[#00351D] group-hover:text-white'
                          }`}>
                            <span className="material-symbols-outlined text-lg" style={{fontVariationSettings: "'FILL' 1"}}>{cat.icon}</span>
                          </div>

                          <div>
                            <h4 className="font-bold text-sm text-primary group-hover:text-emerald-700 transition-colors leading-none">{cat.label}</h4>
                            <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-50 tracking-tight">{cat.desc}</p>
                          </div>
                        </div>

                        <span className="material-symbols-outlined text-primary/10 group-hover:text-emerald-500/30 transition-all">chevron_right</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 animate-in slide-in-from-right duration-500">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">
                          {newPayee.type === 'Utility' ? 'Utility Name' : 'Recipient Name'}
                        </label>
                        <ValidatedInput
                          kind={newPayee.type === 'Utility' ? 'businessName' : 'personName'}
                          value={newPayee.name}
                          onChange={(e) => setNewPayee({...newPayee, name: e.target.value})}
                          placeholder={newPayee.type === 'Utility' ? 'e.g. Kenya Power' : 'e.g. John Kamau'}
                          className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                        />
                      </div>

                      {newPayee.type === 'Utility' && (
                        <div className="space-y-4 pt-4 animate-in fade-in duration-500">
                          <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Utility Type</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Water', 'Electricity', 'Rent', 'Internet'].map((u) => {
                              const logo = u === 'Electricity' ? '/utilities%20logo/kplc.png' : u === 'Water' ? '/utilities%20logo/ncwsc.png' : null
                              return (
                                <button
                                  key={u}
                                  onClick={() => {
                                    resetUtilityCheck();
                                    // Default Electricity to Postpaid — the account-type toggle
                                    // below lets the merchant switch to Prepaid.
                                    setNewPayee({...newPayee, utilityType: u, utilityProvider: u === 'Electricity' ? 'KPLC' : u === 'Water' ? 'WATER' : ''})
                                  }}
                                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex flex-col items-center justify-center gap-1.5 ${
                                    newPayee.utilityType === u
                                      ? 'bg-[#00351D] text-white border-[#00351D]'
                                      : 'bg-surface-container-low/50 text-on-surface-variant/40 border-outline-variant/5 hover:border-emerald-500/30'
                                  }`}
                                >
                                  {logo && (
                                    <span className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                                      <img src={logo} alt={u} className="h-7 w-auto object-contain" />
                                    </span>
                                  )}
                                  {u === 'Electricity' ? 'Electricity (KPLC)' : u === 'Water' ? 'Water (NCWSC)' : u}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {newPayee.type === 'Utility' && newPayee.utilityType === 'Electricity' && (
                        <div className="space-y-2 pt-2 animate-in fade-in duration-500">
                          <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Account Type</label>
                          <div className="flex gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl border border-outline-variant/5">
                            {[
                              { id: 'KPLC', label: 'Postpaid', desc: 'Pay down your existing bill' },
                              { id: 'KPLC_PREPAID', label: 'Prepaid', desc: 'Buy an electricity token' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => { resetUtilityCheck(); setNewPayee({...newPayee, utilityProvider: opt.id}) }}
                                className={`flex-1 py-2.5 rounded-xl text-center transition-all ${
                                  newPayee.utilityProvider === opt.id ? 'bg-white shadow-lg' : 'hover:bg-white/50'
                                }`}
                              >
                                <p className={`text-[10px] font-black uppercase tracking-widest ${newPayee.utilityProvider === opt.id ? 'text-primary' : 'text-on-surface-variant/40'}`}>{opt.label}</p>
                                <p className="text-[9px] text-on-surface-variant/50 font-medium mt-0.5">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {newPayee.type === 'Utility' && DEDICATED_RAIL_UTILITIES.includes(newPayee.utilityProvider) && (() => {
                        const isKplc = newPayee.utilityProvider === 'KPLC' || newPayee.utilityProvider === 'KPLC_PREPAID'
                        const isPrepaid = newPayee.utilityProvider === 'KPLC_PREPAID'
                        const logo = isKplc ? '/utilities%20logo/kplc.png' : '/utilities%20logo/ncwsc.png'
                        const billerLabel = isPrepaid ? 'KPLC Prepaid Details' : isKplc ? 'KPLC Postpaid Details' : 'NCWSC (Nairobi Water) Details'
                        const billerDesc = isPrepaid
                          ? 'The amount below buys a token — sent by KPLC as an SMS to the notification number.'
                          : isKplc
                            ? 'The amount below pays down the balance on this meter\'s existing bill.'
                            : null
                        // Tailwind's JIT scanner needs full literal class
                        // strings, not `${accent}`-interpolated ones — so
                        // each biller's palette is spelled out completely
                        // rather than built from a shared variable.
                        const theme = isKplc
                          ? {
                              panel: 'bg-amber-50/40 border-amber-500/10',
                              heading: 'text-amber-700',
                              input: 'focus:border-amber-500/50',
                              button: 'bg-amber-600 hover:bg-amber-700',
                            }
                          : {
                              panel: 'bg-sky-50/40 border-sky-500/10',
                              heading: 'text-sky-700',
                              input: 'focus:border-sky-500/50',
                              button: 'bg-sky-600 hover:bg-sky-700',
                            }
                        return (
                          <div className={`space-y-4 pt-4 animate-in fade-in duration-500 p-4 rounded-2xl border ${theme.panel}`}>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="bg-white rounded-lg px-2.5 py-2 shadow-sm shrink-0">
                                <img src={logo} alt={newPayee.utilityProvider} className="h-7 w-auto object-contain" />
                              </span>
                              <div>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.heading}`}>{billerLabel}</h4>
                                {billerDesc && <p className="text-[10px] text-on-surface-variant/60 font-medium mt-0.5">{billerDesc}</p>}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Meter Number</label>
                                <ValidatedInput
                                  kind="integer"
                                  value={newPayee.accountNumber}
                                  onChange={(e) => { resetUtilityCheck(); setNewPayee({...newPayee, accountNumber: e.target.value}) }}
                                  placeholder={isKplc ? 'e.g. 107803292' : 'e.g. 5069344'}
                                  className={`w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 ${theme.input}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Notification Number</label>
                                <ValidatedInput
                                  kind="phoneKE"
                                  value={newPayee.phone}
                                  onChange={(e) => { resetUtilityCheck(); setNewPayee({...newPayee, phone: e.target.value}) }}
                                  placeholder="07XX XXX XXX"
                                  className={`w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 ${theme.input}`}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleVerifyUtilityMeter}
                              disabled={utilityCheck.status === 'loading'}
                              className={`w-full py-3 rounded-xl text-white font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 ${theme.button}`}
                            >
                              {utilityCheck.status === 'loading' ? 'Verifying…' : 'Verify Meter'}
                            </button>

                            {utilityCheck.status === 'success' && (
                              <div className="flex items-start gap-3 bg-white border border-emerald-500/20 rounded-xl px-4 py-3">
                                <span className="material-symbols-outlined text-emerald-600 text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-primary truncate">{utilityCheck.customerName || 'Meter verified'}</p>
                                  <p className="text-[11px] text-on-surface-variant font-medium opacity-70">
                                    {utilityCheck.serviceName || (isPrepaid ? 'Kplc Prepaid' : isKplc ? 'Kplc Postpaid' : 'Nairobi Water')}
                                    {typeof utilityCheck.balance === 'number' ? ` · Balance due: ${formatKES(utilityCheck.balance)}` : ''}
                                  </p>
                                </div>
                              </div>
                            )}
                            {utilityCheck.status === 'error' && (
                              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                <span className="material-symbols-outlined text-red-500 text-[16px]">error_outline</span>
                                <p className="text-xs font-bold text-red-700">{utilityCheck.error}</p>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {newPayee.type === 'Employee' && (
                        <div className="space-y-4 pt-4 animate-in fade-in duration-500 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-500/10">
                          <h4 className="text-[10px] text-emerald-700 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">badge</span>
                            KRA Payroll Details
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">KRA PIN {newPayee.idNumber ? '' : '*'}</label>
                              {/* Employees don't always have their KRA PIN on hand — ID Number
                                  is an accepted alternative (matches Payee.js's original
                                  intent: either identifier satisfies the payroll record), so
                                  this becomes optional the moment an ID Number is entered. */}
                              <ValidatedInput kind="kraPin" optional={Boolean(newPayee.idNumber)} value={newPayee.kraPin} onChange={(e) => setNewPayee({...newPayee, kraPin: e.target.value})} placeholder="A000000000A" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 uppercase" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">ID Number {newPayee.kraPin ? '' : '*'}</label>
                              <ValidatedInput kind="nationalId" optional={Boolean(newPayee.kraPin)} value={newPayee.idNumber} onChange={(e) => setNewPayee({...newPayee, idNumber: e.target.value})} placeholder="e.g. 12345678" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">NSSF Number</label>
                              <ValidatedInput kind="nssf" optional value={newPayee.nssfNumber} onChange={(e) => setNewPayee({...newPayee, nssfNumber: e.target.value})} placeholder="e.g. 123456789" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">SHIF / NHIF Number</label>
                              <ValidatedInput kind="shif" optional value={newPayee.shifNumber} onChange={(e) => setNewPayee({...newPayee, shifNumber: e.target.value})} placeholder="e.g. 1234567" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50" />
                            </div>
                          </div>
                        </div>
                      )}

                      {newPayee.type === 'Supplier' && (
                        <div className="space-y-4 pt-4 animate-in fade-in duration-500 bg-purple-50/30 p-4 rounded-2xl border border-purple-500/10">
                          <h4 className="text-[10px] text-purple-700 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                            KRA eTIMS Details
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Supplier KRA PIN *</label>
                              <ValidatedInput kind="kraPin" value={newPayee.kraPin} onChange={(e) => setNewPayee({...newPayee, kraPin: e.target.value})} placeholder="P000000000A" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-purple-500/50 uppercase" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">eTIMS Invoice No. *</label>
                              <ValidatedInput kind="etims" value={newPayee.etimsInvoiceNumber} onChange={(e) => setNewPayee({...newPayee, etimsInvoiceNumber: e.target.value})} placeholder="e.g. INV-123" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-purple-500/50" />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Control Unit (CU) No.</label>
                              <ValidatedInput kind="cuNumber" optional value={newPayee.cuNumber} onChange={(e) => setNewPayee({...newPayee, cuNumber: e.target.value})} placeholder="e.g. 123456789" className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-0 focus:border-purple-500/50" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 pt-4">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Amount to be paid (KES)</label>
                        <ValidatedInput
                          kind="amount"
                          optional
                          value={newPayee.amount}
                          onChange={(e) => setNewPayee({...newPayee, amount: e.target.value})}
                          placeholder="e.g. 50000"
                          className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                        />
                      </div>

                      {newPayee.utilityProvider !== 'KPLC' && (
                      <div className="space-y-4 pt-4">
                        <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Settlement Method</label>
                        <div className="flex gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl border border-outline-variant/5">
                          {['Mobile Money', 'Bank'].map((method) => (
                            <button
                              key={method}
                              onClick={() => setNewPayee({...newPayee, paymentMethod: method})}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                newPayee.paymentMethod === method ? 'bg-white text-primary shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'
                              }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>
                      )}

                      {newPayee.utilityProvider !== 'KPLC' && (
                      <div className="pt-4 transition-all">
                        {newPayee.paymentMethod === 'Mobile Money' && (
                          <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-3">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Mobile Money Type</label>
                              <div className="grid grid-cols-3 gap-2">
                                {['Personal Number', 'Paybill', 'Buy Goods'].map((mType) => (
                                  <button
                                    key={mType}
                                    onClick={() => setNewPayee({...newPayee, mobileMoneyType: mType})}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                      newPayee.mobileMoneyType === mType 
                                        ? 'bg-[#00351D] text-white border-[#00351D]' 
                                        : 'bg-white text-on-surface-variant/40 border-outline-variant/20 hover:border-emerald-500/30'
                                    }`}
                                  >
                                    {mType}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {newPayee.mobileMoneyType === 'Personal Number' && (
                              <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Mobile Money Number</label>
                                  <ValidatedInput
                                    kind="phoneKE"
                                    value={newPayee.phone}
                                    onChange={(e) => setNewPayee({...newPayee, phone: e.target.value})}
                                    placeholder="07XX XXX XXX"
                                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {['safaricom', 'airtel'].map((net) => (
                                    <button
                                      key={net}
                                      type="button"
                                      onClick={() => setNewPayee({...newPayee, mobileNetwork: net})}
                                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                                        (newPayee.mobileNetwork || 'safaricom') === net
                                          ? 'bg-[#00351D] text-white border-[#00351D]'
                                          : 'bg-white text-on-surface-variant/40 border-outline-variant/20 hover:border-emerald-500/30'
                                      }`}
                                    >
                                      {net === 'airtel' ? 'Airtel Money' : 'M-PESA'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {newPayee.mobileMoneyType === 'Paybill' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Paybill Number</label>
                                  <ValidatedInput
                                    kind="paybill"
                                    value={newPayee.paybillNumber}
                                    onChange={(e) => setNewPayee({...newPayee, paybillNumber: e.target.value})}
                                    placeholder="e.g. 290290"
                                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Account Number</label>
                                  <ValidatedInput
                                    kind="text"
                                    value={newPayee.businessAccount}
                                    onChange={(e) => setNewPayee({...newPayee, businessAccount: e.target.value})}
                                    placeholder="e.g. 123456"
                                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {newPayee.mobileMoneyType === 'Buy Goods' && (
                              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Till Number</label>
                                <ValidatedInput
                                  kind="till"
                                  value={newPayee.tillNumber}
                                  onChange={(e) => setNewPayee({...newPayee, tillNumber: e.target.value})}
                                  placeholder="e.g. 567890"
                                  className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                                />
                              </div>
                            )}
                          </div>
                        )}
                         {newPayee.paymentMethod === 'Bank' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Bank Name</label>
                              <select
                                value={newPayee.bankCode}
                                onChange={(e) => {
                                  const match = bankCodes.find(b => b.code === e.target.value)
                                  setNewPayee({...newPayee, bankCode: e.target.value, bankName: match?.name || ''})
                                }}
                                className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                              >
                                <option value="">{bankCodes.length ? 'Select a bank' : 'Loading banks...'}</option>
                                {bankCodes.map((b) => (
                                  <option key={b.code} value={b.code}>{b.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Account No.</label>
                              <ValidatedInput
                                kind="bankAccount"
                                value={newPayee.accountNumber}
                                onChange={(e) => setNewPayee({...newPayee, accountNumber: e.target.value})}
                                placeholder="0123 XXX XXX"
                                className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 md:px-6 md:py-4 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => isEditing ? setShowAddModal(false) : setAddStep(1)}
                        className="flex-1 py-3.5 rounded-2xl border border-outline-variant/10 text-primary font-bold text-sm hover:bg-surface-container-low transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleSavePayee}
                        className="flex-[2] py-3.5 rounded-2xl bg-[#00351D] text-white font-bold text-sm hover:bg-emerald-950 transition-all shadow-xl active:scale-[0.98]"
                      >
                        {isEditing ? 'Save Changes' : 'Save Recipient'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Left Column: Saved Payees (380px) */}
        <section className="w-full lg:w-[380px] flex flex-col gap-6 lg:gap-8">
          <div className="flex items-center justify-between px-3 md:px-2">
            <div>
              <h2 className="font-headline text-2xl md:text-3xl text-primary tracking-tight font-bold">Saved Payees</h2>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] mt-1 opacity-40">Frequency: Monthly</p>
            </div>
            <button 
              onClick={() => { setShowAddModal(true); setIsEditing(false); setNewPayee({ name: '', type: 'Employee', paymentMethod: 'Mobile Money', phone: '', accountNumber: '', bankName: '', bankCode: '', walletAddress: '', network: 'Polygon' }); }}
              className="bg-[#00351D] text-white w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-emerald-950 active:scale-95 transition-all shadow-xl"
            >
              <span className="material-symbols-outlined text-lg md:text-xl">add</span>
            </button>
          </div>

          {/* Tabs - Scrollable on mobile */}
          <div className="flex gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl mx-3 md:mx-2 border border-outline-variant/5 overflow-x-auto no-scrollbar">
            {['All', 'Employees', 'Suppliers', 'Utilities'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`flex-none lg:flex-1 px-5 lg:px-0 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeFilter === tab ? 'bg-white text-primary shadow-lg' : 'text-on-surface-variant/40 hover:text-primary hover:bg-white/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Payee List */}
          <div className="flex flex-col gap-3 md:gap-4 px-3 md:px-2">
            {filteredPayees.map((p) => (
              <div
                key={p.id}
                className={`bg-white py-2 px-3 md:py-2.5 md:px-3.5 rounded-xl flex flex-col group relative transition-all duration-500 cursor-pointer border shadow-[0_2px_10px_rgb(0,0,0,0.01)] ${
                  selectedPayees[p.id] 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.01] shadow-[0_10px_30px_rgba(22,163,74,0.04)] scale-[1.005]' 
                    : 'border-outline-variant/5 hover:border-primary/10 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0" onClick={() => togglePayee(p.id)}>
                    {/* Left side: Tick + Avatar */}
                    <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                      {/* Selection Tick (Before Avatar) */}
                      <div className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${
                        selectedPayees[p.id] 
                          ? 'bg-[#00351D] border-[#00351D] text-white' 
                          : 'border-outline-variant/20 group-hover:border-emerald-500/50'
                      }`}>
                        {selectedPayees[p.id] && <span className="material-symbols-outlined text-[7px] md:text-[9px] font-black">check</span>}
                      </div>

                      <div className="w-8 h-8 md:w-9 md:h-9 shrink-0">
                        <div className="w-full h-full rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[#5EFEB3] font-black text-[9px] md:text-[11px] shadow-inner group-hover:bg-[#124B3A] transition-all duration-500">
                          {p.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-[10px] md:text-[12px] font-bold text-primary group-hover:text-[#00351D] transition-colors leading-tight truncate">{p.name}</h4>
                        {selectedPayees[p.id] && <span className="text-[6px] md:text-[7px] text-emerald-600 font-extrabold uppercase tracking-wider bg-emerald-50 px-1 py-0.5 rounded-sm">Selected</span>}
                      </div>
                      <p className={`text-[7px] md:text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm inline-block mt-0.5 ${p.type.toLowerCase() === 'employee' ? 'text-blue-600 bg-blue-50' : p.type.toLowerCase() === 'supplier' ? 'text-purple-600 bg-purple-50' : p.type.toLowerCase() === 'utility' ? 'text-amber-600 bg-amber-50' : 'text-on-surface-variant opacity-40'}`}>{p.type}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1" onClick={() => togglePayee(p.id)}>
                      <p className={`text-[10px] md:text-sm font-headline text-primary transition-all duration-300 ${!showAmounts && 'blur-md'}`}>
                        {formatKES(p.salary || p.amount || 0)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                        className="p-1 md:p-1.5 rounded-lg bg-surface-container-low text-primary/40 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-90"
                        title="Edit Payee"
                      >
                        <span className="material-symbols-outlined text-xs md:text-sm">edit</span>
                      </button>
                      <button 
                        onClick={(e) => handleDeletePayee(p._id || p.id, e)}
                        className="p-1 md:p-1.5 rounded-lg bg-surface-container-low text-primary/40 hover:text-red-600 hover:bg-red-50 transition-all active:scale-90"
                        title="Delete Payee"
                      >
                        <span className="material-symbols-outlined text-xs md:text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </section>

        {/* Right Column: Create Payment Batch */}
        <section className="flex-1 flex flex-col gap-6">
          {/* Step Indicator */}
          <div className="bg-surface-container-low px-4 py-3 md:px-5 md:py-3.5 rounded-2xl flex items-center justify-between relative overflow-hidden editorial-shadow border border-outline-variant/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
            <div className="flex items-center gap-3 md:gap-8 relative z-10 overflow-x-auto no-scrollbar">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-3 md:gap-4 shrink-0">
                  <div className={`flex items-center gap-2 md:gap-2.5 ${step < s ? 'opacity-40' : ''}`}>
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold text-[8px] md:text-[10px] ${
                      step === s ? 'bg-primary text-white shadow-md' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {s}
                    </div>
                    <span className={`text-[10px] md:text-xs ${step === s ? 'font-bold text-primary tracking-wide' : 'font-semibold text-on-surface-variant'} ${s === 2 && 'sm:block'} ${step !== s && 'hidden md:block'}`}>
                      {s === 1 ? 'Select' : s === 2 ? 'Review' : s === 3 ? 'Settle' : 'Done'}
                    </span>
                  </div>
                  {s < 4 && <div className="h-[1px] w-4 md:w-6 bg-outline-variant/30"></div>}
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-4 md:gap-7 relative z-10 shrink-0">
              <div className="w-[1px] h-9 bg-outline-variant/20 hidden md:block"></div>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3 text-right md:text-left group cursor-default">
                  <p className="text-[7px] md:text-[9px] text-on-surface-variant uppercase font-black tracking-widest leading-none opacity-50 group-hover:opacity-100 transition-opacity">Liquidity</p>
                  <div className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 group-hover:bg-emerald-500/[0.07] group-hover:border-emerald-500/30 transition-all">
                    <span className="text-[8px] md:text-[10px] font-bold text-emerald-600">KES</span>
                    <p className={`font-headline text-xs md:text-lg text-primary leading-none transition-all duration-300 font-bold ${!showAmounts && 'blur-md'}`}>
                      {balance.toLocaleString()}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowFundModal(true)}
                  className="p-1.5 md:p-2 rounded-xl bg-[#00351D] text-white hover:bg-emerald-950 transition-all flex items-center justify-center shadow-lg active:scale-90 group/fund"
                  title="Fund Account"
                >
                  <span className="material-symbols-outlined text-[16px] md:text-[20px] group-hover/fund:rotate-90 transition-transform duration-500">add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Batch Selection View */}
          <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-outline-variant/10">
            <div className="p-6 md:p-10 border-b border-outline-variant/5 flex justify-between items-center">
              <div>
                <h3 className="font-headline text-xl md:text-3xl text-primary tracking-tight font-bold">Create Payment Batch</h3>
                <p className="text-[10px] md:text-sm text-on-surface-variant font-medium mt-1 md:mt-1.5 opacity-60 italic">Define specific liquidity distribution for this cycle.</p>
              </div>
              <div>
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={csvInputRef} 
                  onChange={handleCSVUpload} 
                  style={{ display: 'none' }} 
                />
                <button 
                  onClick={() => csvInputRef.current.click()}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[14px]">upload_file</span>
                  Upload CSV
                </button>
              </div>
            </div>
            <div className="p-0">
              {/* Desktop Table */}
              {step < 3 && (
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 border border-outline-variant/10 rounded-2xl overflow-hidden">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10 w-12 text-center">#</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Recipient</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Settlement Account</th>
                        <th className="px-6 py-4 text-left text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-r border-outline-variant/10">Reference</th>
                        <th className="px-6 py-4 text-right text-[9px] text-on-surface-variant uppercase font-black tracking-widest border-b border-outline-variant/10">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 bg-white">
                      {payeesList.filter(p => selectedPayees[p.id]).map((p, idx) => (
                        <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors group">
                          <td className="px-6 py-4 text-center text-[10px] font-bold text-on-surface-variant/40 border-r border-outline-variant/5">{idx + 1}</td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[8px] font-black text-[#5EFEB3]">
                                {p.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <span className="text-xs font-bold text-primary">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-primary/80 uppercase tracking-wider">{p.paymentMethod}</span>
                              <span className="text-[10px] font-medium text-on-surface-variant opacity-60 tabular-nums">{formatPhoneDisplay(p.phone) || p.paybillNumber || p.accountNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-r border-outline-variant/5">
                            {step === 2 ? (
                              <input 
                                className="bg-surface-container-low/30 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-primary/60 w-full focus:ring-1 focus:ring-emerald-500/30 px-3 py-2 transition-all" 
                                placeholder="Ref..." 
                                defaultValue="MAY_PAYOUT_24"
                              />
                            ) : (
                              <span className="text-[10px] font-black text-primary/30 uppercase tracking-widest">Pending Review</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest opacity-20">KES</span>
                              {step === 2 ? (
                                <input 
                                  className="bg-transparent border-none text-right font-headline text-lg text-primary focus:ring-0 p-0 w-24 tabular-nums" 
                                  value={(payoutAmounts[p.id] || 0).toLocaleString()}
                                  onChange={(e) => updateAmount(p.id, e.target.value)}
                                />
                              ) : (
                                <span className="font-headline text-lg text-primary/40 tabular-nums">{(payoutAmounts[p.id] || 0).toLocaleString()}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Card List */}
              {step < 3 && (
                <div className="lg:hidden flex flex-col divide-y divide-outline-variant/10">
                  {payeesList.filter(p => selectedPayees[p.id]).map((p, idx) => (
                    <div key={p.id} className="p-4 flex flex-col gap-3 bg-white hover:bg-emerald-50/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-on-surface-variant/30 w-4">{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-[#0E3D2E] flex items-center justify-center text-[8px] font-black text-[#5EFEB3]">
                            {p.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-primary leading-none">{p.name}</p>
                            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-50">{p.paymentMethod}</p>
                          </div>
                        </div>
                        {step === 1 && (
                          <input 
                            type="checkbox" 
                            checked={!!selectedPayees[p.id]}
                            onChange={() => togglePayee(p.id)}
                            className="w-5 h-5 rounded-none border-outline-variant/30 text-[#00351D] focus:ring-[#00351D]" 
                          />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/5 pt-3">
                        <div className="space-y-1">
                          <label className="text-[7px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-30">Account / Ref</label>
                          <p className="text-[9px] font-medium text-on-surface-variant leading-none">{formatPhoneDisplay(p.phone) || p.paybillNumber || p.accountNumber}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <label className="text-[7px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-30">Amount (KES)</label>
                          {step === 2 ? (
                            <input 
                              className="w-full bg-surface-container-low/50 border-none text-right font-headline text-sm text-primary rounded-lg px-2 py-1 tabular-nums" 
                              value={(payoutAmounts[p.id] || 0).toLocaleString()}
                              onChange={(e) => updateAmount(p.id, e.target.value)}
                            />
                          ) : (
                            <p className="text-xs font-headline font-bold text-primary">{(payoutAmounts[p.id] || 0).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Settle Payments View */}
              {step === 3 && (
                <div className="p-6 md:p-10 animate-in fade-in zoom-in duration-500 bg-surface-container-low/20">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-6">Select Funding Source</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'TILL_1', name: merchant?.businessName || 'Main Business Till', balance: merchant?.kesBalance ?? 0, number: '889066' },
                    ].map(till => (
                      <div 
                        key={till.id}
                        onClick={() => setSelectedTill(till.id)}
                        className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${selectedTill === till.id ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10' : 'border-outline-variant/10 hover:border-emerald-500/30 bg-white shadow-sm hover:shadow-md'}`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedTill === till.id ? 'bg-emerald-500 text-white shadow-sm' : 'bg-surface-container-low text-primary'}`}>
                              <span className="material-symbols-outlined">{selectedTill === till.id ? 'check' : 'storefront'}</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-sm text-primary leading-tight">{till.name}</h5>
                              <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">Till No: {till.number}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-outline-variant/5">
                          <p className="text-[9px] text-on-surface-variant uppercase tracking-[0.2em] font-black opacity-40 mb-1.5">Available Balance</p>
                          <p className="font-headline text-xl text-primary font-bold">{formatKES(till.balance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Success & Receipts View */}
              {step === 4 && (() => {
                const failedCount = authorizedReceipts.filter(r => r.status === 'failed').length
                const pendingCount = authorizedReceipts.filter(r => r.status === 'pending').length
                const allFailed = failedCount > 0 && failedCount === authorizedReceipts.length
                return (
                <div className="p-6 md:p-12 animate-in fade-in zoom-in duration-700">
                  <div className="flex flex-col items-center text-center mb-12">
                    <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl relative ${allFailed ? 'bg-red-500 shadow-red-500/40' : failedCount > 0 ? 'bg-amber-500 shadow-amber-500/40' : 'bg-emerald-500 shadow-emerald-500/40'}`}>
                      <div className={`absolute inset-0 rounded-full animate-ping duration-[2000ms] ${allFailed ? 'bg-red-500/20' : failedCount > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}></div>
                      <span className="material-symbols-outlined text-4xl md:text-6xl text-[#00351D] font-black">{allFailed ? 'error' : failedCount > 0 ? 'warning' : 'check_circle'}</span>
                    </div>
                    <h2 className="font-headline text-3xl md:text-5xl text-primary font-bold tracking-tight mb-3">
                      {allFailed ? 'Batch Failed' : failedCount > 0 ? 'Batch Partially Processed' : 'Batch Authorized'}
                    </h2>
                    <p className="text-[10px] md:text-sm font-medium text-on-surface-variant opacity-60 max-w-md mx-auto italic">
                      {allFailed
                        ? 'Every payout in this batch failed and the full amount was refunded to your balance.'
                        : failedCount > 0
                        ? `${failedCount} of ${authorizedReceipts.length} payout${authorizedReceipts.length === 1 ? '' : 's'} failed and ${failedCount === 1 ? 'was' : 'were'} refunded to your balance.${pendingCount > 0 ? ` ${pendingCount} still awaiting confirmation.` : ''}`
                        : pendingCount > 0
                        ? `Submitted. ${pendingCount} payout${pendingCount === 1 ? '' : 's'} awaiting final confirmation.`
                        : 'Disbursement workflow complete. Receipts generated for all recipients.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                    {authorizedReceipts.map((receipt) => {
                      const statusMeta = {
                        failed:    { label: 'Failed & Refunded', dot: 'bg-red-500',   text: 'text-red-600',    footer: 'Refunded',   footerDot: 'bg-red-400',   footerText: 'text-red-700' },
                        pending:   { label: 'Pending',           dot: 'bg-amber-400', text: 'text-amber-600',  footer: 'Processing', footerDot: 'bg-amber-400', footerText: 'text-amber-700' },
                        completed: { label: 'Confirmed',         dot: 'bg-emerald-500', text: 'text-emerald-600', footer: 'Settled',  footerDot: 'bg-emerald-400', footerText: 'text-emerald-700' },
                      }[receipt.status] || { label: 'Confirmed', dot: 'bg-emerald-500', text: 'text-emerald-600', footer: 'Settled', footerDot: 'bg-emerald-400', footerText: 'text-emerald-700' }
                      return (
                      <div key={receipt.id} id={`receipt-${receipt.id}`} className="bg-white border border-outline-variant/10 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.03)] group hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                        <div className="bg-[#00351D] p-5 md:p-6 flex flex-col gap-4">
                          <img src={paychainLogoWhite} alt="PayChain" className="h-4 object-contain" />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-emerald-400">payments</span>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-none mb-1">Receipt No.</p>
                                <p className="text-xs font-black text-white tracking-widest uppercase">{receipt.id}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => downloadReceipt(receipt)}
                              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-emerald-400 hover:bg-white/10 transition-all"
                            >
                              <span className="material-symbols-outlined text-lg">download</span>
                            </button>
                          </div>
                        </div>
                        <div className="p-5 md:p-8 space-y-5 md:space-y-6">
                          <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0">
                            <div className="flex items-center sm:items-start gap-4 sm:gap-0 sm:flex-col sm:mb-0 w-full justify-between sm:justify-start">
                              <p className={`text-[10px] font-extrabold uppercase tracking-widest sm:mb-1.5 flex items-center gap-1.5 ${statusMeta.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
                                {statusMeta.label}
                              </p>
                              <p className="text-[11px] sm:text-xs font-bold text-primary opacity-60">{receipt.timestamp}</p>
                            </div>
                            <div className="text-left sm:text-right w-full sm:w-auto p-4 sm:p-0 bg-surface-container-low/30 sm:bg-transparent rounded-xl sm:rounded-none">
                              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1">Amount Paid</p>
                              <p className="font-headline text-2xl text-primary font-bold">{formatKES(receipt.amount)}</p>
                            </div>
                          </div>

                          <div className="h-[1px] bg-outline-variant/10 w-full"></div>

                          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-white p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-outline-variant/10">
                              <p className="text-[8px] sm:text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1.5">Recipient</p>
                              <p className="text-[12px] sm:text-[13px] font-bold text-primary mb-0.5">{receipt.name}</p>
                              <p className="text-[10px] sm:text-[11px] font-medium text-on-surface-variant opacity-60">{formatPhoneDisplay(receipt.phone) || receipt.phone}</p>
                            </div>
                            <div className="bg-white p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-outline-variant/10 text-left sm:text-right">
                              <p className="text-[8px] sm:text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1.5">Reference</p>
                              <p className="text-[10px] sm:text-[11px] font-black text-primary uppercase tracking-wider">{receipt.reference}</p>
                              <p className="text-[9px] sm:text-[10px] text-on-surface-variant font-medium mt-1 opacity-50 italic">via {receipt.method}</p>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full animate-pulse ${statusMeta.footerDot}`}></div>
                             <span className={`text-[9px] font-black uppercase tracking-widest ${statusMeta.footerText}`}>{statusMeta.footer}</span>
                          </div>
                          <img src={paychainLogo} alt="PayChain" className="h-4 object-contain opacity-40" />
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
                )
              })()}
            </div>
          </div>

          {/* Table Footer / Action Bar */}
          <div className="px-4 md:px-6 pb-6 md:pb-8 flex justify-center w-full">
            <div className={`p-4 md:p-5 rounded-3xl bg-[#00351D] text-white flex flex-col sm:flex-row items-center transition-all duration-700 shadow-2xl relative overflow-hidden gap-4 sm:gap-6 w-full max-w-4xl mx-auto border border-emerald-900/30 ${step === 4 ? 'justify-center bg-transparent shadow-none border-0' : 'justify-between'}`}>
              {step !== 4 && (
                <>
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-2xl"></div>
                  <div className="flex items-center gap-4 md:gap-8 relative z-10 w-full sm:w-auto overflow-x-auto no-scrollbar justify-center sm:justify-start">
                    <div className="flex flex-col min-w-fit">
                      <span className="text-[8px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-0.5">Batch Load</span>
                      <span className="text-[11px] md:text-sm font-bold whitespace-nowrap">{Object.values(selectedPayees).filter(Boolean).length} Verified Payees</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>
                    <div className="flex flex-col min-w-fit">
                      <span className="text-[8px] text-emerald-300 font-bold uppercase tracking-[0.2em] mb-0.5">Total Payout</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[9px] md:text-xs font-bold text-emerald-400">KES</span>
                        <span className={`font-headline text-lg md:text-2xl tracking-tighter tabular-nums transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{batchTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto justify-center sm:justify-end">
                    {isLiquidityLow && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[8px] text-amber-400 font-bold uppercase tracking-widest mb-0.5">Insufficient Liquidity</p>
                        <p className="text-[9px] text-white/60">Balance: {formatKES(balance)}</p>
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        if (step === 1) {
                          setStep(2);
                        } else if (step === 2) {
                          setStep(3);
                        } else {
                          if (merchant?.hasAppPin === false) {
                            setShowPinSetupModal(true);
                          } else {
                            setOtp('');
                            setOtpError('');
                            setSecurityStep(1);
                            setShowSecurityModal(true);
                            sendBulkPayOtp();
                          }
                        }
                      }}
                      disabled={batchTotal === 0 || isLiquidityLow || (step === 3 && !selectedTill)}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#00351D] px-6 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 group disabled:opacity-20 disabled:grayscale text-xs md:text-sm"
                    >
                      {step === 1 ? 'Review Batch' : step === 2 ? 'Proceed to Settlement' : 'Authorize Batch'}
                      <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                        {step === 1 ? 'visibility' : step === 2 ? 'arrow_forward' : 'bolt'}
                      </span>
                    </button>
                  </div>
                </>
              )}
              {step === 4 && (
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto max-w-xl mx-auto animate-in slide-in-from-bottom duration-1000">
                  <button 
                    onClick={downloadAllReceipts}
                    className="flex-1 px-8 py-4 bg-[#0A2540] text-blue-100 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl hover:bg-[#0C2D4E] hover:text-white transition-all flex items-center justify-center gap-3"
                  >
                    <span className="material-symbols-outlined text-xl">file_download</span>
                    Download All Receipts
                  </button>
                  <button onClick={handleReset} className="flex-1 px-10 py-4 bg-[#00351D] text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-2xl shadow-emerald-950/40 hover:bg-emerald-950 transition-all flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-xl">grid_view</span>
                    Return to Overview
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Batch History — real outcomes for every past bulk-pay run. */}
          <div className="md:px-0">
            <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-outline-variant/10 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="font-headline text-xl text-primary tracking-tight font-bold">Batch History</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60 italic">Every bulk-pay batch you've authorized, with real per-payout outcomes.</p>
                </div>
                <div className="flex gap-2 p-1.5 bg-surface-container-lowest border border-outline-variant/5 rounded-xl self-start md:self-auto overflow-x-auto no-scrollbar">
                  {['All', 'Processed', 'Partial', 'Failed', 'Pending'].map(f => (
                    <button
                      key={f}
                      onClick={() => { setBatchHistoryFilter(f); setBatchHistoryPage(1); }}
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 ${
                        batchHistoryFilter === f
                          ? 'bg-white text-primary shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-outline-variant/5'
                          : 'text-on-surface-variant/60 hover:text-primary'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {paginatedBatchHistory.length === 0 ? (
                  <div className="p-8 rounded-[20px] bg-surface-container-lowest border border-outline-variant/10 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">receipt_long</span>
                    <p className="text-sm font-bold text-primary mb-1">No batches yet</p>
                    <p className="text-xs text-on-surface-variant opacity-70">Authorize your first bulk-pay batch above and it'll show up here.</p>
                  </div>
                ) : paginatedBatchHistory.map(b => {
                  const meta = BATCH_STATUS_META[b.status] || BATCH_STATUS_META.Pending;
                  const failedRows = (b.transactions || []).filter(t => t.status === 'failed').length;
                  return (
                    <div
                      key={b._id}
                      onClick={() => setShowBatchDetails(b)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[20px] bg-surface-container-lowest border border-outline-variant/10 shadow-sm hover:border-emerald-500/20 transition-all group gap-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tone}`}>
                          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">{b.batchReference}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[10px] text-on-surface-variant font-medium opacity-60">{b.payeeCount} recipient{b.payeeCount === 1 ? '' : 's'} • {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${meta.badge}`}>
                              {meta.label}
                            </div>
                            {failedRows > 0 && (
                              <span className="text-[9px] font-bold text-red-600">{failedRows} refunded</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:gap-3 pl-14 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-bold text-primary">{formatKES(b.totalNetAmount)}</p>
                          <p className="text-[9px] text-on-surface-variant font-medium opacity-50 italic uppercase tracking-widest">Net paid out</p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all">chevron_right</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredBatchHistory.length > batchesPerPage && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-on-surface-variant opacity-60">
                    Showing {paginatedBatchHistory.length} of {filteredBatchHistory.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBatchHistoryPage(prev => Math.max(1, prev - 1))}
                      disabled={batchHistoryPage === 1}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span className="text-[10px] font-bold text-primary px-1">{batchHistoryPage} / {totalBatchHistoryPages}</span>
                    <button
                      onClick={() => setBatchHistoryPage(prev => Math.min(totalBatchHistoryPages, prev + 1))}
                      disabled={batchHistoryPage >= totalBatchHistoryPages}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        {/* Fund Account — small method picker, then hands off to the shared
            FundAccountModal (same component Overview.jsx/Wallet.jsx use)
            for the actual STK-push/bank/paybill flow. This used to be its
            own inline "Fund Account" modal whose Pay Now button called an
            undefined setBalance(...) — dead/broken code that would throw
            if clicked, never wired to any real deposit endpoint. */}
        {showFundModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowFundModal(false)}>
            <div className="bg-white w-full max-w-md rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-headline text-2xl text-primary tracking-tight font-bold">Fund Account</h2>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">Choose how to top up your balance</p>
                  </div>
                  <button
                    onClick={() => setShowFundModal(false)}
                    className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { id: 'mobile', label: 'Mobile Money', desc: 'M-Pesa, Airtel Money', icon: 'phone_iphone' },
                    { id: 'bank', label: 'Bank Account', desc: 'Direct Bank Transfer', icon: 'account_balance' },
                    { id: 'paybill', label: 'Paybill', desc: 'Lipa na M-Pesa instructions', icon: 'storefront' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => { setActiveFundMethod(method.id); setShowFundModal(false); }}
                      className="group flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01] transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-[#00351D] group-hover:text-white transition-all shrink-0">
                        <span className="material-symbols-outlined text-2xl">{method.icon}</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-sm text-primary">{method.label}</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 opacity-60">{method.desc}</p>
                      </div>
                      <span className="material-symbols-outlined ml-auto text-primary/10 group-hover:text-emerald-500 transition-all">chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeFundMethod && (
          <FundAccountModal method={activeFundMethod} onClose={() => setActiveFundMethod(null)} />
        )}
        {/* Setup PIN Modal Overlay */}
        {showPinSetupModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
              <div className="p-6 md:p-8">
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-[#00351D] text-emerald-400 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">password</span>
                  </div>
                  <div>
                    <h2 className="font-headline text-2xl text-primary tracking-tight font-bold">Setup Payment PIN</h2>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">
                      Create a 4-digit PIN to authorize payments — used everywhere, including bulk payouts.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Enter 4-Digit PIN</label>
                    <input 
                      type="password"
                      maxLength="4"
                      value={setupPin}
                      onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-[#00351D]/50 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.2em] ml-1 opacity-50">Confirm PIN</label>
                    <input 
                      type="password"
                      maxLength="4"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-[#00351D]/50 transition-all outline-none"
                    />
                  </div>

                  <button 
                    onClick={handleSetupPin}
                    disabled={setupPin.length !== 4 || setupPin !== confirmPin}
                    className="w-full py-4 rounded-2xl bg-[#00351D] text-white hover:bg-emerald-950 font-bold text-sm shadow-xl transition-all disabled:opacity-50"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Verification Modal */}
        {showSecurityModal && (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20">
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-headline text-2xl text-primary tracking-tight font-bold">Verification</h2>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1 opacity-60">Security Check required for Settlement</p>
                  </div>
                  <button 
                    onClick={() => { setShowSecurityModal(false); setSecurityStep(1); setOtp(''); setOtpError(''); }}
                    className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                {securityStep === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">sms</span>
                      </div>
                      <p className="text-sm text-primary font-bold">
                        {isSendingOtp ? 'Sending code…' : `Enter OTP Sent to ${maskedPhone}`}
                      </p>
                    </div>

                    <input
                      type="text"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                      placeholder="• • • • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                    />

                    {otpError && (
                      <p className="text-xs font-bold text-red-600 text-center -mt-3">{otpError}</p>
                    )}

                    <button
                      onClick={verifyBulkPayOtp}
                      disabled={otp.length < 4 || isVerifyingOtp || isSendingOtp}
                      className="w-full py-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isVerifyingOtp && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                      {isVerifyingOtp ? 'Verifying…' : 'Verify OTP'}
                    </button>

                    <button
                      onClick={sendBulkPayOtp}
                      disabled={isSendingOtp || otpResendCooldown > 0}
                      className="w-full text-center text-[11px] font-bold text-on-surface-variant hover:text-primary disabled:opacity-40 transition-colors"
                    >
                      {otpResendCooldown > 0 ? `Resend code in ${otpResendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                )}

                {securityStep === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-[#00351D] text-emerald-400 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">lock</span>
                      </div>
                      <p className="text-sm text-primary font-bold">Enter Account PIN to Authorize</p>
                    </div>

                    <input 
                      type="password"
                      maxLength="4"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      className="w-full bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl px-5 py-4 text-center font-headline tracking-[1em] text-xl font-bold text-primary focus:ring-0 focus:border-[#00351D]/50 transition-all outline-none"
                    />

                    <button
                      onClick={handleSecurityVerification}
                      disabled={pin.length !== 4 || isAuthorizing}
                      className="w-full py-4 rounded-2xl bg-[#00351D] text-white hover:bg-emerald-950 font-bold text-sm shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAuthorizing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Authorizing...
                        </>
                      ) : 'Confirm & Pay'}
                    </button>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Batch Details Modal — real per-payout outcome for a past batch. */}
        {showBatchDetails && (() => {
          const meta = BATCH_STATUS_META[showBatchDetails.status] || BATCH_STATUS_META.Pending;
          const rowMeta = {
            failed:    { label: 'Failed & Refunded', dot: 'bg-red-500',     text: 'text-red-600' },
            pending:   { label: 'Pending',            dot: 'bg-amber-400',   text: 'text-amber-600' },
            completed: { label: 'Confirmed',          dot: 'bg-emerald-500', text: 'text-emerald-600' },
          };
          return (
          <div className="fixed inset-0 bg-[#0A2540]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 border border-white/20 max-h-[85vh] flex flex-col">
              <div className="p-6 md:p-8 border-b border-outline-variant/10 flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
                  </div>
                  <div>
                    <h2 className="font-headline text-xl text-primary tracking-tight font-bold">{showBatchDetails.batchReference}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-[10px] text-on-surface-variant font-medium opacity-60">
                        {new Date(showBatchDetails.createdAt).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${meta.badge}`}>{meta.label}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowBatchDetails(null)}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 hover:text-primary transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="p-6 md:p-8 grid grid-cols-3 gap-4 border-b border-outline-variant/10 shrink-0">
                <div>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1">Net Paid Out</p>
                  <p className="font-headline text-lg text-primary font-bold">{formatKES(showBatchDetails.totalNetAmount)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1">Recipients</p>
                  <p className="font-headline text-lg text-primary font-bold">{showBatchDetails.payeeCount}</p>
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest opacity-40 mb-1">Funding Source</p>
                  <p className="text-xs font-bold text-primary truncate">{showBatchDetails.fundingSource || 'Main Business Account'}</p>
                </div>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant opacity-50 mb-4">Payouts</h4>
                <div className="flex flex-col gap-3">
                  {(showBatchDetails.transactions || []).map((t, idx) => {
                    const rm = rowMeta[t.status] || rowMeta.pending;
                    return (
                      <div key={t.receiptNumber || idx} className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary truncate">{t.name}</p>
                          <p className="text-[10px] text-on-surface-variant font-medium opacity-60 truncate">{t.accountReference} • via {t.method}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-primary">{formatKES(t.amount)}</p>
                          <p className={`text-[9px] font-extrabold uppercase tracking-widest flex items-center justify-end gap-1.5 mt-0.5 ${rm.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rm.dot}`}></span>
                            {rm.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          )
        })()}
      </div>

      </div>
    </MerchantLayout>
  )
}
