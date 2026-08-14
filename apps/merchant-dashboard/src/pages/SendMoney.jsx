import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useNotification } from '../context/NotificationContext'
import { ValidatedInput } from '../components/ValidatedInput'
import PinBoxes from '../components/PinBoxes'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatKES } from '../utils/formatCurrency'
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay'
import { formatAccountNumber } from '../utils/formatAccountNumber'
import TransactionSuccessCard from '../components/ui/TransactionSuccessCard'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const DESTINATIONS = [
  { id: 'mpesa-primary', label: 'Primary M-PESA Number',   icon: 'phone_iphone',     fee: null, hint: 'Your registered phone number' },
  { id: 'mobile',        label: 'Any M-PESA Number',        icon: 'smartphone',        fee: null, hint: 'Send to any Kenyan mobile number' },
  { id: 'bank',          label: 'Bank Account',             icon: 'account_balance',   fee: 50,   hint: 'Direct bank transfer' },
  { id: 'till',          label: 'Till Number',              icon: 'point_of_sale',     fee: null, hint: 'Pay to a Safaricom Till' },
  { id: 'paybill',       label: 'Paybill',                  icon: 'receipt_long',      fee: null, hint: 'Pay to a Paybill number' },
]

// Mirrors backend/config/lipaNaMpesaTariffCard.js's LIPA_NA_MPESA_B2B_BANDS
// (2026-08-12 tiered schedule, baseCost + serviceFee per band) — that
// backend table is the authoritative charge, recomputed server-side in
// mpesaController.js#initiateB2B via getLipaNaMpesaTariff regardless of
// what this estimate shows. This used to be a flat KES 30 mirroring
// NCBA_LIPA_NA_MPESA_FLAT_FEE_KES, which the backend replaced with this
// tiered table — the estimate was never updated to match, so it was
// showing KES 30 for transfers (e.g. KES 50) that actually cost KES 0.
const B2B_TARIFF_BANDS = [
  { max: 100,      totalFee: 0   },
  { max: 500,      totalFee: 10  },
  { max: 1_000,    totalFee: 15  },
  { max: 2_500,    totalFee: 23  },
  { max: 5_000,    totalFee: 27  },
  { max: 10_000,   totalFee: 35  },
  { max: 20_000,   totalFee: 57  },
  { max: 30_000,   totalFee: 64  },
  { max: 40_000,   totalFee: 72  },
  { max: 50_000,   totalFee: 79  },
  { max: 100_000,  totalFee: 86  },
  { max: 150_000,  totalFee: 104 },
  { max: 200_000,  totalFee: 122 },
  { max: 250_000,  totalFee: 140 },
]
function estimateB2bFee(amount) {
  if (!amount || amount <= 0) return 0
  const band = B2B_TARIFF_BANDS.find(b => amount <= b.max) || B2B_TARIFF_BANDS[B2B_TARIFF_BANDS.length - 1]
  return band.totalFee
}

// Mirrors backend/config/mpesaB2cTariffCard.js's combined
// B2C_REGISTERED_USER_BANDS (Safaricom's real cost) + B2C_SERVICE_FEE_BANDS
// (PayChain's own tiered markup, 2026-08-12) — getB2cTariff sums both
// server-side. This used to add a flat KES 10 PayChain markup, which the
// backend replaced with a tiered schedule (KES 0-200 depending on amount);
// the estimate was never updated to match, so it understated the real
// charge at every amount above the lowest band.
const B2C_TARIFF_BANDS = [
  { max: 49,      totalFee: 0   },
  { max: 100,     totalFee: 5   },
  { max: 500,     totalFee: 11  },
  { max: 1_000,   totalFee: 17  },
  { max: 1_500,   totalFee: 24  },
  { max: 2_500,   totalFee: 29  },
  { max: 3_500,   totalFee: 34  },
  { max: 5_000,   totalFee: 37  },
  { max: 7_500,   totalFee: 57  },
  { max: 10_000,  totalFee: 67  },
  { max: 20_000,  totalFee: 84  },
  { max: 50_000,  totalFee: 113 },
  { max: 100_000, totalFee: 163 },
  { max: 250_000, totalFee: 213 },
]

function estimateB2cFee(amount) {
  if (!amount || amount <= 0) return 0
  const band = B2C_TARIFF_BANDS.find(b => amount <= b.max) || B2C_TARIFF_BANDS[B2C_TARIFF_BANDS.length - 1]
  return band.totalFee
}

