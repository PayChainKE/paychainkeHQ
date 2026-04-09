import React from 'react'
import { NavLink } from 'react-router-dom'
import { mockMerchant } from '../../mockData/merchant'

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', path: '/overview' },
  { name: 'Collections', icon: 'payments', path: '/transactions' },
  { name: 'Bulk Pay', icon: 'group_add', path: '/bulk-pay' },
  { name: 'Inflation Shield', icon: 'currency_exchange', path: '/inflation-shield' },
  { name: 'Trust Score', icon: 'verified_user', path: '/trust-score' },
]

export default function MerchantSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] z-50 bg-[#1f302b] dark:bg-emerald-950 flex flex-col overflow-y-auto">
      {/* Brand & Identity Header */}
      <div className="p-6">
        <h1 className="font-headline text-2xl text-white tracking-tight">PayChain</h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden">
            <img 
              alt="Merchant Profile Avatar" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqqRMZyoMRVXBMC8LNLpfMkAUupF6H7DdECCf2jI3P-GQ83nzXXfi_Q8B25rhGyusUMGE641H3ANU0DPHwp_Cp25_xadTSiOmjlcjEdI-qZgPzwdYMK02wlungtcuOOMQKOeJr6ckAWa6M-Y2lXvbbzEWnY3hqmHigc2CNwe4dKmZ8S7X2XMcK8-m2v-RXi3jTm4i1tPJPtJwHrEu8AEvDAER89vSENsBGC2I4Nb-KHbMHC8SGFcWU7g_okoilICY7Pfc1uEOQBy--"
            />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight truncate w-[130px]">{mockMerchant.businessName}</p>
            <p className="text-[#c0c9c0] text-[10px] uppercase tracking-wider">Till: {mockMerchant.tillNumber} • Trust: {mockMerchant.trustScore.current}/100</p>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 py-3 px-6 transition-all relative group ${
                isActive 
                ? 'text-[#86f8c9] border-l-4 border-[#86f8c9] bg-emerald-900/30 font-bold' 
                : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-800/20'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`material-symbols-outlined transition-colors ${isActive ? 'text-[#86f8c9]' : 'text-inherit opacity-70 group-hover:opacity-100'}`}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Available Funds Box & Footer Actions */}
      <div className="p-6 mt-auto">
        <div className="bg-emerald-900/40 rounded-xl p-4 mb-6">
          <p className="text-[#86f8c9] text-[10px] font-bold uppercase tracking-widest mb-1">Available Funds</p>
          <p className="text-white font-headline text-lg tracking-tight">KES {new Intl.NumberFormat().format(mockMerchant.financials.kesBalance)}</p>
          <p className="text-[#c0c9c0] text-[10px]">{mockMerchant.financials.usdcBalance.toFixed(2)} USDC</p>
        </div>
        
        <div className="space-y-1">
          <NavLink to="/profile" className="flex items-center gap-3 text-[#c0c9c0] hover:text-white py-2 px-2 transition-colors rounded-lg hover:bg-emerald-800/20">
            <span className="material-symbols-outlined text-sm">settings</span>
            <span className="text-xs">Settings</span>
          </NavLink>
          <NavLink to="/support" className="flex items-center gap-3 text-[#c0c9c0] hover:text-white py-2 px-2 transition-colors rounded-lg hover:bg-emerald-800/20">
            <span className="material-symbols-outlined text-sm">help_outline</span>
            <span className="text-xs">Support</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
