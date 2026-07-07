import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { ShieldCheck, X } from 'lucide-react'

const CASH_ADVANCE_LEARN_MORE_URL = 'https://www.paychain.co.ke/products/cash-advance'

function UnavailableNotice() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 lg:mb-8">
      <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">info</span>
      <p className="text-[13px] text-amber-900 font-medium leading-relaxed flex-1">
        Cash advance is not available at this time. Keep using your PayChain account and check for your loan limit updates.{' '}
        <a
          href={CASH_ADVANCE_LEARN_MORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline hover:text-amber-950"
        >
          Learn more about cash advance
        </a>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification"
        className="shrink-0 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-full p-1 transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}

export default function CashAdvance() {
  const { merchant } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()

  const [trustData, setTrustData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
        const res = await axios.get(`${API_URL}/api/trust-score`)
        setTrustData(res.data)
      } catch (err) {
        console.error('Failed to fetch trust score', err)
        setTrustData({ eligibleForAdvance: false })
      } finally {
        setIsLoading(false)
      }
    }
    if (merchant) {
      fetchScore()
    } else {
      setIsLoading(false)
    }
  }, [merchant])

  if (isLoading || !trustData) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MerchantLayout>
    )
  }

  // If not eligible, show locked state
  if (!trustData.eligibleForAdvance) {
    return (
      <MerchantLayout title="Cash Advance">
        <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
          <UnavailableNotice />
          <div className="mb-6 lg:mb-10">
            <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">Cash Advance</h2>
            <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed max-w-2xl">
              Get extra cash for your business today. We take back a small bit from your daily sales until it's paid — no paperwork needed.
            </p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mb-6 border border-outline-variant/20 shadow-sm">
              <ShieldCheck className="w-10 h-10 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-headline font-bold text-primary mb-3">Keep building your Trust Score</h3>
            <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80 mb-6">
              Your Trust Score needs to reach 85 before you can get a Cash Advance. Keep transacting through your PayChain account and your score will keep going up!
            </p>
            <a href={CASH_ADVANCE_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer" className="bg-[#0B0E14] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-black active:scale-95 transition-all">
              Learn More
            </a>
          </div>
        </div>
      </MerchantLayout>
    )
  }

  return (
    <MerchantLayout title="Cash Advance">
      <div className="px-1 lg:px-0 max-w-4xl mx-auto w-full space-y-8 lg:space-y-12">
        {/* Section 1: Page Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">Cash Advance</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed max-w-2xl">
            Get extra cash for your business today. We take back a small bit from your daily sales until it's paid — no paperwork needed.
          </p>
        </div>

        {/* Section 2: Eligible Empty State */}
        <div className="bg-[#00351D] text-white p-8 lg:p-12 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5 text-center">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md mb-6">
              <span className="material-symbols-outlined text-4xl text-[#5EFEB3]">verified</span>
            </div>
            <h3 className="font-headline font-bold text-2xl lg:text-3xl text-white mb-2">You are Eligible!</h3>
            <p className="text-sm text-white/70 font-medium max-w-md mx-auto mb-8">
              Based on your Trust Score of {trustData.current}, you are eligible to apply for your first cash advance. Our lending team will be reaching out soon with your official credit limit.
            </p>
            <button className="bg-[#5EFEB3] text-[#00351D] px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-white transition-all active:scale-95">
              Request Credit Limit Review
            </button>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
