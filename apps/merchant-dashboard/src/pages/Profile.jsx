import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'
import { useToast } from '../context/ToastContext'
import { usePrivacyMode } from '../hooks/usePrivacyMode'

export default function Profile() {
  const { showAmounts } = usePrivacyMode()
  const [name, setName] = useState(mockMerchant.name)
  const [email, setEmail] = useState(mockMerchant.email)
  const [autoSettle, setAutoSettle] = useState(true)
  const toast = useToast()

  async function save() {
    await new Promise(r => setTimeout(r, 700))
    toast.push({ message: 'Profile updated' })
  }

  const loginHistory = [
    { device: 'iPhone 15 Pro', location: 'Nairobi, KE', time: 'Active now' },
    { device: 'MacBook Pro 16"', location: 'Nairobi, KE', time: '2 hours ago' },
    { device: 'Chrome on Windows', location: 'Mombasa, KE', time: 'Yesterday' },
  ]

  return (
    <MerchantLayout title="Settings">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline text-3xl lg:text-4xl text-primary tracking-tight">Settings</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">Manage your business profile, settlement rules, and security preferences.</p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Settings Area */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            
            {/* Section 1: Business Profile */}
            <div className="bg-surface-container-lowest p-10 rounded-[40px] border border-outline-variant/5 shadow-sm editorial-shadow animate-fade-in-up [animation-delay:100ms]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-headline text-2xl text-primary tracking-tight">Business Profile</h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-700 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-emerald-500/10">Verified Business</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] pl-1 opacity-60">Legal Entity</label>
                  <div className="relative group">
                    <input 
                      className="w-full bg-surface-container-low/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary transition-all"
                      value={mockMerchant.businessName}
                      disabled
                    />
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm opacity-20">lock</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] pl-1 opacity-60">Contact Email</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-surface-container-low/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-primary/40 text-sm">edit</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] pl-1 opacity-60">Authorized Signatory</label>
                  <input 
                    className="w-full bg-surface-container-low/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] pl-1 opacity-60">Global Identifier</label>
                  <input 
                    className="w-full bg-surface-container-low/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary transition-all"
                    value={mockMerchant.phone}
                    disabled
                  />
                </div>
              </div>
              <div className="mt-10 flex justify-end">
                <button 
                  onClick={save}
                  className="bg-primary text-white px-10 py-4 rounded-2xl font-bold text-sm shadow-xl hover:bg-primary-container transition-all flex items-center gap-3 active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  Synchronize Profile
                </button>
              </div>
            </div>

            {/* Section 2: Settlement Configuration */}
            <div className="bg-surface-container-lowest p-10 rounded-[40px] border border-outline-variant/5 shadow-sm editorial-shadow animate-fade-in-up [animation-delay:200ms]">
              <div className="mb-8">
                <h3 className="font-headline text-2xl text-primary tracking-tight">Settlement Logic</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Autonomous Treasury Rules</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col justify-between p-8 bg-emerald-500/5 rounded-[32px] border border-emerald-500/10 hover:bg-emerald-500/[0.08] transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600 mb-6">
                    <span className="material-symbols-outlined text-2xl">bolt</span>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-lg font-headline text-primary">Auto-Settle</p>
                      <button 
                        onClick={() => setAutoSettle(!autoSettle)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${autoSettle ? 'bg-emerald-600' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoSettle ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">Instantly transfer KES to linked bank when balance exceeds threshold.</p>
                  </div>
                </div>

                <div className="flex flex-col justify-between p-8 bg-blue-500/5 rounded-[32px] border border-blue-500/10 hover:bg-blue-500/[0.08] transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 mb-6">
                    <span className="material-symbols-outlined text-2xl">shield_moon</span>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-lg font-headline text-primary">Auto-Shield</p>
                      <button className="w-12 h-6 rounded-full bg-surface-container-highest relative">
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"></div>
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">Automatically convert a percentage of incoming KES to stable USDC.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            
            {/* Merchant ID Card */}
            <div className="bg-[#0A2540] p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white mb-6">
                  <span className="material-symbols-outlined text-2xl">id_card</span>
                </div>
                <h4 className="text-[10px] text-blue-200/60 font-bold uppercase tracking-widest mb-1">Merchant Identity</h4>
                <p className={`font-headline text-2xl lg:text-3xl mb-1 transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{mockMerchant.tillNumber}</p>
                <p className="text-sm text-blue-100/60 font-medium">Verified Merchant since Oct 2025</p>
                <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-sm" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-widest">Active Status</span>
                </div>
              </div>
            </div>

            {/* Security Mini-Bento */}
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 shadow-sm editorial-shadow">
              <h3 className="font-headline text-lg text-primary mb-6">Security History</h3>
              <div className="space-y-6">
                {loginHistory.map((log, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">{log.device.includes('iPhone') ? 'smartphone' : 'laptop_mac'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{log.device}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">{log.location} • {log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-8 py-3 rounded-xl border border-outline-variant/20 text-xs font-bold text-primary hover:bg-surface-container-low transition-colors">
                Sign Out All Devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
