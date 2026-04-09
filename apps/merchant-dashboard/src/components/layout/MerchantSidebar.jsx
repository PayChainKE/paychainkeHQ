import React from 'react'
import { NavLink } from 'react-router-dom'
import { mockMerchant } from '../../mockData/merchant'
import { usePrivacyMode } from '../../hooks/usePrivacyMode'

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', path: '/overview' },
  { name: 'Collections', icon: 'payments', path: '/transactions' },
  { name: 'Bulk Pay', icon: 'group_add', path: '/bulk-pay' },
  { name: 'Inflation Shield', icon: 'currency_exchange', path: '/inflation-shield' },
  { name: 'Trust Score', icon: 'verified_user', path: '/trust-score' },
]

export default function MerchantSidebar({ isOpen, onClose }) {
  const { showAmounts } = usePrivacyMode()

  return (
    <aside className={`fixed left-0 top-0 h-full w-[240px] z-[50] bg-[#162723] flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
      {/* Close Button Mobile Only */}
      <button 
        onClick={onClose}
        className="lg:hidden absolute top-6 right-6 text-white/40 hover:text-white"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      {/* Brand & Identity Header */}
      <div className="p-6">
        <h1 className="font-headline font-bold text-3xl text-white tracking-tight mb-8">PayChain</h1>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center overflow-hidden border border-white/10 shadow-sm">
            <img 
              alt="Merchant Profile Avatar" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqqRMZyoMRVXBMC8LNLpfMkAUupF6H7DdECCf2jI3P-GQ83nzXXfi_Q8B25rhGyusUMGE641H3ANU0DPHwp_Cp25_xadTSiOmjlcjEdI-qZgPzwdYMK02wlungtcuOOMQKOeJr6ckAWa6M-Y2lXvbbzEWnY3hqmHigc2CNwe4dKmZ8S7X2XMcK8-m2v-RXi3jTm4i1tPJPtJwHrEu8AEvDAER89vSENsBGC2I4Nb-KHbMHC8SGFcWU7g_okoilICY7Pfc1uEOQBy--"
            />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight truncate w-[130px]">{mockMerchant.businessName}</p>
            <p className="text-[#a8b3a8] text-[9px] uppercase tracking-wider mt-0.5">TILL: {mockMerchant.tillNumber} • TRUST: {mockMerchant.trustScore.current}/100</p>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 mt-6">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 py-3.5 px-6 transition-all relative group ${
                isActive 
                ? 'text-[#5EFEB3] bg-[#0E3D2E] font-bold after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-[#5EFEB3]' 
                : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-900/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`material-symbols-outlined transition-colors text-xl ${isActive ? 'text-[#5EFEB3]' : 'text-inherit opacity-60 group-hover:opacity-100'}`}>
                  {item.icon}
                </span>
                <span className="text-xs tracking-wide">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Available Funds Box & Footer Actions */}
      <div className="p-6 mt-auto">
        <div className="bg-[#0D241E] rounded-[16px] p-5 mb-8 border border-white/5">
          <p className="text-[#5EFEB3] text-[9px] font-bold uppercase tracking-widest mb-2">Available Funds</p>
          <p className={`text-white font-headline text-2xl tracking-tight mb-0.5 transition-all duration-300 ${!showAmounts && 'blur-md'}`}>KES {new Intl.NumberFormat().format(mockMerchant.financials.kesBalance)}</p>
          <p className={`text-[#a8b3a8] text-[10px] transition-all duration-300 ${!showAmounts && 'blur-sm'}`}>{mockMerchant.financials.usdcBalance.toFixed(2)} USDC</p>
        </div>
        
        <div className="space-y-1 pt-4 border-t border-white/5">
          <NavLink to="/profile" className="flex items-center gap-3 text-[#c0c9c0] hover:text-white py-2 px-1 transition-colors group">
            <span className="material-symbols-outlined text-lg opacity-60 group-hover:opacity-100 transition-opacity">settings</span>
            <span className="text-xs">Settings</span>
          </NavLink>
          <NavLink to="/support" className="flex items-center gap-3 text-[#c0c9c0] hover:text-white py-2 px-1 transition-colors group">
            <span className="material-symbols-outlined text-lg opacity-60 group-hover:opacity-100 transition-opacity">help_outline</span>
            <span className="text-xs">Support</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
