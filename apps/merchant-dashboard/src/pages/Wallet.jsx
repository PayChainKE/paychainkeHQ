import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatDateISO } from '../utils/formatDate'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useToast } from '../context/NotificationContext'
import { useMerchantAuth } from '../context/MerchantAuthContext'

export default function Wallet() {
  const { merchant } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()
  const { addToast } = useToast()
  const withdrawalDestinations = [
    { id: 'bank-1', name: 'KCB Bank', type: 'Bank', acc: '**** 5283', img: 'account_balance' },
    { id: 'mpesa-1', name: 'M-PESA Number', type: 'Mobile', acc: '0712***890', img: 'smartphone' }
  ]
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [destination, setDestination] = useState(withdrawalDestinations[0].id)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  
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
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false)

  // Primary Ledger Actions
  const [showMoveMoney, setShowMoveMoney] = useState(false)

  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwapping, setIsSwapping] = useState(false)
  const [isActivatingWallet, setIsActivatingWallet] = useState(false)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const res = await axios.get(`${API_URL}/api/transactions`)
        setLiveTransactions(res.data)
      } catch (err) {
        console.error('Failed to fetch transactions', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (merchant) fetchTransactions()
    else setIsLoading(false)
  }, [merchant])

  const handleWithdraw = (e) => {
    e.preventDefault()
    if(!withdrawAmount || isNaN(withdrawAmount)) return
    setIsWithdrawing(true)
    setTimeout(() => {
      setIsWithdrawing(false)
      addToast({ title: 'Withdrawal Initiated', message: `KES ${withdrawAmount} sent to destination.`, type: 'success' })
      setWithdrawAmount('')
    }, 1500)
  }

  const handleSwapKES = async () => {
    if (!merchant?.stellarPublicKey) {
      return addToast({ title: 'Wallet Not Activated', message: 'Please activate your Digital Wallet first.', type: 'error' });
    }
    const amountStr = window.prompt(`Enter amount of KES to swap to USDC (Max: ${merchant?.kesBalance})`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return addToast({ title: 'Invalid Amount', message: 'Please enter a valid number.', type: 'error' });
    }
    if (amount > merchant?.kesBalance) {
      return addToast({ title: 'Insufficient Balance', message: 'You do not have enough KES.', type: 'error' });
    }

    setIsSwapping(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      const res = await axios.post(`${API_URL}/api/transactions/swap`, { amount }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: 'Swap Successful', message: `Successfully swapped ${amount} KES to USDC!`, type: 'success' });
      // In a real app, we'd trigger a context refresh here to update the balances
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      addToast({ title: 'Swap Failed', message: err.response?.data?.error || 'Failed to swap KES', type: 'error' });
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
      addToast({ title: 'Wallet Activated', message: 'Your Web3 Digital Wallet has been provisioned!', type: 'success' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      addToast({ title: 'Activation Failed', message: err.response?.data?.error || 'Failed to activate wallet', type: 'error' });
    } finally {
      setIsActivatingWallet(false);
    }
  }

  // QR Logic
  const qrData = `paychain://pay?till=${merchant?.paybillAccount || '84729'}&name=${encodeURIComponent(merchant?.businessName || 'Merchant')}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}&margin=10&bgcolor=FFFFFF&color=00351D`

  const handleDownload = () => {
    setIsDownloading(true)
    setTimeout(() => {
      setIsDownloading(false)
      addToast({
        title: 'QR Code Ready',
        message: 'Your payment QR code is ready for download.',
        type: 'success'
      })
    }, 1000)
  }

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true)
    setTimeout(() => {
      setIsGeneratingPDF(false)
      addToast({
        title: 'PDF Generated',
        message: 'Your payment QR has been converted to a print-ready PDF.',
        type: 'success'
      })
      // Simulating PDF generation by opening print dialog on a hidden element
      window.print()
    }, 1500)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pay ${merchant?.businessName || 'Merchant'}`,
          text: `Scan to pay ${merchant?.businessName || 'Merchant'} on PayChain`,
          url: qrData
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    } else {
      navigator.clipboard.writeText(qrData)
      addToast({ title: 'Link Copied', message: 'Payment link copied to clipboard.', type: 'success' })
    }
  }

  const generatePaymentLink = () => {
    if (!paymentLinkAmount || Number(paymentLinkAmount) <= 0) {
      addToast({ title: 'Invalid Amount', message: 'Please enter a valid amount to generate a link.', type: 'error' })
      return
    }
    
    setIsGeneratingLink(true)
    setTimeout(() => {
      setIsGeneratingLink(false)
      const link = `https://pay.paychain.ke/pay/${merchant?.paybillAccount || '84729'}/${paymentLinkAmount}`
      setGeneratedLink(link)
      addToast({
        title: 'Payment Link Created',
        message: 'Your custom payment link is ready for sharing.',
        type: 'success'
      })
    }, 800)
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
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] text-white p-5 md:p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group border border-[#1E2532] mx-auto w-full max-w-[340px] flex flex-col justify-between min-h-[214px]">
              {/* Glowing Orb Effects */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#2775CA]/20 rounded-full -mr-20 -mt-20 blur-[80px] group-hover:scale-110 group-hover:bg-[#2775CA]/30 transition-all duration-1000 ease-out pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#2775CA]/10 rounded-full -ml-20 -mb-20 blur-[60px] pointer-events-none"></div>
              
              {/* Mesh Pattern Overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 mix-blend-overlay pointer-events-none"></div>

              <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2 bg-[#1A212D] border border-[#2A3441] rounded-full px-3 py-1.5 shadow-inner">
                     <div className="w-4 h-4 rounded-full bg-[#2775CA] flex items-center justify-center shadow-[0_0_10px_rgba(39,117,202,0.5)]">
                       <span className="text-[10px] text-white font-black leading-none">$</span>
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#8B98A9]">USDC Network</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#1A212D] flex items-center justify-center border border-[#2A3441] shadow-lg backdrop-blur-md hover:bg-[#202936] transition-colors cursor-pointer group/icon">
                     <span className="material-symbols-outlined text-lg text-[#8B98A9] group-hover/icon:text-white transition-colors">qr_code_scanner</span>
                  </div>
                </div>

                {/* Balance Area */}
                <div className="mb-8">
                  <p className="text-[#8B98A9] text-[10px] font-black uppercase tracking-[0.2em] mb-2">Global Settlement Balance</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={`font-headline font-black text-4xl md:text-5xl tracking-tighter tabular-nums transition-all duration-300 text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8B98A9] ${!showAmounts && 'blur-xl text-white bg-none'}`}>
                      {merchant?.usdcBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                    </h3>
                    <span className="text-xl font-bold text-[#2775CA]">USDC</span>
                  </div>
                  
                  {/* Wallet Address Pill */}
                  <div 
                    onClick={() => {
                      const address = merchant?.stellarPublicKey || '0x84728fB0...9xK2';
                      navigator.clipboard.writeText(address)
                      addToast({ title: 'Address Copied', message: 'Wallet address copied to clipboard', type: 'success' })
                    }}
                    className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 bg-[#1A212D]/80 hover:bg-[#202936] rounded-full border border-[#2A3441] cursor-pointer transition-all active:scale-95 group/pill backdrop-blur-md"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#35D07F] shadow-[0_0_8px_rgba(53,208,127,0.6)] animate-pulse"></div>
                    <span className="text-[11px] text-[#8B98A9] font-mono tracking-wider group-hover/pill:text-white transition-colors">
                      {merchant?.stellarPublicKey ? `${merchant.stellarPublicKey.slice(0, 6)}...${merchant.stellarPublicKey.slice(-4)}` : '0x8472...9xK2'}
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-[#8B98A9] group-hover/pill:text-white transition-colors">content_copy</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <button 
                    onClick={handleSwapKES}
                    disabled={isSwapping}
                    className="py-3.5 bg-[#1A212D] hover:bg-[#202936] text-white rounded-2xl text-[10px] font-black transition-all border border-[#2A3441] uppercase tracking-[0.15em] flex flex-col items-center justify-center gap-1.5 group/btn shadow-lg disabled:opacity-50"
                  >
                    {isSwapping ? (
                      <span className="material-symbols-outlined text-xl text-[#8B98A9] animate-spin">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined text-xl text-[#8B98A9] group-hover/btn:text-white transition-colors">swap_horiz</span>
                    )}
                    {isSwapping ? 'Swapping...' : 'Swap KES'}
                  </button>
                  <button 
                    onClick={() => setShowTopUpSelection(true)}
                    className="py-3.5 bg-gradient-to-b from-[#2775CA] to-[#1A5AA3] hover:from-[#2C84E3] hover:to-[#1C64B4] text-white rounded-2xl text-[10px] font-black transition-all shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)] border border-[#3E8BE0]/50 uppercase tracking-[0.15em] flex flex-col items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xl text-white">add</span>
                    Top Up
                  </button>
                </div>
                
                {/* Networks Footer */}
                <div className="flex items-center justify-center gap-3 mt-6 pt-5 border-t border-[#1E2532]/50">
                   <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8B98A9]/40">Supported Networks</span>
                   <div className="flex items-center gap-2">
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=032" alt="USDC" className="w-3.5 h-3.5 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title="USDC Native" />
                      <img src="https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" alt="Polygon" className="w-3.5 h-3.5 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title="Polygon" />
                      <img src="https://cryptologos.cc/logos/celo-celo-logo.svg?v=032" alt="Celo" className="w-3.5 h-3.5 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title="Celo" />
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#0F141E] to-[#0A0D14] text-white p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#1E2532] mx-auto w-full max-w-[340px] flex flex-col items-center justify-center min-h-[214px] text-center">
              <div className="w-16 h-16 rounded-full bg-[#1A212D] flex items-center justify-center border border-[#2A3441] mb-4 shadow-lg">
                <span className="material-symbols-outlined text-3xl text-[#2775CA]">account_balance_wallet</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Digital Wallet Inactive</h3>
              <p className="text-[10px] text-[#8B98A9] mb-6 max-w-[200px]">Activate your Web3 wallet to enable USDC settlements and the Inflation Shield.</p>
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
                {isActivatingWallet ? 'Activating...' : 'Activate Now'}
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
          <section className="col-span-12 lg:col-span-12 xl:col-span-5 bg-white p-6 md:p-8 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-outline-variant/10 shadow-2xl editorial-shadow animate-fade-in-up [animation-delay:100ms] flex flex-col">
            <div className="mb-6 md:mb-10">
              <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">Withdraw Funds</h3>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Settlement Destination</p>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount to Withdraw</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-sm">KES</div>
                  <input 
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl md:rounded-3xl py-4 md:py-6 pl-14 md:pl-16 pr-6 text-2xl md:text-3xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Destination</label>
                <div className="grid grid-cols-1 gap-3">
                  {withdrawalDestinations.map((dest) => (
                    <div 
                      key={dest.id}
                      onClick={() => setDestination(dest.id)}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                        destination === dest.id 
                        ? 'border-primary bg-primary/5 shadow-md' 
                        : 'border-outline-variant/10 bg-surface-container-low hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            destination === dest.id ? 'bg-primary text-white' : 'bg-white text-on-surface-variant'
                         }`}>
                            <span className="material-symbols-outlined text-xl">
                               {dest.type === 'Till' ? 'point_of_sale' : 'account_balance'}
                            </span>
                         </div>
                         <div>
                            <p className={`text-sm font-bold ${destination === dest.id ? 'text-primary' : 'text-on-surface'}`}>{dest.label}</p>
                            <p className="text-[10px] text-on-surface-variant font-medium opacity-60 capitalize">{dest.type} Account</p>
                         </div>
                      </div>
                      {dest.verified && (
                        <span className="material-symbols-outlined text-emerald-600 text-lg" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedDest && (
                <div className="p-5 bg-[#F0FDF4] rounded-2xl border border-emerald-100 flex items-start gap-4 animate-scale-in">
                   <span className="material-symbols-outlined text-emerald-600 mt-0.5">info</span>
                   <div>
                      <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                        Withdrawals to <strong>{selectedDest.label}</strong> are typically processed within <span className="font-bold">15 minutes</span>.
                      </p>
                   </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={isWithdrawing || !withdrawAmount}
                className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group border border-white/5 disabled:opacity-20 disabled:grayscale"
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

          <section className="col-span-12 lg:col-span-12 xl:col-span-7 bg-white p-6 md:p-8 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-outline-variant/10 shadow-2xl editorial-shadow animate-fade-in-up [animation-delay:150ms]">
                <div className="flex flex-col md:flex-row justify-between items-stretch gap-10">
                  <div className="flex-1 w-full space-y-6 md:space-y-8">
                    <div>
                      <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">MY QR</h3>
                      <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Professional Settlement Tool</p>
                    </div>

                    <div className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0 mt-1 sm:mt-0">
                           <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-40">Blockchain Settlement: <span className="text-emerald-600 italic">PayChain Wallet</span></p>
                          {merchant?.stellarPublicKey
                               ? <span className="text-sm font-mono text-primary font-bold tracking-wider truncate block max-w-[200px]">{merchant.stellarPublicKey.slice(0, 8)}...{merchant.stellarPublicKey.slice(-6)}</span>
                               : <span className="text-sm font-mono text-amber-500 font-bold tracking-wider">&mdash; Not Activated &mdash;</span>}
                        </div>
                      </div>
                      <div className="w-full md:w-auto flex flex-col items-center sm:items-end gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            const addr = merchant?.stellarPublicKey;
                            if (!addr) { addToast({ title: 'Wallet Not Activated', message: 'Activate your digital wallet first.', type: 'error' }); return; }
                            navigator.clipboard.writeText(addr);
                            addToast({ title: 'Address Copied', message: 'Full wallet address copied to clipboard', type: 'success' });
                          }}
                          className="w-full sm:w-auto px-5 py-3 bg-white border border-outline-variant/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 self-stretch sm:self-auto"
                        >
                           <span className="material-symbols-outlined text-sm">content_copy</span>
                           Copy Address
                        </button>
                        <div className="flex items-center gap-2 px-2 py-1 bg-surface-container-high rounded-full border border-outline-variant/5">
                           <span className="text-[7px] font-black uppercase tracking-widest text-primary/40 leading-none">Supported by</span>
                           <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#35D07F]" title="Celo"></span>
                              <span className="w-2 h-2 rounded-full bg-[#0052FF]" title="Base"></span>
                              <span className="w-2 h-2 rounded-full bg-[#8247E5]" title="Polygon"></span>
                              <span className="text-[8px] font-bold text-primary/60">Celo, Base, Polygon</span>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      {/* Space for other tools if needed later */}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                      <div className="space-y-2">
                        <button 
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="w-full py-4 bg-surface-container-high text-primary rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white group border border-outline-variant/5 text-center px-2"
                        >
                          <span className="material-symbols-outlined text-base">download</span>
                        </button>
                        <p className="text-[8px] text-center font-black uppercase text-on-surface-variant/60 tracking-widest">PNG Image</p>
                      </div>

                      <div className="space-y-2">
                        <button 
                          onClick={handleDownloadPDF}
                          disabled={isGeneratingPDF}
                          className="w-full py-4 bg-surface-container-high text-primary rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white group border border-outline-variant/5 text-center px-2"
                        >
                          <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                        </button>
                        <p className="text-[8px] text-center font-black uppercase text-on-surface-variant/60 tracking-widest">PDF Export</p>
                      </div>

                      <div className="space-y-2">
                        <button 
                          onClick={handleShare}
                          className="w-full py-4 bg-surface-container-high text-primary rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white group border border-outline-variant/5 text-center px-2"
                        >
                          <span className="material-symbols-outlined text-base">share</span>
                        </button>
                        <p className="text-[8px] text-center font-black uppercase text-on-surface-variant/60 tracking-widest">Share QR</p>
                      </div>

                      <div className="space-y-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(qrUrl)
                            addToast({ title: 'Link Copied', message: 'Payment link copied to clipboard.', type: 'success' })
                          }}
                          className="w-full py-4 bg-surface-container-high text-primary rounded-2xl text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white group border border-outline-variant/5 text-center px-2"
                        >
                          <span className="material-symbols-outlined text-base">content_copy</span>
                        </button>
                        <p className="text-[8px] text-center font-black uppercase text-on-surface-variant/60 tracking-widest">Copy Link</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 shrink-0 flex">
                    <div className="bg-[#0A2540] p-6 rounded-[32px] flex flex-col items-center justify-center border border-white/5 shadow-2xl relative overflow-hidden group w-full editorial-shadow min-h-[360px]">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full -ml-12 -mb-12 blur-2xl"></div>
                      
                      <div className="bg-white p-5 rounded-[32px] shadow-2xl mb-8 relative z-10 transition-transform group-hover:scale-105">
                        <img 
                          src={qrUrl} 
                          alt="Payment QR" 
                          className="w-full aspect-square rounded-2xl"
                        />
                      </div>
                      
                      <div className="text-center relative z-10 w-full px-4">
                        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Settlement QR</p>
                        <div className="space-y-1">
                          <p className="text-white text-xl font-headline tracking-widest">ACC: {merchant?.paybillAccount || '84729'}</p>
                          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed mt-2">Merchant: {merchant?.businessName || 'Merchant'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Link Generator Feature */}
                <div className="mt-12 pt-10 border-t border-outline-variant/10">
                  <div className="bg-surface-container-lowest p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-outline-variant/10 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                    
                    <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                          <span className="material-symbols-outlined text-2xl">add_link</span>
                        </div>
                        <div>
                          <h4 className="font-headline text-xl md:text-2xl text-primary tracking-tight">Generate Payment Link</h4>
                          <p className="text-[10px] text-on-surface-variant font-medium mt-1 leading-relaxed max-w-sm">
                            Create a secure payment link to share directly with your customers via WhatsApp, Email, or SMS.
                          </p>
                        </div>
                      </div>

                      <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1 sm:w-56 bg-white rounded-2xl border border-outline-variant/10 shadow-sm focus-within:border-emerald-500/30 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-[10px] font-black text-on-surface-variant/40 uppercase">KES</span>
                          </div>
                          <input 
                            type="number"
                            value={paymentLinkAmount}
                            onChange={(e) => setPaymentLinkAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-right text-lg font-headline text-primary outline-none focus:ring-0 placeholder-on-surface-variant/20"
                          />
                        </div>
                        <button 
                          onClick={generatePaymentLink}
                          disabled={isGeneratingLink || !paymentLinkAmount}
                          className={`px-8 py-4 bg-[#00351D] text-white rounded-2xl text-[11px] font-bold shadow-xl transition-all flex items-center justify-center gap-2 border border-white/5 disabled:opacity-50 disabled:grayscale ${!isGeneratingLink && paymentLinkAmount ? 'hover:bg-[#004d2b] active:scale-95' : ''}`}
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
                       <div className="mt-6 pt-6 border-t border-outline-variant/10 relative z-10 animate-fade-in">
                          <div className="bg-emerald-50 p-4 md:p-5 rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
                             <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0 border border-emerald-100/50">
                                   <span className="material-symbols-outlined text-lg">check_circle</span>
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-0.5">Link Ready</p>
                                  <p className="text-sm font-medium text-emerald-900 truncate max-w-[200px] md:max-w-md">{generatedLink}</p>
                                </div>
                             </div>
                             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                                <button 
                                   onClick={copyPaymentLink}
                                   className="px-5 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-sm"
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
                <div key={tx.id} className="px-4 md:px-8 py-6 flex items-center justify-between hover:bg-surface-container-low/30 transition-all group border-b border-surface-container last:border-0">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl shadow-sm border ${
                      tx.type === 'withdrawal' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      <span className="material-symbols-outlined text-lg md:text-xl">
                        {tx.type === 'withdrawal' ? 'logout' : 'sync'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm font-bold text-primary capitalize">{tx.type === 'withdrawal' ? 'Funds Withdrawal' : 'Currency Swap'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] md:text-[10px] text-on-surface-variant font-medium opacity-60">{formatDateISO(tx.timestamp)}</p>
                        <span className="text-[9px] md:text-[10px] text-on-surface-variant/20 block md:hidden">•</span>
                        <p className="hidden md:block text-[9px] text-on-surface-variant uppercase font-black tracking-widest opacity-40">{tx.destination || 'Internal Account'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs md:text-sm font-black text-primary transition-all duration-300 ${!showAmounts && 'blur-md'}`}>
                      {tx.type === 'withdrawal' ? '-' : ''}{tx.currency === 'KES' ? formatKES(tx.amount) : formatUSDC(tx.amount)}
                    </p>
                    <span className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest mt-1 inline-block ${
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
                      id: 'virtual', 
                      name: 'Virtual Account Transfer', 
                      desc: 'Transfer to your dedicated USD/KES account', 
                      icon: 'account_balance',
                      color: 'bg-blue-50 text-blue-600 border-blue-100'
                    },
                    { 
                      id: 'mobile', 
                      name: 'Mobile Money', 
                      desc: 'M-Pesa, Airtel Money', 
                      icon: 'smartphone',
                      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    },
                    { 
                      id: 'card', 
                      name: 'Card Top-up', 
                      desc: 'Visa / Mastercard', 
                      icon: 'credit_card',
                      color: 'bg-amber-50 text-amber-600 border-amber-100'
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
              ) : selectedFundingMethod.id === 'virtual' ? (
                /* Virtual Account Detail */
                <div className="space-y-8 animate-fade-in-up">
                  <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
                    <span className="material-symbols-outlined text-blue-600 mt-1">info</span>
                    <p className="text-xs md:text-sm text-blue-900 leading-relaxed font-medium">
                      Funds transferred to these accounts will reflect in your wallet within <span className="font-bold">2-5 minutes</span> once the transaction is verified.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-white border border-outline-variant/10 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <span className="material-symbols-outlined text-6xl">account_balance</span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-4">Dedicated KES Settlement Account</p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40 mb-1">Bank Name</p>
                          <p className="text-sm font-bold text-primary mb-3">PayChain Commercial Bank</p>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40 mb-1">Account Number</p>
                          <p className="text-xl md:text-2xl font-headline font-bold text-primary tracking-widest">994 0023 4455</p>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText('99400234455')
                            addToast({ title: 'Copied', message: 'Account number copied to clipboard', type: 'success' })
                          }}
                          className="px-4 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-outline-variant/10 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <span className="material-symbols-outlined text-6xl">public</span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-4">Dedicated USD Settlement Account (Global)</p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40 mb-1">Bank Name</p>
                          <p className="text-sm font-bold text-primary mb-3">Stellar Global Trust</p>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40 mb-1">SWIFT / Routing</p>
                          <p className="text-xl md:text-2xl font-headline font-bold text-primary tracking-widest uppercase">PCN-US-88229</p>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText('PCN-US-88229')
                            addToast({ title: 'Copied', message: 'Routing ID copied to clipboard', type: 'success' })
                          }}
                          className="px-4 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
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
                        <input 
                          type="number"
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
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/40 font-bold text-lg">+254</div>
                        <input 
                          type="number"
                          placeholder="712 345 678"
                          className="w-full bg-surface-container-low border border-outline-variant/5 rounded-3xl py-6 pl-16 pr-6 text-2xl font-headline text-primary focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        if (!topUpAmount) return
                        setIsProcessingTopUp(true)
                        setTimeout(() => {
                          setIsProcessingTopUp(false)
                          addToast({ title: 'Push Sent', message: 'Please complete the transaction on your mobile phone.', type: 'success' })
                          setShowTopUpSelection(false)
                          setSelectedFundingMethod(null)
                          setTopUpAmount('')
                        }, 2000)
                      }}
                      disabled={isProcessingTopUp || !topUpAmount}
                      className="w-full bg-[#00351D] text-white py-5 rounded-3xl font-bold text-lg shadow-2xl hover:bg-[#004d2b] active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-white/5 disabled:opacity-20"
                    >
                      {isProcessingTopUp ? (
                        <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          Request STK Push
                          <span className="material-symbols-outlined">send_to_mobile</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Card Top-up Detail */
                <div className="space-y-8 animate-fade-in-up">
                  <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                    <span className="material-symbols-outlined text-amber-600 mt-1">credit_card</span>
                    <p className="text-xs md:text-sm text-amber-900 leading-relaxed font-medium">
                      Top up instantly using your credit or debit card. Processing fee: <span className="font-bold">2.5%</span>.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-primary/60 pl-1">Amount (KES)</label>
                      <input 
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full bg-surface-container-low border border-outline-variant/5 rounded-2xl py-4 px-6 text-xl font-headline text-primary focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    
                    <div className="p-6 rounded-3xl bg-surface-container-high border border-outline-variant/10 space-y-4 shadow-inner">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Card Details</label>
                        <div className="bg-white rounded-xl border border-outline-variant/10 p-4 font-mono text-sm tracking-widest text-primary">
                          XXXX XXXX XXXX XXXX
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Expiry</label>
                          <div className="bg-white rounded-xl border border-outline-variant/10 p-4 font-mono text-sm text-primary">MM / YY</div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">CVC</label>
                          <div className="bg-white rounded-xl border border-outline-variant/10 p-4 font-mono text-sm text-primary">***</div>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowTopUpSelection(false)}
                      className="w-full bg-primary text-white py-5 rounded-3xl font-bold text-lg shadow-xl hover:bg-primary-dark transition-all"
                    >
                      Top Up KES {topUpAmount ? Number(topUpAmount).toLocaleString() : '0'}
                    </button>
                  </div>
                </div>
              )}
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
      </>
    </MerchantLayout>
  )
}
