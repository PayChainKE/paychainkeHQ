import React from 'react'
import { useNotification } from '../../context/NotificationContext'

export default function ToastHost() {
  const { toasts } = useNotification()

  const getIcon = (type) => {
    switch (type) {
      case 'advance': return 'payments'
      case 'trust_score': return 'trending_up'
      case 'payment': return 'check_circle'
      default: return 'notifications'
    }
  }

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-4 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          className="pointer-events-auto bg-[#00351D] text-white p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 flex items-center gap-4 animate-in slide-in-from-right-10 fade-in duration-500 relative overflow-hidden group"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-[#5EFEB3]/10 transition-colors"></div>
          
          <div className="w-10 h-10 rounded-xl bg-[#5EFEB3] text-[#00351D] flex items-center justify-center shrink-0 shadow-lg">
            <span className="material-symbols-outlined text-xl">{getIcon(t.type)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5EFEB3]/70 mb-0.5">Notification</p>
            <p className="text-sm font-bold leading-tight">{t.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
