import React from 'react'
import { mockMerchant } from '../../mockData/merchant'
import { usePrivacyMode } from '../../hooks/usePrivacyMode'

export default function MerchantHeader({ title, onMenuClick }) {
  const { showAmounts, togglePrivacy } = usePrivacyMode()
  const unread = mockMerchant.notifications.filter(n => !n.isRead).length
  
  return (
    <header className="sticky top-0 right-0 w-full h-[64px] lg:h-[56px] z-40 bg-white/90 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 border-b border-outline-variant/15 glass-header transition-all">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 hover:bg-emerald-50 rounded-full text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant text-[10px] lg:text-sm font-medium opacity-60 hidden sm:inline">Dashboard</span>
          <span className="text-outline-variant text-xs hidden sm:inline">/</span>
          <span className="text-primary font-bold text-xs lg:text-sm truncate max-w-[120px] lg:max-w-none">{title}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 lg:gap-4">
        <button 
          onClick={togglePrivacy}
          className="hover:bg-emerald-50 rounded-full p-2 transition-colors flex items-center justify-center group"
          title={showAmounts ? "Hide Sensitive Data" : "Show Sensitive Data"}
        >
          <span className={`material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors ${!showAmounts ? 'text-primary' : ''}`}>
            {showAmounts ? 'visibility' : 'visibility_off'}
          </span>
        </button>
        <button className="hover:bg-emerald-50 rounded-full p-2 transition-colors relative">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          {unread > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
          )}
        </button>
        <button className="hover:bg-emerald-50 rounded-full p-2 transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
        </button>
      </div>
    </header>
  )
}
