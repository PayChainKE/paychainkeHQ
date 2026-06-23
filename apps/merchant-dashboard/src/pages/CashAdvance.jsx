import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'

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
          <div className="mb-6 lg:mb-10">
            <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">Cash Advance</h2>
            <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed max-w-2xl">
              Access liquidity against your future collections. Your repayment is automated based on your daily revenue.
            </p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-fade-in-up">
            <div className="w-24 h-24 bg-surface-container-low rounded-full flex items-center justify-center mb-6 border border-slate-200">
              <span className="material-symbols-outlined text-5xl text-amber-600/50">lock</span>
            </div>
            <h3 className="text-2xl font-headline font-bold text-primary mb-3">Keep building your Trust Score</h3>
            <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80 mb-6">
              You need a Trust Score of at least 85 to unlock Cash Advances. Keep processing payments through your Paybill to increase your score!
            </p>
            <a href="/trust-score" className="bg-[#0B0E14] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-black active:scale-95 transition-all">
              View Trust Score
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
            Access liquidity against your future collections. Your repayment is automated based on your daily revenue.
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