export default function SendMoney() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const { merchant, refreshSession } = useMerchantAuth()

  // step 1: From/To  2: Details  3: PIN setup (first time)  4: Confirm & authorize
  const [step, setStep] = useState(1)
  const [destination, setDestination]       = useState('')
  const [recipientAccount, setRecipientAccount] = useState('')
  const [paybillAccountRef, setPaybillAccountRef] = useState('')
  const [bankCode, setBankCode]             = useState('')
  const [bankCodes, setBankCodes]           = useState([])
  const [bankRail, setBankRail]             = useState('pesalink')
  // RTGS-only fields — cross-border/multi-currency rail, KES-only for now
  // (see backend submitNcbaBankTransfer's doc comment on why non-KES is
  // blocked until real FX conversion exists). bankCode doubles as the
  // SWIFT BIC for this rail (see the Step 2 destination-bank input, which
  // switches from a <select> of CBK clearing codes to a free-text SWIFT
  // field when bankRail === 'rtgs').
  const [beneficiaryCountry, setBeneficiaryCountry] = useState('KE')
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('')
  const [purposeCode, setPurposeCode]       = useState('MSC')
  // Which mobile wallet network to pay into — only shown/used for the
  // 'mpesa-primary'/'mobile' destinations (NCBA Mobile B2W supports both).
  const [provider, setProvider]             = useState('safaricom')
  const [amount, setAmount]                 = useState('')
  const [reference, setReference]           = useState('')
  const [pin, setPin]                       = useState('')
  const [newPin, setNewPin]                 = useState('')
  const [confirmPin, setConfirmPin]         = useState('')
  const [isLoading, setIsLoading]           = useState(false)
  const [pinError, setPinError]             = useState('')
  const [success, setSuccess]               = useState(false)
  const [completedTx, setCompletedTx]       = useState(null)

  const hasPin       = !!merchant?.hasAppPin
  const selectedDest = DESTINATIONS.find(d => d.id === destination)
  const isMobileDest = destination === 'mpesa-primary' || destination === 'mobile'
  const isB2bDest     = destination === 'till' || destination === 'paybill'
  const fee          = isMobileDest ? estimateB2cFee(Number(amount) || 0) : isB2bDest ? estimateB2bFee(Number(amount) || 0) : (selectedDest?.fee || 0)
  const totalAmount  = Number(amount || 0) + fee
  const balance      = merchant?.kesBalance || 0

  const token = () => localStorage.getItem('paychain_merchant_token')
  const cfg   = () => ({ headers: { Authorization: `Bearer ${token()}` } })

  // Derived step labels
  const STEPS = [
    { id: 1, label: 'Destination' },
    { id: 2, label: 'Details' },
    ...(!hasPin ? [{ id: 3, label: 'Set PIN' }] : []),
    { id: hasPin ? 3 : 4, label: 'Confirm' },
  ]
  const confirmStep = hasPin ? 3 : 4
  const totalSteps  = hasPin ? 3 : 4

  useEffect(() => { setPinError('') }, [pin, newPin, confirmPin])

  useEffect(() => {
    if (destination !== 'bank' || bankCodes.length > 0) return
    axios.get(`${API_URL}/api/v1/openbanking/bank-codes`, cfg())
      .then(res => setBankCodes(res.data?.bankCodes || []))
      .catch(e => console.error('Failed to load bank codes', e))
  }, [destination])

  const goNext = async () => {
    // "Just advance, no special action" covers every step before the one
    // that actually does something: for hasPin merchants that's every step
    // up to (and not including) confirmStep itself; for merchants still
    // setting up a PIN, step 3 is the PIN-save step (handled below) so the
    // plain-advance range stops one short of confirmStep instead.
    // hasPin=true:  confirmStep=3 -> threshold 3 (was hardcoded to 2, which
    //   meant step 2 -> 3 never advanced at all: Continue silently did
    //   nothing for any merchant who already had a PIN set).
    // hasPin=false: confirmStep=4 -> threshold 3 (unchanged).
    if (step < (hasPin ? confirmStep : confirmStep - 1)) { setStep(s => s + 1); return }

    // PIN setup step (first time)
    if (!hasPin && step === 3) {
      if (newPin.length < 4) { setPinError('PIN must be exactly 4 digits.'); return }
      if (newPin !== confirmPin) { setPinError('PINs do not match. Please re-enter.'); return }
      setIsLoading(true)
      try {
        await axios.post(`${API_URL}/api/auth/merchant/set-app-pin`, { pin: newPin }, cfg())
        await refreshSession()
        setStep(4)
      } catch (e) {
        setPinError(e.response?.data?.error || 'Failed to save PIN. Try again.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Confirm & send step
    if (step === confirmStep) {
      if (totalAmount > balance) {
        addNotification({ title: 'Insufficient Balance', message: `You need ${formatKES(totalAmount)} but only have ${formatKES(balance)}.`, type: 'error' })
        return
      }
      if (pin.length < 4) { setPinError('Enter your 4-digit payment PIN.'); return }

      setIsLoading(true)
      try {
        // 1. Verify PIN
        await axios.post(`${API_URL}/api/auth/merchant/verify-payment-pin`, { pin }, cfg())

        // 2. Execute transfer
        const isMobile = destination === 'mpesa-primary' || destination === 'mobile'
        let tx = null
        if (isMobile) {
          const { data } = await axios.post(`${API_URL}/api/callbacks/b2c-request`, {
            phone: recipientAccount,
            amount: Number(amount),
            destination: selectedDest.label,
            fee,
            reference,
            pin,
            provider,
          }, cfg())
          tx = data.transaction
        } else if (destination === 'bank') {
          const { data } = await axios.post(`${API_URL}/api/v1/openbanking/bank-payout`, {
            bankCode,
            accountNumber: recipientAccount,
            accountName: reference || undefined,
            amount: Number(amount),
            narration: reference || `Transfer to ${recipientAccount}`,
            pin,
            rail: bankRail,
            ...(bankRail === 'rtgs' ? { beneficiaryCountry, beneficiaryAddress: beneficiaryAddress || undefined, purposeCode } : {}),
          }, cfg())
          tx = data.transaction
        } else {
          const { data } = await axios.post(`${API_URL}/api/callbacks/b2b-request`, {
            billType: destination, // 'till' | 'paybill'
            partyB: recipientAccount,
            accountReference: isB2bDest ? (paybillAccountRef || undefined) : undefined,
            amount: Number(amount),
            reference: reference || `Transfer to ${recipientAccount}`,
            pin,
          }, cfg())
          tx = data.transaction
        }

        await refreshSession()
        setCompletedTx(tx)
        setSuccess(true)
      } catch (e) {
        const msg = e.response?.data?.error || 'Transfer failed. Please try again.'
        if (e.response?.status === 401) {
          setPinError('Incorrect PIN. Please try again.')
          setPin('')
        } else {
          addNotification({ title: 'Transfer Failed', message: msg, type: 'error' })
        }
      } finally {
        setIsLoading(false)
      }
    }
  }

  const canContinue = () => {
    if (step === 1) return !!destination
    if (step === 2) return !!amount && Number(amount) > 0 && !!recipientAccount && (destination !== 'bank' || !!bankCode) && (destination !== 'bank' || bankRail !== 'rtgs' || !!beneficiaryCountry) && (destination !== 'paybill' || !!paybillAccountRef)
    if (!hasPin && step === 3) return newPin.length === 4 && confirmPin.length === 4
    if (step === confirmStep) return pin.length === 4
    return true
  }

  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (success) {
    const methodLabel =
      selectedDest?.id === 'mpesa-primary' || selectedDest?.id === 'mobile' ? `M-PESA (${provider === 'airtel' ? 'Airtel Money' : 'Safaricom'})`
      : selectedDest?.id === 'bank' ? `Bank Transfer · ${bankRail === 'rtgs' ? 'RTGS' : 'PesaLink'}`
      : selectedDest?.id === 'till' ? 'Till Payment'
      : 'Paybill Payment'

    const recipientDisplay =
      selectedDest?.id === 'bank' ? `${formatAccountNumber(recipientAccount)}${bankCode ? ` · ${bankCodes.find(b => b.code === bankCode)?.name || bankCode}` : ''}`
      : selectedDest?.id === 'paybill' ? `Paybill ${recipientAccount}${paybillAccountRef ? ` · Acc ${paybillAccountRef}` : ''}`
      : selectedDest?.id === 'till' ? `Till ${recipientAccount}${paybillAccountRef ? ` · Acc ${paybillAccountRef}` : ''}`
      : formatPhoneDisplay(recipientAccount)

    const phoneNumber =
      (selectedDest?.id === 'mpesa-primary' || selectedDest?.id === 'mobile') ? recipientAccount
      : merchant?.phone

    const payeeDraft =
      (selectedDest?.id === 'mpesa-primary' || selectedDest?.id === 'mobile') ? {
        name: reference || recipientAccount, type: 'contractor', paymentMethod: 'Mobile Money',
        mobileMoneyType: 'Personal Number', mobileNetwork: provider, phone: recipientAccount,
      }
      : selectedDest?.id === 'bank' ? {
        name: reference || recipientAccount, type: 'contractor', paymentMethod: 'Bank',
        bankName: bankCodes.find(b => b.code === bankCode)?.name || '', accountNumber: recipientAccount, bankCode,
      }
      : selectedDest?.id === 'till' ? {
        name: reference || `Till ${recipientAccount}`, type: 'contractor', paymentMethod: 'Mobile Money',
        mobileMoneyType: 'Buy Goods', tillNumber: recipientAccount, businessAccount: paybillAccountRef || undefined,
      }
      : selectedDest?.id === 'paybill' ? {
        name: reference || `Paybill ${recipientAccount}`, type: 'contractor', paymentMethod: 'Mobile Money',
        mobileMoneyType: 'Paybill', paybillNumber: recipientAccount, businessAccount: paybillAccountRef,
      }
      : null

    return (
      <MerchantLayout title="Send Money">
        <div className="max-w-md mx-auto pt-8">
          <TransactionSuccessCard
            amount={amount}
            methodLabel={methodLabel}
            recipientDisplay={recipientDisplay}
            phoneNumber={phoneNumber}
            transaction={completedTx}
            payeeDraft={payeeDraft}
            onViewTransactions={() => navigate('/transactions')}
            onDone={() => navigate('/overview')}
          />
        </div>
      </MerchantLayout>
    )
  }

  return (
    <MerchantLayout title="Send Money">
      <div className="max-w-lg mx-auto animate-fade-in-up">

        {/* Back */}
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/overview')}
          className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-8 group">
          <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">{step > 1 ? 'Back' : 'Dashboard'}</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight">Send Money</h2>
          <p className="text-on-surface-variant font-medium opacity-60 text-sm mt-1">
            Secured with your PayChain payment PIN
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-300 ${
                  step > s.id ? 'bg-[#00351D] border-[#00351D] text-white'
                  : step === s.id ? 'bg-white border-[#00351D] text-[#00351D] shadow-md'
                  : 'bg-white border-slate-200 text-slate-300'
                }`}>
                  {step > s.id
                    ? <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    : <span className="text-xs font-black">{idx + 1}</span>
                  }
                </div>
                <p className={`mt-1.5 text-[9px] uppercase tracking-widest font-black transition-colors whitespace-nowrap ${step >= s.id ? 'text-primary' : 'text-slate-300'}`}>
                  {s.label}
                </p>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500 ${step > s.id ? 'bg-[#00351D]' : 'bg-slate-100'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* Step 1 — Destination */}
          {step === 1 && (
            <div className="p-7 lg:p-9 space-y-6 animate-fade-in-up">
              {/* Balance pill */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="w-10 h-10 rounded-xl bg-[#00351D] text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Available Balance</p>
                  <p className="font-headline text-xl font-bold text-[#00351D]">{formatKES(balance)}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Send To</p>
                <div className="space-y-2">
                  {DESTINATIONS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setDestination(d.id)
                        setRecipientAccount(d.id === 'mpesa-primary' ? merchant?.phone || '' : '')
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group ${
                        destination === d.id
                          ? 'border-[#00351D] bg-[#f0fdf4]'
                          : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        destination === d.id ? 'bg-[#00351D] text-emerald-400' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600'
                      }`}>
                        <span className="material-symbols-outlined text-lg">{d.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold leading-snug transition-colors ${destination === d.id ? 'text-[#00351D]' : 'text-primary'}`}>{d.label}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{d.hint}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {destination === d.id && (
                          <span className="material-symbols-outlined text-[#00351D] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Payment Details */}
          {step === 2 && (
            <div className="p-7 lg:p-9 space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#00351D] text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base">{selectedDest?.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">{selectedDest?.label}</p>
                </div>
              </div>

              {destination === 'bank' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transfer Speed</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'pesalink', title: 'Instant', hint: 'PesaLink · 24/7' },
                      { id: 'rtgs',     title: 'International', hint: 'RTGS · ~3 hrs' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => { setBankRail(opt.id); setBankCode('') }}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                          bankRail === opt.id
                            ? 'border-[#00351D] bg-[#f0fdf4]'
                            : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                        }`}
                      >
                        <p className={`text-sm font-bold ${bankRail === opt.id ? 'text-[#00351D]' : 'text-primary'}`}>{opt.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {destination === 'bank' && bankRail !== 'rtgs' && (
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Bank</label>
                  <select
                    value={bankCode}
                    onChange={e => setBankCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-primary font-bold focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                  >
                    <option value="">Select destination bank</option>
                    {bankCodes.map(b => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {destination === 'bank' && bankRail === 'rtgs' && (
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    RTGS sends to banks outside PesaLink's network, including other East African countries. Settles same business day, ~3 hours. KES only for now.
                  </p>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Beneficiary Bank SWIFT Code</label>
                    <ValidatedInput
                      kind="text"
                      value={bankCode}
                      onChange={e => setBankCode(e.target.value.toUpperCase())}
                      placeholder="e.g. KCBLKENX"
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-primary font-bold uppercase focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Beneficiary Country</label>
                    <select
                      value={beneficiaryCountry}
                      onChange={e => setBeneficiaryCountry(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-primary font-bold focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                    >
                      <option value="KE">Kenya</option>
                      <option value="UG">Uganda</option>
                      <option value="TZ">Tanzania</option>
                      <option value="RW">Rwanda</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Beneficiary Address <span className="text-slate-300 font-medium normal-case">(optional)</span></label>
                    <input
                      type="text"
                      value={beneficiaryAddress}
                      onChange={e => setBeneficiaryAddress(e.target.value)}
                      placeholder="e.g. Nairobi"
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-primary font-medium focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Purpose of Payment Code</label>
                    <input
                      type="text"
                      value={purposeCode}
                      onChange={e => setPurposeCode(e.target.value.toUpperCase())}
                      placeholder="MSC"
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-primary font-bold uppercase focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">"MSC" (Miscellaneous) works for most transfers. If your receiving bank asks for a specific purpose code, enter it here.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {destination === 'mpesa-primary' ? 'Your Registered Number' : destination === 'mobile' ? 'Phone Number' : destination === 'till' ? 'Till Number' : destination === 'paybill' ? 'Paybill Number' : 'Account Number'}
                </label>
                {destination === 'mpesa-primary' ? (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">lock</span>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-primary font-bold">
                      {formatPhoneDisplay(recipientAccount || merchant?.phone) || 'Not on file'}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">
                      {destination === 'mobile' ? 'smartphone' : 'tag'}
                    </span>
                    <ValidatedInput
                      kind={destination === 'mobile' ? 'phoneKE' : destination === 'till' ? 'till' : destination === 'paybill' ? 'paybill' : 'integer'}
                      value={recipientAccount}
                      onChange={e => setRecipientAccount(e.target.value)}
                      placeholder={destination === 'mobile' ? '0712 345 678' : destination === 'till' ? 'Till Number' : destination === 'paybill' ? 'Paybill Number' : 'Account Number'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-primary font-bold focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                      required
                    />
                  </div>
                )}
              </div>

              {isMobileDest && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Network</label>
                  <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    {[
                      { id: 'safaricom', label: 'M-PESA' },
                      { id: 'airtel', label: 'Airtel Money' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setProvider(opt.id)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          provider === opt.id ? 'bg-[#00351D] text-white' : 'text-slate-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isB2bDest && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    {destination === 'paybill' ? 'Account Number' : 'Account Reference (Optional)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">tag</span>
                    <ValidatedInput
                      kind="text"
                      value={paybillAccountRef}
                      onChange={e => setPaybillAccountRef(e.target.value)}
                      placeholder={destination === 'paybill' ? 'Account Number' : 'Account Reference'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-primary font-bold focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                      required={destination === 'paybill'}
                    />
                  </div>
                  {destination === 'till' && (
                    <p className="text-[10px] text-slate-400 px-1">
                      Only needed if this turns out to be registered as a Paybill on Safaricom's side.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">KES</span>
                  <ValidatedInput
                    kind="amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-14 pr-4 text-primary font-headline font-bold text-xl focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                    required
                  />
                </div>
                {Number(amount) > 0 && (
                  <p className={`text-[11px] font-bold ${Number(amount) + fee > balance ? 'text-red-500' : 'text-emerald-600'}`}>
                    Total deduction: {formatKES(totalAmount)}
                    {Number(amount) + fee > balance ? ' — exceeds balance' : ''}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Reference <span className="text-slate-300 font-medium normal-case">(optional)</span></label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. Supplier Payment, Rent"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-primary font-medium focus:border-[#00351D] focus:ring-2 focus:ring-[#00351D]/10 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Set Payment PIN (first time only) */}
          {!hasPin && step === 3 && (
            <div className="p-7 lg:p-9 animate-fade-in-up">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#00351D] flex items-center justify-center mx-auto mb-4 shadow-xl">
                  <span className="material-symbols-outlined text-emerald-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-primary mb-2">Set Payment PIN</h3>
                <p className="text-sm text-on-surface-variant opacity-60 leading-relaxed max-w-xs mx-auto">
                  Create a 4-digit PIN to authorise all money movements. This PIN is shared with the PayChain mobile app — if you already set one there, it works here too.
                </p>
              </div>

              {merchant?.hasAppPin ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 mb-6">
                  <span className="material-symbols-outlined text-emerald-600 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="text-sm text-emerald-800 font-medium">Your payment PIN is already set from the mobile app. You can use it directly to confirm this transfer.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">New PIN</p>
                    <PinBoxes value={newPin} onChange={setNewPin} autoFocus />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Confirm PIN</p>
                    <PinBoxes value={confirmPin} onChange={setConfirmPin} />
                  </div>
                  {pinError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-shake">
                      <span className="material-symbols-outlined text-red-500 text-base shrink-0">error_outline</span>
                      <p className="text-xs font-bold text-red-700">{pinError}</p>
                    </div>
                  )}
                  <p className="text-center text-[10px] text-slate-400 font-medium">
                    This is a one-time setup. Keep your PIN confidential.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Confirm & Send step */}
          {step === confirmStep && (
            <div className="p-7 lg:p-9 space-y-6 animate-fade-in-up">
              {/* Summary */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 bg-[#00351D]">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Transfer Summary</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    ['Destination', selectedDest?.label],
                    ...(destination === 'bank' && bankRail !== 'rtgs' ? [['Bank', bankCodes.find(b => b.code === bankCode)?.name || bankCode]] : []),
                    ...(destination === 'bank' && bankRail === 'rtgs' ? [['Beneficiary Bank BIC', bankCode]] : []),
                    ...(destination === 'bank' ? [['Transfer Speed', bankRail === 'rtgs' ? 'International (RTGS)' : 'Instant (PesaLink)']] : []),
                    ...(destination === 'bank' && bankRail === 'rtgs' ? [['Beneficiary Country', { KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda' }[beneficiaryCountry] || beneficiaryCountry]] : []),
                    ...(isMobileDest ? [['Network', provider === 'airtel' ? 'Airtel Money' : 'M-PESA']] : []),
                    ['Recipient',   formatPhoneDisplay(recipientAccount)],
                    ...(isB2bDest && paybillAccountRef ? [['Account Number', paybillAccountRef]] : []),
                    ['Amount',      formatKES(amount || 0)],
                    ...(reference ? [['Reference', reference]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start gap-4 px-5 py-3">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0 pt-0.5">{k}</span>
                      <span className="text-sm font-bold text-primary text-right break-words">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-5 py-4 bg-emerald-50">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Total Deducted</span>
                    <span className="text-xl font-headline font-black text-[#00351D]">{formatKES(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* PIN entry */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Enter Payment PIN</p>
                  {hasPin && (
                    <p className="text-[10px] text-slate-400">
                      {merchant?.hasAppPin ? 'Use the PIN you set on the mobile app or web dashboard.' : ''}
                    </p>
                  )}
                </div>
                <PinBoxes value={pin} onChange={setPin} autoFocus loading={isLoading} />
                {pinError && (
                  <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-shake">
                    <span className="material-symbols-outlined text-red-500 text-base shrink-0">error_outline</span>
                    <p className="text-xs font-bold text-red-700">{pinError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="px-7 lg:px-9 pb-7 lg:pb-9">
            <button
              onClick={goNext}
              disabled={!canContinue() || isLoading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                canContinue() && !isLoading
                  ? 'bg-[#00351D] text-white shadow-xl shadow-emerald-900/20 hover:opacity-90 active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {isLoading
                ? (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                    <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:450ms]" />
                  </div>
                )
                : step === confirmStep
                  ? <><span className="material-symbols-outlined text-emerald-400 text-lg">send_money</span>Confirm &amp; Send</>
                  : !hasPin && step === 3
                    ? 'Save PIN & Continue'
                    : <>Continue <span className="material-symbols-outlined text-base">arrow_forward</span></>
              }
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          Secured by PayChain KE · PIN-authorised payments
        </p>
      </div>
    </MerchantLayout>
  )
}
