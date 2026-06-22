import React from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'
import { usePrivacyMode } from '../hooks/usePrivacyMode'

export default function TrustScore() {
  const { showAmounts } = usePrivacyMode()
  const score = mockMerchant.trustScore.current
  const eligible = mockMerchant.trustScore.eligibleForAdvance
  
  // SVG Ring Constants
  const radius = 80
  const stroke = 12
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (score / 100) * circumference

  const milestones = [
    { label: 'Starter', score: 0, icon: 'nest_eco_leaf', completed: true },
    { label: 'Consistent', score: 60, icon: 'trending_up', completed: score >= 60 },
    { label: 'Growth', score: 80, icon: 'rocket_launch', completed: score >= 80 },
    { label: 'Prime', score: 95, icon: 'diamond', completed: score >= 95 },
  ]

  const factors = [
    { title: 'Transaction Volume', value: `${mockMerchant.trustScore.factors.transactionVolume}%`, color: 'bg-green-500', icon: 'payments' },
    { title: 'Consistency', value: `${mockMerchant.trustScore.factors.consistency}%`, color: 'bg-blue-500', icon: 'calendar_month' },
    { title: 'Growth Rate', value: `${mockMerchant.trustScore.factors.revenueGrowth}%`, color: 'bg-amber-500', icon: 'show_chart' },
    { title: 'Tenure', value: `${mockMerchant.trustScore.factors.tenure}%`, color: 'bg-purple-500', icon: 'history' },
  ]

  return (
    <MerchantLayout title="Trust Score">
      <div className="px-1 lg:px-0 max-w-6xl mx-auto w-full space-y-8 lg:space-y-12">
        {/* Section 1: Hero Score */}
        <div className="flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center mb-6">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="text-surface-container-highest"
              />
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="text-primary transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-5xl text-primary">{score}</span>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Trust Score</span>
            </div>
          </div>
          <h2 className="font-headline text-3xl text-primary tracking-tight">You're doing great, {mockMerchant.name.split(' ')[0]}!</h2>
          <p className="text-on-surface-variant font-medium max-w-md mt-2">
            Your trust score is based on your transaction history and business health. High scores unlock lower interest rates and higher advance limits.
          </p>
          {eligible && (
            <div className="mt-6 flex items-center gap-2 bg-green-500/10 text-green-700 px-4 py-2 rounded-full border border-green-500/20">
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
              <span className="text-xs font-bold uppercase tracking-wider">Cash Advance Eligible</span>
            </div>
          )}
        </div>

        {/* Section 2: Milestone Journey */}
        <div className="bg-white p-5 md:p-6 rounded-2xl lg:rounded-3xl border border-outline-variant/10 shadow-sm editorial-shadow relative overflow-hidden group max-w-4xl mx-auto">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="font-headline text-lg md:text-xl text-primary tracking-tight">Your Growth Journey</h3>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Path to unlocking premium tiers</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              <span className="text-[9px] font-black uppercase tracking-widest">{100 - score} points to Prime</span>
            </div>
          </div>
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0">
            {/* Desktop Connection Line */}
            <div className="hidden md:block absolute top-5 left-[5%] right-[5%] h-1 bg-surface-container-high rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${(score / 95) * 100 > 100 ? 100 : (score / 95) * 100}%` }}
              ></div>
            </div>
            {/* Mobile Connection Line */}
            <div className="block md:hidden absolute left-[19px] top-6 bottom-6 w-1 bg-surface-container-high rounded-full overflow-hidden">
              <div 
                className="w-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                style={{ height: `${(score / 95) * 100 > 100 ? 100 : (score / 95) * 100}%` }}
              ></div>
            </div>

            {milestones.map((m, i) => (
              <div key={i} className="relative z-10 flex md:flex-col items-center gap-4 w-full md:w-auto">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-500 border-2 ${
                  m.completed 
                    ? 'bg-primary border-primary text-white shadow-md md:-translate-y-1' 
                    : 'bg-white border-outline-variant/20 text-on-surface-variant/60 hover:border-primary/20 hover:text-primary'
                }`}>
                  <span className="material-symbols-outlined text-xl md:text-2xl" style={{fontVariationSettings: m.completed ? "'FILL' 1" : ""}}>
                    {m.icon}
                  </span>
                </div>
                <div className="text-left md:text-center flex-1 md:flex-initial">
                  <p className={`text-xs md:text-sm font-headline font-bold tracking-wide ${m.completed ? 'text-primary' : 'text-on-surface-variant/60'}`}>{m.label}</p>
                  <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-0.5 ${m.completed ? 'text-emerald-600' : 'text-on-surface-variant/40'}`}>{m.score} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Key Factors Bento Grid */}
        <div className="animate-fade-in-up [animation-delay:200ms]">
          <h3 className="font-headline text-2xl lg:text-3xl text-primary mb-6 lg:mb-8 tracking-tight">Trust Intelligence</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {factors.map((f, i) => (
              <div key={i} className={`p-8 rounded-[32px] border border-outline-variant/5 shadow-sm editorial-shadow transition-all hover:translate-y-[-4px] cursor-pointer group ${
                i === 0 ? 'bg-emerald-500/5' : i === 1 ? 'bg-blue-500/5' : i === 2 ? 'bg-amber-500/5' : 'bg-indigo-500/5'
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center ${f.color.replace('bg-', 'text-')}`}>
                    <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                  </div>
                  <span className={`text-lg font-headline ${f.color.replace('bg-', 'text-')}`}>{f.value}</span>
                </div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-4">{f.title}</p>
                <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden border border-outline-variant/10">
                  <div 
                    className={`h-full ${f.color} rounded-full transition-all duration-1000`} 
                    style={{ width: f.value }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Algorithm Transparency */}
        <div className="bg-secondary-fixed/5 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h4 className="font-headline text-xl text-primary mb-2">How it works</h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Paychain uses a machine learning algorithm to assess your business stability based on your collection consistency, growth, and repayment history. Transparent finance is our core value—no hidden factors, just your hard work reflected in your score.
            </p>
          </div>
          <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-sm">info</span>
            Full Integrity Report
          </button>
        </div>
      </div>
    </MerchantLayout>
  )
}
