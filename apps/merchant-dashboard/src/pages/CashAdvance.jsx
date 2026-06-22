import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'
import { formatKES } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'

export default function CashAdvance() {
  const { merchant } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()
  const adv = mockMerchant.cashAdvance.currentAdvance

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
              You need a Trust Score of at least 60 to unlock Cash Advances. Keep processing payments through your Paybill to increase your score!
            </p>
            <a href="/trust-score" className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all">
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

        {/* Section 2: Active Advance Card */}
        <div className="bg-[#00351D] text-white p-8 lg:p-12 rounded-[32px] lg:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0 mb-8 lg:mb-12">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md shrink-0">
                  <span className="material-symbols-outlined text-3xl text-[#5EFEB3]">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-2xl text-white">Active Advance</h3>
                  <p className="text-[10px] text-[#5EFEB3] font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Disbursed {adv.disbursedAt}</p>
                </div>
              </div>
              <div className="text-left md:text-right border-t md:border-0 border-white/10 pt-4 md:pt-0 w-full md:w-auto">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] mb-1">Total Limit</p>
                <p className={`font-headline font-bold text-2xl lg:text-3xl tracking-tight transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(adv.amount)}</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Repayment Progress</p>
                  <p className="text-[10px] text-[#5EFEB3] font-black uppercase tracking-widest">{Math.round(adv.repaidAmount / adv.amount * 100)}% Complete</p>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="bg-[#5EFEB3] h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(94,254,179,0.4)]"
                    style={{ width: `${(adv.repaidAmount / adv.amount * 100)}%` }}
                  ></div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mt-3 text-[10px] text-white/60 font-medium">
                  <p className={!showAmounts ? 'blur-sm' : ''}>KES {adv.repaidAmount.toLocaleString()} repaid</p>
                  <p className={!showAmounts ? 'blur-sm' : ''}>KES {(adv.amount - adv.repaidAmount).toLocaleString()} remaining</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 pt-6 border-t border-white/10">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">Daily Repayment Rate</p>
                  <p className="text-lg font-headline text-white">{adv.repaymentRate}% of collections</p>
                </div>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">Est. Completion</p>
                  <p className="text-lg font-headline text-white">{adv.estimatedCompletionDate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: History & Transparency */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <section className="bg-white p-6 lg:p-8 rounded-[32px] border border-[#E5E7EB] shadow-sm editorial-shadow">
            <h3 className="font-headline font-bold text-xl text-primary mb-6">Terms & Disclosure</h3>
            <div className="space-y-4">
              {[
                { label: 'Origination Fee', value: '3.5%', desc: 'One-time fee added to total amount' },
                { label: 'Interest Method', value: 'Fixed Rate', desc: 'No compounding or hidden daily fees' },
                { label: 'Recourse', value: 'Future Collections', desc: 'Repayment is sourced from your incoming revenue' },
              ].map((term, i) => (
                <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b border-slate-50 last:border-0 gap-2 sm:gap-4">
                  <div>
                    <p className="text-sm font-bold text-primary">{term.label}</p>
                    <p className="text-[11px] text-on-surface-variant opacity-60 leading-relaxed max-w-[200px] sm:max-w-none">{term.desc}</p>
                  </div>
                  <p className="text-sm font-black text-primary uppercase tracking-widest">{term.value}</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-5 bg-[#FAFAF9] hover:bg-[#F0FDF4] border border-[#E5E7EB] text-primary rounded-2xl text-[11px] font-bold transition-all uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">description</span>
              Download Full Agreement
            </button>
          </section>
        </div>
      </div>
    </MerchantLayout>
  )
}
