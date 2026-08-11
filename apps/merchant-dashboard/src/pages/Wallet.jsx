import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatDateISO } from '../utils/formatDate'
import { formatAccountNumber } from '../utils/formatAccountNumber'
import { getAmountSign, getAmountColorClass, isCreditTransaction, isSwapTransaction } from '../utils/transactionDirection'
import { ValidatedInput } from '../components/ValidatedInput'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useToast } from '../context/NotificationContext'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import SettlementQrCard from '../components/ui/SettlementQrCard'
import { getAppUrl } from '../utils/appUrl'
import { escapeHtml } from '../utils/escapeHtml'

export default function Wallet() {
  const { merchant, refreshSession } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()
  const { addToast } = useToast()
  const withdrawalDestinations = [
    { id: 'bank-1', name: merchant?.settlementBankName || 'Bank Transfer', type: 'Bank', acc: merchant?.settlementBankAccount ? `**** ${merchant.settlementBankAccount.slice(-4)}` : 'Not Configured', img: 'account_balance', verified: !!merchant?.settlementBankAccount },
    { id: 'mpesa-1', name: 'M-PESA Number', type: 'Mobile', acc: merchant?.settlementMobile ? `07** *** ${merchant.settlementMobile.slice(-3)}` : 'Not Configured', img: 'smartphone', verified: !!merchant?.settlementMobile }
  ]
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [destination, setDestination] = useState(withdrawalDestinations[0].id)
  const [destinationAccountValue, setDestinationAccountValue] = useState('')
  const [withdrawBankCode, setWithdrawBankCode] = useState('')
  const [withdrawPin, setWithdrawPin] = useState('')
  const [bankCodes, setBankCodes] = useState([])
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // Settlement Settings
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settleBankName, setSettleBankName] = useState('')
  const [settleBankAccount, setSettleBankAccount] = useState('')
  const [settleBankCode, setSettleBankCode] = useState('')
  const [settleMobile, setSettleMobile] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  
  // QR Features
  const [isDownloading, setIsDownloading] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Payment Link Features
  const [paymentLinkAmount, setPaymentLinkAmount] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  // Top Up Features
  const [showTopUpSelection, setShowTopUpSelection] = useState(false)
  const [selectedFundingMethod, setSelectedFundingMethod] = useState(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpPhone, setTopUpPhone] = useState('')
  const [stkStatusText, setStkStatusText] = useState('')
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false)

  // Primary Ledger Actions
  const [showMoveMoney, setShowMoveMoney] = useState(false)

  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwapping, setIsSwapping] = useState(false)
  const [isActivatingWallet, setIsActivatingWallet] = useState(false)
  const hasSynced = React.useRef(false)

  const fetchTransactions = React.useCallback(async () => {
    if (!merchant) return
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')

      // 1. Sync Live Wallet Balance if not already synced this session
      if (merchant?.stellarPublicKey && !hasSynced.current) {
        try {
          hasSynced.current = true; // Mark as synced to prevent infinite loop on refreshSession
          await axios.post(`${API_URL}/api/transactions/sync-wallet`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
          await refreshSession()
        } catch(e) { console.error('Failed to sync wallet', e) }
      }

      // 2. Fetch Transactions (will include the external deposit if just created)
      const res = await axios.get(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setLiveTransactions(res.data)
    } catch (err) {
      console.error('Failed to fetch transactions', err)
    } finally {
      setIsLoading(false)
    }
  }, [merchant])

  // Initial load
  useEffect(() => {
    if (merchant) fetchTransactions()
    else setIsLoading(false)
  }, [merchant, fetchTransactions])

  // Poll every 5s so wallet activity and balance stay live without a manual refresh
  useEffect(() => {
    if (!merchant) return
    const interval = setInterval(fetchTransactions, 5000)
    return () => clearInterval(interval)
  }, [merchant, fetchTransactions])

  // Also refresh instantly when the user returns to the tab
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTransactions() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchTransactions])

  const handleWithdraw = async (e) => {
    e.preventDefault()
    if(!withdrawAmount || isNaN(withdrawAmount)) return
    if(!destinationAccountValue) {
      addToast({ title: 'Missing Account Details', message: 'Please input the correct values for your destination field.', type: 'error' })
      return
    }
    const destType = withdrawalDestinations.find(d => d.id === destination)?.type;
    if (destType === 'Bank' && !withdrawBankCode) {
      addToast({ title: 'Missing Details', message: 'Select a destination bank to withdraw.', type: 'error' })
      return
    }
    if ((destType === 'Bank' || destType === 'Mobile') && withdrawPin.length !== 4) {
      addToast({ title: 'Missing Details', message: 'Enter your 4-digit payment PIN to withdraw.', type: 'error' })
      return
    }
    setIsWithdrawing(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')

      if (destType === 'Mobile') {
        await axios.post(`${API_URL}/api/callbacks/b2c-request`, {
          phone: destinationAccountValue.replace(/^(?:\+?254|0)/, '254'),
          amount: Number(withdrawAmount),
          pin: withdrawPin,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        addToast({ title: 'Withdrawal Processing', message: `KES ${withdrawAmount} sent to phone. B2C Transfer initiated.`, type: 'success' });
        setWithdrawPin('')
      } else if (destType === 'Bank') {
        await axios.post(`${API_URL}/api/v1/openbanking/bank-payout`, {
          bankCode: withdrawBankCode,
          accountNumber: destinationAccountValue,
          amount: Number(withdrawAmount),
          narration: `Withdrawal to ${destinationAccountValue}`,
          pin: withdrawPin,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        addToast({ title: 'Withdrawal Submitted', message: `KES ${withdrawAmount} sent via PesaLink.`, type: 'success' })
        setWithdrawPin('')
      } else {
        await axios.post(`${API_URL}/api/transactions/send-money`, {
          amount: Number(withdrawAmount),
          destination: destination,
          reference: `Withdrawal to ${destinationAccountValue}`
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        addToast({ title: 'Withdrawal Initiated', message: `KES ${withdrawAmount} sent to destination.`, type: 'success' })
      }

      setWithdrawAmount('')
      setDestinationAccountValue('')
      await refreshSession()
    } catch (err) {
      addToast({ title: 'Withdrawal Failed', message: err.response?.data?.error || err.response?.data?.message || 'Failed to withdraw funds', type: 'error' })
    } finally {
      setIsWithdrawing(false)
    }
  }

  useEffect(() => {
    const destType = withdrawalDestinations.find(d => d.id === destination)?.type;
    if (destType !== 'Bank' || bankCodes.length > 0) return
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    const token = localStorage.getItem('paychain_merchant_token')
    axios.get(`${API_URL}/api/v1/openbanking/bank-codes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBankCodes(res.data?.bankCodes || []))
      .catch(e => console.error('Failed to load bank codes', e))
  }, [destination])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setIsSavingSettings(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')
      
      await axios.put(`${API_URL}/api/auth/merchant/profile`, {
        settlementBankName: settleBankName,
        settlementBankAccount: settleBankAccount,
        settlementBankCode: settleBankCode,
        settlementMobile: settleMobile
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      addToast({ title: 'Settings Saved', message: 'Your settlement destinations have been updated.', type: 'success' })
      setShowSettingsModal(false)
      await refreshSession()
    } catch (err) {
      addToast({ title: 'Failed to Save', message: err.response?.data?.error || 'Could not save settings.', type: 'error' })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Pre-fill settings when modal opens
  useEffect(() => {
    if (showSettingsModal && merchant) {
      setSettleBankName(merchant.settlementBankName || '')
      setSettleBankAccount(merchant.settlementBankAccount || '')
      setSettleBankCode(merchant.settlementBankCode || '')
      setSettleMobile(merchant.settlementMobile || '')
      if (bankCodes.length === 0) {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const token = localStorage.getItem('paychain_merchant_token')
        axios.get(`${API_URL}/api/v1/openbanking/bank-codes`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => setBankCodes(res.data?.bankCodes || []))
          .catch(e => console.error('Failed to load bank codes', e))
      }
    }
  }, [showSettingsModal, merchant])

  // Then further down, the JSX changes:

  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapAmount, setSwapAmount] = useState('')
  const [swapDirectionModal, setSwapDirectionModal] = useState('KES_TO_USDC')
  const [liveRate, setLiveRate] = useState(132.45)
  const [usdBalance, setUsdBalance] = useState(0)

  useEffect(() => {
    const fetchUsdBalance = async () => {
      if (!merchant?.stellarPublicKey) return;
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const token = localStorage.getItem('paychain_merchant_token');
        const res = await axios.post(`${API_URL}/api/transactions/sync-wallet`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setUsdBalance(res.data.usdcBalance || res.data.balance);
        }
      } catch (err) {
        console.error('Failed to sync USDC balance', err);
      }
    };
    if (merchant) fetchUsdBalance();
  }, [merchant]);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const token = localStorage.getItem('paychain_merchant_token')
        const res = await axios.get(`${API_URL}/api/transactions/live-rate`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data?.rate) {
          setLiveRate(res.data.rate)
        }
      } catch (e) {
        console.error('Failed to fetch rate', e)
      }
    }
    fetchRate()
  }, [])

  const handleSwapKES = async () => {
    if (!merchant?.stellarPublicKey) {
      return addToast({ title: 'Wallet Not Activated', message: 'Please activate your Digital Wallet first.', type: 'error' });
    }
    setShowSwapModal(true)
  }

  const executeSwap = async () => {
    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      return addToast({ title: 'Invalid Amount', message: 'Please enter a valid number.', type: 'error' });
    }
    if (swapDirectionModal === 'KES_TO_USDC' && amount > (merchant?.kesBalance || 0)) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough KES.', type: 'error' });
    }
    if (swapDirectionModal === 'USDC_TO_KES' && amount > usdBalance) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough USDC.', type: 'error' });
    }

    setIsSwapping(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      const res = await axios.post(`${API_URL}/api/transactions/swap`, { amount, direction: swapDirectionModal }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: 'Swap Successful', message: `Successfully swapped ${amount} ${swapDirectionModal === 'KES_TO_USDC' ? 'KES to USDC' : 'USDC to KES'}!`, type: 'success' });
      await refreshSession();
      if (swapDirectionModal === 'USDC_TO_KES') {
        const syncRes = await axios.post(`${API_URL}/api/transactions/sync-wallet`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (syncRes.data.success) {
          setUsdBalance(syncRes.data.usdcBalance || syncRes.data.balance);
        }
      }
      setShowSwapModal(false);
      setSwapAmount('');
    } catch (err) {
      addToast({ title: 'Swap Failed', message: err.response?.data?.error || 'Failed to swap currency', type: 'error' });
    } finally {
      setIsSwapping(false);
    }
  }

  const handleActivateWallet = async () => {
    setIsActivatingWallet(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      await axios.post(`${API_URL}/api/transactions/activate-wallet`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: 'Wallet Activated', message: 'Your Stellar wallet address is ready. Inflation Shield is now unlocked.', type: 'success' });
      await refreshSession();
    } catch (err) {
      addToast({ title: 'Activation Failed', message: err.response?.data?.error || 'Failed to activate wallet', type: 'error' });
    } finally {
      setIsActivatingWallet(false);
    }
  }

  // QR Logic — a real NCBA Dynamic QR Code (scannable directly in M-PESA),
  // fetched once on mount. Was rendered client-side via qrcode.react,
  // encoding a link to PayChain's own /pay/account/:id page — replaced so
  // there's one QR mechanism in the app (same NCBA API Request Money's
  // "Scan to Pay QR" uses), not two.
  const [qrCodeDataUri, setQrCodeDataUri] = useState('')

  useEffect(() => {
    if (!merchant?.ncbaMerchantCode) return
    const token = localStorage.getItem('paychain_merchant_token')
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
    axios.get(`${API_URL}/api/callbacks/account-qr`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setQrCodeDataUri(res.data?.qrCodeDataUri || ''))
      .catch((e) => console.error('Failed to load account QR', e))
  }, [merchant?.ncbaMerchantCode])

  const getQrDataUrl = () => qrCodeDataUri

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const dataUrl = getQrDataUrl();
      if (!dataUrl) throw new Error('QR not ready');
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = `PayChain-QR-${merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'account'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addToast({ title: 'QR Code Downloaded', message: 'Your payment QR code has been downloaded.', type: 'success' })
    } catch (e) {
      addToast({ title: 'Download Failed', message: 'Could not download the QR image.', type: 'error' })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true)
    setTimeout(() => {
      setIsGeneratingPDF(false)
      const dataUrl = getQrDataUrl();
      if (!dataUrl) {
        addToast({ title: 'PDF Generation Failed', message: 'QR code was not ready — please try again.', type: 'error' })
        return;
      }
      const printWindow = window.open('', '', 'width=600,height=800');
      printWindow.document.write(`
        <html>
          <head>
            <title>PayChain Settlement QR</title>
            <style>
              body { font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #0B0E14; color: white; }
              img { width: 300px; height: 300px; border-radius: 16px; margin-bottom: 20px; border: 4px solid #fff; padding: 10px; background: white; }
              .text { text-align: center; max-width: 400px; }
              h1 { font-size: 24px; color: #2775CA; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.2em; }
              p { font-size: 16px; margin: 5px 0; letter-spacing: 0.1em; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" alt="Settlement QR" />
            <div class="text">
              <h1>Settlement QR</h1>
              <p>ACC: ${escapeHtml(formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending'))}</p>
              <p>MERCHANT: ${escapeHtml(merchant?.businessName || 'Merchant')}</p>
            </div>
            <script>
              window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      addToast({ title: 'PDF Generated', message: 'Your payment QR is ready for printing.', type: 'success' })
    }, 800)
  }

  // No more URL to share (the QR is a real M-PESA-scannable code, not a
  // link to a PayChain page) — sharing/copying the account details as text
  // instead, which is what actually still lets someone pay manually.
  const accountShareText = `Pay ${merchant?.businessName || 'this business'} via PayChain — Account: ${formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pay ${merchant?.businessName || 'Merchant'}`,
          text: accountShareText,
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    } else {
      navigator.clipboard.writeText(accountShareText)
      addToast({ title: 'Copied', message: 'Account details copied to clipboard.', type: 'success' })
    }
  }

  const generatePaymentLink = async () => {
    if (!paymentLinkAmount || Number(paymentLinkAmount) <= 0) {
      addToast({ title: 'Invalid Amount', message: 'Please enter a valid amount to generate a link.', type: 'error' })
      return
    }
    
    setIsGeneratingLink(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')
      
      const res = await axios.post(`${API_URL}/api/transactions/payment-link`, {
        amount: Number(paymentLinkAmount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        setGeneratedLink(`${getAppUrl()}/pay/${res.data.linkId}`)
        addToast({ title: 'Link Generated', message: 'Secure payment link created successfully! Expires in 48 hours.', type: 'success' })
      }
    } catch (err) {
      addToast({ title: 'Generation Failed', message: err.response?.data?.error || 'Failed to generate secure payment link', type: 'error' })
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(generatedLink)
    addToast({ title: 'Link Copied', message: 'Payment link copied to clipboard.', type: 'success' })
  }

  const selectedDest = withdrawalDestinations.find(d => d.id === destination)

  return (
    <MerchantLayout title="Digital Wallet">
      <>
        <div className="px-4 lg:px-0 max-w-7xl mx-auto w-full space-y-8 lg:space-y-12 pb-20">
        
        {/* Hero Section: Balances */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
          {merchant?.stellarPublicKey ? (
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] text-white p-5 rounded-[24px] md:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group border border-[#1E2532] w-full flex flex-col justify-between h-full">
              {/* Glowing Orb Effects */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#2775CA]/20 rounded-full -mr-20 -mt-20 blur-[80px] group-hover:scale-110 group-hover:bg-[#2775CA]/30 transition-all duration-1000 ease-out pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#2775CA]/10 rounded-full -ml-20 -mb-20 blur-[60px] pointer-events-none"></div>
              
              {/* Mesh Pattern Overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 mix-blend-overlay pointer-events-none"></div>

              <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2 bg-[#1A212D] border border-[#2A3441] rounded-full px-3 py-1.5 shadow-inner">
                     <div className="w-4 h-4 rounded-full bg-[#2775CA] flex items-center justify-center shadow-[0_0_10px_rgba(39,117,202,0.5)]">
                       <span className="text-[10px] text-white font-black leading-none">$</span>
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#8B98A9]">USDC Network</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#1A212D] flex items-center justify-center border border-[#2A3441] shadow-lg backdrop-blur-md hover:bg-[#202936] transition-colors cursor-pointer group/icon">
                     <span className="material-symbols-outlined text-sm text-[#8B98A9] group-hover/icon:text-white transition-colors">qr_code_scanner</span>
                  </div>
                </div>

                {/* Balance Area */}
                <div className="mb-5 flex-1">
                  <p className="text-[#8B98A9] text-[10px] font-black uppercase tracking-[0.2em] mb-1">Global Settlement Balance</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={`font-headline font-black text-3xl md:text-4xl tracking-tighter tabular-nums transition-all duration-300 text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8B98A9] ${!showAmounts && 'blur-xl text-white bg-none'}`}>
                      {Number(merchant?.usdcBalance || 0).toFixed(2)}
                    </h3>
                    <span className="text-lg font-bold text-[#2775CA]">USDC</span>
                  </div>
                  
                  {/* Wallet Address Pill */}
                  <div 
                    onClick={() => {
                      const address = merchant?.stellarPublicKey || '0x84728fB0...9xK2';
                      navigator.clipboard.writeText(address)
                      addToast({ title: 'Address Copied', message: 'Wallet address copied to clipboard', type: 'success' })
                    }}
                    className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-[#1A212D]/80 hover:bg-[#202936] rounded-full border border-[#2A3441] cursor-pointer transition-all active:scale-95 group/pill backdrop-blur-md"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#35D07F] shadow-[0_0_8px_rgba(53,208,127,0.6)] animate-pulse"></div>
                    <span className="text-[10px] text-[#8B98A9] font-mono tracking-wider group-hover/pill:text-white transition-colors">
                      {merchant?.stellarPublicKey ? `${merchant.stellarPublicKey.slice(0, 6)}...${merchant.stellarPublicKey.slice(-4)}` : '0x8472...9xK2'}
                    </span>
                    <span className="material-symbols-outlined text-[12px] text-[#8B98A9] group-hover/pill:text-white transition-colors">content_copy</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <button 
                    onClick={handleSwapKES}
                    disabled={isSwapping}
                    className="py-2.5 bg-[#1A212D] hover:bg-[#202936] text-white rounded-xl text-[10px] font-black transition-all border border-[#2A3441] uppercase tracking-[0.1em] flex items-center justify-center gap-2 group/btn shadow-sm disabled:opacity-50"
                  >
                    {isSwapping ? (
                      <span className="material-symbols-outlined text-base text-[#8B98A9] animate-spin">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined text-base text-[#8B98A9] group-hover/btn:text-white transition-colors">swap_horiz</span>
                    )}
                    {isSwapping ? 'Swapping...' : 'Swap KES'}
                  </button>
                  <button 
                    onClick={() => setShowTopUpSelection(true)}
                    className="py-2.5 bg-gradient-to-b from-[#2775CA] to-[#1A5AA3] hover:from-[#2C84E3] hover:to-[#1C64B4] text-white rounded-xl text-[10px] font-black transition-all shadow-md border border-[#3E8BE0]/50 uppercase tracking-[0.1em] flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base text-white">add</span>
                    Top Up
                  </button>
                </div>
                
                {/* Networks Footer */}
                <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#1E2532]/50">
                   <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8B98A9]/40">Supported Networks</span>
                   <div className="flex items-center gap-2">
                      <img src="https://cryptologos.cc/logos/stellar-xlm-logo.svg?v=032" alt="Stellar" className="w-3.5 h-3.5 transition-all cursor-help brightness-0 invert" title="Stellar" />
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=032" alt="USDC" className="w-3.5 h-3.5 transition-all cursor-help" title="USDC Native" />
                      <img src="https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" alt="Polygon" className="w-3.5 h-3.5 transition-all cursor-help" title="Polygon" />
                      <img src="https://cryptologos.cc/logos/celo-celo-logo.svg?v=032" alt="Celo" className="w-3.5 h-3.5 transition-all cursor-help" title="Celo" />
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] text-white p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#1E2532] mx-auto w-full flex flex-col items-center justify-center min-h-[214px] text-center relative overflow-hidden">
              {/* glow */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#2775CA]/20 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none"></div>

              {/* one-time badge */}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#2775CA]/10 border border-[#2775CA]/20 text-[#2775CA] text-[9px] font-black uppercase tracking-[0.2em] mb-4">
                <span className="material-symbols-outlined text-[10px]">stars</span>
                One-time setup
              </span>

              <div className="w-14 h-14 rounded-full bg-[#1A212D] flex items-center justify-center border border-[#2A3441] mb-3 shadow-lg">
                <span className="material-symbols-outlined text-2xl text-[#2775CA]">account_balance_wallet</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Digital Wallet Not Yet Active</h3>
              <p className="text-[10px] text-[#8B98A9] mb-2 max-w-[220px] leading-relaxed">
                Activate once to get your Stellar wallet address. Unlocks USDC settlement and Inflation Shield.
              </p>
              <p className="text-[9px] text-[#8B98A9]/50 mb-5 font-medium">Takes under 10 seconds. Cannot be undone.</p>
              <button
                onClick={handleActivateWallet}
                disabled={isActivatingWallet}
                className="w-full py-3 bg-gradient-to-b from-[#2775CA] to-[#1A5AA3] hover:from-[#2C84E3] hover:to-[#1C64B4] text-white rounded-xl text-[11px] font-black transition-all shadow-[0_0_20px_rgba(39,117,202,0.3)] border border-[#3E8BE0]/50 uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isActivatingWallet ? (
                  <span className="material-symbols-outlined text-lg animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">bolt</span>
                )}
                {isActivatingWallet ? 'Activating...' : 'Activate Digital Wallet'}
              </button>
            </div>
          )}

          {/* KES Balance Card (Local) */}
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group editorial-shadow mx-auto w-full max-w-[340px] flex flex-col justify-between h-full min-h-[214px]">
             <div className="absolute bottom-0 left-0 w-48 md:w-64 h-48 md:h-64 bg-emerald-50 rounded-full -ml-24 -mb-24 blur-[40px] md:blur-[60px]"></div>
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-5">
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-full text-[8px] md:text-[9px] font-black tracking-[0.2em] uppercase border border-emerald-100">Local Liquidity</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                     <span className="material-symbols-outlined text-xl text-emerald-600">payments</span>
                  </div>
                </div>
                <p className="text-on-surface-variant/40 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1">Available for Withdrawal</p>
                <h3 className={`font-headline font-bold text-2xl md:text-3xl lg:text-4xl tracking-tighter tabular-nums text-primary transition-all duration-300 ${!showAmounts && 'blur-xl'}`}>
                  {formatKES(merchant?.kesBalance || 0)}
                </h3>
             </div>
             <div className="flex gap-3 mt-6 relative z-10">
                <div className="flex-1 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-2.5">
                   <span className="material-symbols-outlined text-emerald-600 text-sm">shield</span>
                   <div>
                      <p className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">Inflation Shield</p>
                      <p className="text-[10px] text-emerald-900 font-medium leading-none mt-0.5">Protect KES now</p>
                   </div>
                </div>
             </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-8 items-start lg:items-stretch">
          {/* Withdrawal Interface */}
          <section className="col-span-12 lg:col-span-12 xl:col-span-5 bg-white p-5 lg:p-6 rounded-3xl border border-outline-variant/10 shadow-xl editorial-shadow animate-fade-in-up [animation-delay:100ms] flex flex-col">
            <div className="mb-6 md:mb-10 flex items-center justify-between">
              <div>
                <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">Withdraw Funds</h3>
                <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Settlement Destination</p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all border border-slate-200/60 shadow-sm"
                title="Edit Settlement Destinations"
              >
                <span className="material-symbols-outlined text-xl md:text-[22px]">settings</span>
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount to Withdraw</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-sm">KES</div>
                  <ValidatedInput
                    kind="amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-3 pl-12 pr-4 text-xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Destination</label>
                <div className="flex flex-col gap-3">
                  {withdrawalDestinations.map((dest) => (
                    <div 
                      key={dest.id}
                      onClick={() => setDestination(dest.id)}
                      className={`relative p-3 md:p-4 rounded-xl md:rounded-2xl border cursor-pointer transition-all duration-300 flex items-center gap-4 group ${
                        destination === dest.id 
                        ? 'border-[#0B0E14] bg-[#0B0E14] shadow-lg' 
                        : 'border-outline-variant/10 bg-white hover:border-primary/20 hover:bg-surface-container-low'
                      }`}
                    >
                      {/* Selection Radio */}
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        destination === dest.id 
                        ? 'border-emerald-400 bg-emerald-400' 
                        : 'border-outline-variant/30 bg-transparent group-hover:border-primary/40'
                      }`}>
                        {destination === dest.id && <div className="w-2 h-2 bg-[#0B0E14] rounded-full"></div>}
                      </div>

                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        destination === dest.id
                        ? 'bg-white/10 text-emerald-400'
                        : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                      }`}>
                         <span className="material-symbols-outlined text-[20px]">
                            {dest.type === 'Till' ? 'point_of_sale' : dest.type === 'Mobile' ? 'smartphone' : 'account_balance'}
                         </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <p className={`text-sm md:text-base font-bold truncate transition-colors duration-300 ${destination === dest.id ? 'text-white' : 'text-primary'}`}>{dest.name}</p>
                           {dest.verified && (
                             <span className={`material-symbols-outlined text-[14px] ${destination === dest.id ? 'text-emerald-400' : 'text-emerald-500'}`} style={{fontVariationSettings: "'FILL' 1"}} title="Verified Destination">verified</span>
                           )}
                         </div>
                         <p className={`text-[11px] md:text-xs font-medium truncate mt-0.5 ${destination === dest.id ? 'text-white/60' : 'text-on-surface-variant opacity-80'}`}>
                            {dest.type} <span className="mx-1.5 opacity-50">•</span> <span className="font-mono tracking-wider">{dest.acc}</span>
                         </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDest && (
                <div className="space-y-3 mt-4 animate-scale-in">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">
                    {selectedDest.type === 'Bank' ? 'Bank Account Number' : 'M-PESA Number'}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">{selectedDest.type === 'Bank' ? 'account_balance' : 'smartphone'}</span>
                    </div>
                    <ValidatedInput
                      kind={selectedDest.type === 'Bank' ? 'bankAccount' : 'phoneKE'}
                      value={destinationAccountValue}
                      onChange={(e) => setDestinationAccountValue(e.target.value)}
                      placeholder={selectedDest.type === 'Bank' ? (merchant?.settlementBankAccount || 'e.g. 1122334455') : (merchant?.settlementMobile || '07xxxxxxxx')}
                      className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-3 pl-12 pr-4 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                    />
                  </div>
                  {!selectedDest.verified && (
                    <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider pl-1 flex items-center gap-1 mt-2">
                      <span className="material-symbols-outlined text-[12px]">warning</span>
                      Not configured in settings
                    </p>
                  )}
                </div>
              )}

              {selectedDest && selectedDest.type === 'Bank' && (
                <div className="space-y-3 mt-4 animate-scale-in">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Destination Bank</label>
                  <select
                    value={withdrawBankCode}
                    onChange={(e) => setWithdrawBankCode(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  >
                    <option value="">Select bank</option>
                    {bankCodes.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDest && (selectedDest.type === 'Bank' || selectedDest.type === 'Mobile') && (
                <div className="space-y-3 mt-4 animate-scale-in">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Payment PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={withdrawPin}
                    onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="****"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-3 px-4 text-primary font-bold tracking-[0.5em] focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              )}

              {selectedDest && (
                <div className="p-5 bg-[#F0FDF4] rounded-2xl border border-emerald-100 flex items-start gap-4 animate-scale-in">
                   <span className="material-symbols-outlined text-emerald-600 mt-0.5">info</span>
                   <div>
                      <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                        Withdrawals are typically processed within <span className="font-bold">minutes</span>.
                      </p>
                   </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={isWithdrawing || !withdrawAmount}
                className="w-full bg-[#00351D] text-white py-4 rounded-2xl font-bold text-base shadow-xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group border border-white/5 disabled:opacity-20 disabled:grayscale"
              >
                {isWithdrawing ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Confirm Withdrawal
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">send_money</span>
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="col-span-12 lg:col-span-12 xl:col-span-7 bg-[#0B0E14] text-white p-6 md:p-8 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-[#1E2532] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in-up [animation-delay:150ms]">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2775CA]/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="flex flex-col md:flex-row justify-between items-stretch gap-10 relative z-10">
              <div className="flex-1 w-full space-y-6 md:space-y-8">
                <div>
                  <h3 className="font-headline text-2xl md:text-3xl text-white tracking-tight">MY QR</h3>
                  <p className="text-[9px] md:text-[10px] text-[#8B98A9] font-bold uppercase tracking-[0.2em] mt-1">Professional Settlement Tool</p>
                </div>

                {/* Blockchain Settlement Address Block */}
                <div className="bg-[#131722] border border-[#1E2532] p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:border-[#2775CA]/30 transition-colors">
                  <div className="flex items-start gap-4 w-full flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#1A212D] text-[#2775CA] flex items-center justify-center border border-[#1E2532] shrink-0 mt-1 sm:mt-0 shadow-inner">
                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    </div>
                    <div className="flex-1 w-full min-w-0 flex flex-col gap-3">
                      <div>
                        <p className="text-[10px] text-[#8B98A9] font-black uppercase tracking-widest opacity-80 mb-1 leading-snug break-words">Blockchain Settlement: <span className="text-white italic">PayChain Wallet</span></p>
                        {merchant?.stellarPublicKey
                              ? <span className="text-sm md:text-base font-mono text-white font-bold tracking-wider block">{merchant.stellarPublicKey.slice(0, 8)}...{merchant.stellarPublicKey.slice(-6)}</span>
                              : <span className="text-sm md:text-base font-mono text-amber-500 font-bold tracking-wider">&mdash; Not Activated &mdash;</span>}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0E14] rounded-full border border-[#1E2532] w-fit">
                          <span className="text-[7px] font-black uppercase tracking-widest text-[#8B98A9] leading-none">Supported by</span>
                          <div className="flex items-center gap-1.5">
                            <img src="https://cryptologos.cc/logos/stellar-xlm-logo.svg?v=032" alt="Stellar" className="w-3.5 h-3.5 brightness-0 invert" title="Stellar" />
                            <img src="https://cryptologos.cc/logos/celo-celo-logo.svg?v=032" alt="Celo" className="w-3.5 h-3.5" title="Celo" />
                            <div className="w-3.5 h-3.5 rounded-full bg-[#0052FF] flex items-center justify-center" title="Base">
                              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            </div>
                            <img src="https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" alt="Polygon" className="w-3.5 h-3.5" title="Polygon" />
                          </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex shrink-0">
                    <button 
                      onClick={() => {
                        const addr = merchant?.stellarPublicKey;
                        if (!addr) { addToast({ title: 'Wallet Not Activated', message: 'Activate your digital wallet first.', type: 'error' }); return; }
                        navigator.clipboard.writeText(addr);
                        addToast({ title: 'Address Copied', message: 'Full wallet address copied to clipboard', type: 'success' });
                      }}
                      className="w-full sm:w-auto px-2.5 py-1 bg-[#2775CA]/10 border border-[#2775CA]/20 text-[#2775CA] hover:bg-[#2775CA] hover:text-white rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[11px]">content_copy</span>
                        Copy Address
                    </button>
                  </div>
                </div>

                <div className="flex-1"></div>

                {/* Four action buttons - dark sophisticated grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#1E2532]">
                  <div className="space-y-2">
                    <button 
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="w-full py-4 bg-[#131722] text-[#8B98A9] rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#2775CA] hover:text-white group border border-[#1E2532] text-center px-2 hover:border-[#2775CA]"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                    </button>
                    <p className="text-[8px] text-center font-black uppercase text-[#8B98A9] tracking-widest">PNG Image</p>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={handleDownloadPDF}
                      disabled={isGeneratingPDF}
                      className="w-full py-4 bg-[#131722] text-[#8B98A9] rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white group border border-[#1E2532] text-center px-2 hover:border-red-500"
                    >
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    </button>
                    <p className="text-[8px] text-center font-black uppercase text-[#8B98A9] tracking-widest">PDF Export</p>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={handleShare}
                      className="w-full py-4 bg-[#131722] text-[#8B98A9] rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white group border border-[#1E2532] text-center px-2 hover:border-emerald-500"
                    >
                      <span className="material-symbols-outlined text-base">share</span>
                    </button>
                    <p className="text-[8px] text-center font-black uppercase text-[#8B98A9] tracking-widest">Share QR</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(accountShareText)
                        addToast({ title: 'Copied', message: 'Account details copied to clipboard.', type: 'success' })
                      }}
                      className="w-full py-4 bg-[#131722] text-[#8B98A9] rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-white group border border-[#1E2532] text-center px-2 hover:border-amber-500"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                    <p className="text-[8px] text-center font-black uppercase text-[#8B98A9] tracking-widest">Copy Details</p>
                  </div>
                </div>
              </div>

              {/* QR Code Container — premium bezel: gradient ring + corner brackets around the settlement QR */}
              <div className="w-full md:w-56 shrink-0 flex justify-center self-start md:self-center mt-2 md:mt-0">
                <SettlementQrCard
                  qrCodeDataUri={qrCodeDataUri}
                  businessName={merchant?.businessName || 'Merchant'}
                  accountNumber={merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending'}
                />
              </div>
            </div>

            {/* Payment Link Generator Feature */}
            <div className="mt-12 pt-8 border-t border-[#1E2532] relative z-10">
              <div className="bg-[#131722] p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-[#1E2532] shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#2775CA]/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0B0E14] flex items-center justify-center text-[#2775CA] border border-[#1E2532] shrink-0 shadow-inner">
                      <span className="material-symbols-outlined text-2xl">add_link</span>
                    </div>
                    <div>
                      <h4 className="font-headline text-xl md:text-2xl text-white tracking-tight">Generate Payment Link</h4>
                      <p className="text-[10px] text-[#8B98A9] font-medium mt-1 leading-relaxed max-w-sm">
                        Create a secure payment link to share directly with your customers via WhatsApp, Email, or SMS.
                      </p>
                    </div>
                  </div>

                  <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 sm:w-56 bg-[#0B0E14] rounded-2xl border border-[#1E2532] shadow-inner focus-within:border-[#2775CA]/50 focus-within:ring-1 focus-within:ring-[#2775CA]/30 transition-all">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-[10px] font-black text-[#8B98A9] uppercase">KES</span>
                      </div>
                      <ValidatedInput
                        kind="amount"
                        value={paymentLinkAmount}
                        onChange={(e) => setPaymentLinkAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-right text-lg font-mono font-bold text-white outline-none focus:ring-0 placeholder-[#1E2532]"
                        errorClassName="text-red-300 text-[11px] font-bold mt-1.5 pl-1"
                      />
                    </div>
                    <button 
                      onClick={generatePaymentLink}
                      disabled={isGeneratingLink || !paymentLinkAmount}
                      className={`px-8 py-4 bg-[#2775CA] text-white rounded-2xl text-[11px] font-bold shadow-[0_0_20px_rgba(39,117,202,0.3)] transition-all flex items-center justify-center gap-2 border border-[#3E8BE0]/50 disabled:opacity-50 disabled:grayscale ${!isGeneratingLink && paymentLinkAmount ? 'hover:bg-[#2C84E3] active:scale-95' : ''}`}
                    >
                      {isGeneratingLink ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">link</span>
                          Generate Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {generatedLink && (
                   <div className="mt-6 pt-6 border-t border-[#1E2532] relative z-10 animate-fade-in">
                      <div className="bg-[#0B0E14] p-4 md:p-5 rounded-2xl border border-[#1E2532] flex flex-col md:flex-row items-center justify-between gap-4">
                         <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-[#131722] flex items-center justify-center text-[#2775CA] shadow-inner shrink-0 border border-[#1E2532]">
                               <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-[10px] font-bold text-[#8B98A9] uppercase tracking-widest mb-0.5">Link Ready</p>
                              <p className="text-sm font-mono text-white tracking-wider truncate max-w-[200px] md:max-w-md">{generatedLink}</p>
                            </div>
                         </div>
                         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                            <button 
                               onClick={() => {
                                 navigator.clipboard.writeText(generatedLink)
                                 addToast({ title: 'Copied', message: 'Payment link copied to clipboard.', type: 'success' })
                               }}
                               className="px-5 py-3 bg-[#131722] border border-[#1E2532] text-white rounded-xl text-[10px] font-bold hover:bg-[#1A212D] transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                               <span className="material-symbols-outlined text-[14px]">content_copy</span>
                               Copy
                            </button>
                            <button 
                               onClick={() => window.open(`whatsapp://send?text=${encodeURIComponent(`Please pay me KES ${paymentLinkAmount} via PayChain: ${generatedLink}`)}`)}
                               className="px-5 py-3 bg-[#25D366] text-white rounded-xl text-[10px] font-bold hover:bg-[#1DA851] transition-all shadow-md flex items-center justify-center gap-2"
                            >
                               <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>send</span>
                               Share on WhatsApp
                            </button>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            </div>
          </section>

              {/* Bank Transfer / EFT / PesaLink — PayChain Account */}
              <section className="col-span-12 bg-white rounded-[32px] lg:rounded-[40px] border border-outline-variant/5 shadow-sm overflow-hidden editorial-shadow animate-fade-in-up [animation-delay:175ms] p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">account_balance</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 mb-1">Bank Transfer · EFT · PesaLink</p>
                      <h3 className="font-headline text-lg md:text-xl text-primary tracking-tight">PayChain Account</h3>
                      <p className="text-xs text-on-surface-variant opacity-70 mt-1 max-w-md">
                        Customers can pay via M-Pesa Paybill <span className="font-bold text-primary">880100</span>, or transfer directly from their bank, using this dedicated account number — funds reflect automatically once received.
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-auto shrink-0">
                    {/* Full NCBA virtual account is null until NCBA assigns the
                        institution prefix — falls back to the 8-digit merchant
                        code, already safe to use (matched inside NCBA's
                        Narrative field), before showing a true pending state. */}
                    {(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode) ? (
                      <div className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-5 py-4">
                        <span className="font-mono text-lg md:text-xl font-bold text-primary tracking-widest">{formatAccountNumber(merchant.ncbaVirtualAccountNumber || merchant.ncbaMerchantCode)}</span>
                        <button
                          onClick={() => {
                            const value = merchant.ncbaVirtualAccountNumber || merchant.ncbaMerchantCode
                            navigator.clipboard.writeText(value)
                            addToast({ title: 'Copied', message: 'PayChain Account number copied to clipboard', type: 'success' })
                          }}
                          className="p-2 rounded-xl bg-primary text-white hover:opacity-90 transition-all"
                          title="Copy account number"
                        >
                          <span className="material-symbols-outlined text-lg">content_copy</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-700">
                        <span className="material-symbols-outlined text-lg">hourglass_empty</span>
                        <span className="text-xs font-bold uppercase tracking-widest">Pending bank assignment</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Wallet History */}
              <section className="col-span-12 lg:col-span-12 bg-white rounded-[32px] lg:rounded-[40px] border border-outline-variant/5 shadow-sm overflow-hidden editorial-shadow animate-fade-in-up [animation-delay:200ms]">
            <div className="p-6 md:p-8 border-b border-surface-container flex items-center justify-between">
              <h3 className="font-headline text-lg md:text-xl text-primary">Recent Wallet Activity</h3>
              <button className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-[0.2em] hover:opacity-60 transition-opacity">View All</button>
            </div>
            <div className="flex flex-col">
              {liveTransactions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-on-surface-variant">No transaction history yet.</p>
                </div>
              ) : liveTransactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.id} className="px-4 md:px-8 py-2.5 flex items-center justify-between hover:bg-surface-container-low/30 transition-all group border-b border-surface-container last:border-0">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-base md:text-lg shadow-sm border ${
                      isCreditTransaction(tx.type) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      isSwapTransaction(tx.type) ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      <span className="material-symbols-outlined text-base md:text-lg">
                        {isCreditTransaction(tx.type) ? 'login' :
                         isSwapTransaction(tx.type) ? 'sync' : 'logout'}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] md:text-xs font-bold text-primary capitalize">
                        {isCreditTransaction(tx.type) ? 'Funds Deposit' :
                         isSwapTransaction(tx.type) ? 'Currency Swap' : 'Funds Withdrawal'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] md:text-[10px] text-on-surface-variant font-medium opacity-60">{formatDateISO(tx.createdAt || tx.timestamp)}</p>
                        <span className="text-[9px] md:text-[10px] text-on-surface-variant/20 block md:hidden">•</span>
                        <p className="hidden md:block text-[9px] text-on-surface-variant uppercase font-black tracking-widest opacity-40">
                          {isCreditTransaction(tx.type) ? (tx.sender?.name || 'Unknown') : (tx.recipient?.name || tx.sender?.name || 'Internal Account')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[11px] md:text-xs font-black tabular-nums transition-all duration-300 ${!showAmounts && 'blur-sm'} ${getAmountColorClass(tx.type)}`}>
                      {getAmountSign(tx.type)}{tx.type === 'fx_swap' ? formatUSDC(tx.usdcAmount) : formatKES(tx.kesAmount || tx.amount || 0)}
                    </p>
                    <span className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest mt-0.5 inline-block ${
                       tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                       {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Top Up Modal Overlay */}
      {showTopUpSelection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in backdrop-blur-xl bg-primary/10">
          <div className="absolute inset-0 bg-[#00351D]/80" onClick={() => setShowTopUpSelection(false)}></div>
          
          <div className="bg-white w-full max-w-2xl rounded-[32px] md:rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">
                  {selectedFundingMethod ? selectedFundingMethod.name : 'Select Funding Method'}
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">
                  {selectedFundingMethod ? 'Complete your deposit' : 'Choose how to top up your wallet'}
                </p>
              </div>
              <button 
                onClick={() => {
                  if (selectedFundingMethod) {
                    setSelectedFundingMethod(null)
                  } else {
                    setShowTopUpSelection(false)
                  }
                }}
                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary/40 hover:text-primary transition-colors border border-outline-variant/10"
              >
                <span className="material-symbols-outlined">{selectedFundingMethod ? 'arrow_back' : 'close'}</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              {!selectedFundingMethod ? (
                /* Selection List */
                <div className="space-y-4">
                  {[
                    {
                      id: 'mobile',
                      name: 'Mobile Money',
                      desc: 'M-Pesa, Airtel Money',
                      icon: 'smartphone',
                      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }
                  ].map((method) => (
                    <div 
                      key={method.id}
                      onClick={() => setSelectedFundingMethod(method)}
                      className="p-6 rounded-3xl border border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-low transition-all cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border ${method.color} shadow-sm group-hover:scale-105 transition-transform`}>
                          <span className="material-symbols-outlined text-3xl">{method.icon}</span>
                        </div>
                        <div>
                          <p className="font-headline text-lg text-primary">{method.name}</p>
                          <p className="text-xs text-on-surface-variant opacity-60">{method.desc}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-primary/20 group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                    </div>
                  ))}
                </div>
              ) : selectedFundingMethod.id === 'mobile' ? (
                /* Mobile Money Detail */
                <div className="space-y-8 animate-fade-in-up">
                  <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4">
                    <span className="material-symbols-outlined text-emerald-600 mt-1">smartphone</span>
                    <p className="text-xs md:text-sm text-emerald-900 leading-relaxed font-medium">
                      Enter the amount and your mobile number. We will send a <span className="font-bold">STK Push</span> to your phone for instant top-up.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount to Top Up</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-lg">KES</div>
                        <ValidatedInput
                          kind="amount"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                          placeholder="Min 100"
                          className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-6 pl-16 pr-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">M-Pesa / Airtel Number</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">smartphone</span>
                        </div>
                        <ValidatedInput
                          kind="phoneKE"
                          value={topUpPhone}
                          onChange={(e) => setTopUpPhone(e.target.value)}
                          placeholder="0712 345 678"
                          className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-6 pl-14 pr-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={async () => {
                        if (!topUpAmount || !topUpPhone) return
                        setIsProcessingTopUp(true)
                        setStkStatusText('Initiating STK Push...')
                        try {
                          const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
                          const token = localStorage.getItem('paychain_merchant_token')
                          
                          // 1. Send STK Push
                          const pushRes = await axios.post(`${API_URL}/api/callbacks/stk-push`, {
                            amount: Number(topUpAmount),
                            phone: topUpPhone,
                            merchantId: merchant._id
                          }, {
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          
                          const checkoutId = pushRes.data.checkoutRequestId
                          setStkStatusText('Awaiting PIN on phone...')

                          // 2. Poll Status
                          let attempts = 0
                          const maxAttempts = 20 // 20 * 3s = 60s
                          
                          const pollInterval = setInterval(async () => {
                            attempts++
                            try {
                              const statusRes = await axios.get(`${API_URL}/api/callbacks/stk-status/${checkoutId}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              })
                              
                              if (statusRes.data.status === 'success') {
                                clearInterval(pollInterval)
                                addToast({ title: 'Top Up Successful', message: `Successfully funded ${topUpAmount} KES via M-Pesa.`, type: 'success' })
                                await refreshSession()
                                setShowTopUpSelection(false)
                                setSelectedFundingMethod(null)
                                setTopUpAmount('')
                                setTopUpPhone('')
                                setStkStatusText('')
                                setIsProcessingTopUp(false)
                              } else if (statusRes.data.status === 'failed') {
                                clearInterval(pollInterval)
                                addToast({ title: 'Top Up Failed', message: statusRes.data.resultDesc || 'User cancelled or request failed.', type: 'error' })
                                setStkStatusText('')
                                setIsProcessingTopUp(false)
                              } else if (attempts >= maxAttempts) {
                                clearInterval(pollInterval)
                                addToast({ title: 'Timeout', message: 'The request timed out. Please try again.', type: 'error' })
                                setStkStatusText('')
                                setIsProcessingTopUp(false)
                              }
                            } catch (e) {
                              console.error('Polling error', e)
                            }
                          }, 3000)

                        } catch (err) {
                          setStkStatusText('')
                          setIsProcessingTopUp(false)
                          // 5xx means the STK may have been sent but the backend errored after —
                          // guide the user to check their phone rather than saying "failed"
                          if (err.response?.status >= 500) {
                            addToast({
                              title: 'Check Your Phone',
                              message: 'The STK prompt may have been sent. If you see an M-PESA prompt, enter your PIN. Otherwise try again.',
                              type: 'error',
                            })
                          } else {
                            addToast({ title: 'STK Push Failed', message: err.response?.data?.error || 'Could not send STK Push. Please try again.', type: 'error' })
                          }
                        }
                      }}
                      disabled={isProcessingTopUp || !topUpAmount || !topUpPhone}
                      className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-20"
                    >
                      {isProcessingTopUp ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span className="text-sm font-medium">{stkStatusText}</span>
                        </div>
                      ) : (
                        <>
                          Request STK Push
                          <span className="material-symbols-outlined">send_to_mobile</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer (Optional but good for selection) */}
            {!selectedFundingMethod && (
              <div className="p-6 md:p-8 bg-surface-container-low border-t border-outline-variant/10 text-center">
                <p className="text-[10px] text-on-surface-variant font-medium opacity-60">
                   Secure end-to-end encrypted transactions by <strong>PayChain Payments</strong>
                </p>
              </div>
            )}
          </div>
        </div>
        )}

      {/* Settings Modal Overlay */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in backdrop-blur-xl bg-primary/10">
          <div className="absolute inset-0 bg-[#00351D]/80" onClick={() => setShowSettingsModal(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-[32px] md:rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low shrink-0">
              <div>
                <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">
                  Settlement Details
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">
                  Configure where to withdraw your funds
                </p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary/40 hover:text-primary transition-colors border border-outline-variant/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSaveSettings} className="p-6 md:p-10 space-y-6 overflow-y-auto">
              {/* Bank Details */}
              <div className="space-y-4">
                <h4 className="font-headline text-lg text-primary tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">account_balance</span>
                  Bank Account
                </h4>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Bank Name</label>
                  <ValidatedInput
                    kind="businessName"
                    value={settleBankName}
                    onChange={(e) => setSettleBankName(e.target.value)}
                    placeholder="e.g. KCB Bank"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Account Number</label>
                  <ValidatedInput
                    kind="bankAccount"
                    value={settleBankAccount}
                    onChange={(e) => setSettleBankAccount(e.target.value)}
                    placeholder="e.g. 1122334455"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Bank (for PesaLink/EFT payouts)</label>
                  <select
                    value={settleBankCode}
                    onChange={(e) => setSettleBankCode(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  >
                    <option value="">Select bank</option>
                    {bankCodes.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-px bg-outline-variant/10 my-6"></div>

              {/* Mobile Details */}
              <div className="space-y-4">
                <h4 className="font-headline text-lg text-primary tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">smartphone</span>
                  Mobile Money
                </h4>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">M-PESA Number</label>
                  <ValidatedInput
                    kind="phoneKE"
                    value={settleMobile}
                    onChange={(e) => setSettleMobile(e.target.value)}
                    placeholder="07xxxxxxxx"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-4 px-5 text-lg font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSavingSettings}
                className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50 mt-8"
              >
                {isSavingSettings ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Save Settings
                    <span className="material-symbols-outlined">save</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Swap Modal Overlay */}
      {showSwapModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in backdrop-blur-xl bg-primary/10">
          <div className="absolute inset-0 bg-[#00351D]/80" onClick={() => setShowSwapModal(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-[32px] md:rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">
                  Swap to USDC
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">
                  Convert KES directly to USDC
                </p>
              </div>
              <button 
                onClick={() => setShowSwapModal(false)}
                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary/40 hover:text-primary transition-colors border border-outline-variant/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 md:p-10 space-y-6">
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800/60 mb-1">Available {swapDirectionModal === 'KES_TO_USDC' ? 'KES' : 'USDC'} Balance</p>
                  <p className="text-xl font-headline font-bold text-emerald-900">
                    {swapDirectionModal === 'KES_TO_USDC' ? formatKES(merchant?.kesBalance || 0) : formatUSDC(usdBalance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800/60 mb-1">Live Rate</p>
                  <p className="text-sm font-bold text-emerald-900">1 USDC = KES {liveRate.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount to Swap ({swapDirectionModal === 'KES_TO_USDC' ? 'KES' : 'USDC'})</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-lg">{swapDirectionModal === 'KES_TO_USDC' ? 'KES' : 'USDC'}</div>
                  <ValidatedInput
                    kind="amount"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-6 pl-20 pr-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                  <button 
                    onClick={() => setSwapAmount((swapDirectionModal === 'KES_TO_USDC' ? (merchant?.kesBalance || 0) : usdBalance).toString())}
                    className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-200 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <div 
                  onClick={() => setSwapDirectionModal(prev => prev === 'KES_TO_USDC' ? 'USDC_TO_KES' : 'KES_TO_USDC')}
                  className="w-10 h-10 bg-white border border-outline-variant/10 rounded-full flex items-center justify-center shadow-sm text-primary cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">swap_vert</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">You Will Receive (Estimated)</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-lg">{swapDirectionModal === 'KES_TO_USDC' ? 'USDC' : 'KES'}</div>
                  <input 
                    type="text"
                    value={swapAmount ? (swapDirectionModal === 'KES_TO_USDC' ? (Number(swapAmount) / liveRate).toFixed(4) : (Number(swapAmount) * liveRate).toFixed(2)) : '0.00'}
                    readOnly
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-6 pl-20 pr-6 text-2xl font-headline text-primary outline-none opacity-80"
                  />
                </div>
              </div>

              <button 
                onClick={executeSwap}
                disabled={isSwapping || !swapAmount || Number(swapAmount) <= 0 || (swapDirectionModal === 'KES_TO_USDC' ? Number(swapAmount) > (merchant?.kesBalance || 0) : Number(swapAmount) > usdBalance)}
                className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-50"
              >
                {isSwapping ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Confirm Swap
                    <span className="material-symbols-outlined">currency_exchange</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </MerchantLayout>
  )
}
