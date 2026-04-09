import React from 'react'
import { mockMerchant } from '../../mockData/merchant'

export default function MerchantHeader({ title }) {
  const unread = mockMerchant.notifications.filter(n => !n.isRead).length
  
  return (
    <header className="sticky top-0 right-0 w-full h-[56px] z-40 bg-white/90 backdrop-blur-md flex justify-between items-center px-8 border-b border-outline-variant/15 glass-header">
      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant text-sm font-medium">Dashboard</span>
        <span className="text-outline-variant text-xs">/</span>
        <span className="text-primary font-bold text-sm">{title}</span>
      </div>
      
      <div className="flex items-center gap-4">
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
