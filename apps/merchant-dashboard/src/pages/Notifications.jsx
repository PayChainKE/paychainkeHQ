import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { mockMerchant } from '../mockData/merchant'

export default function Notifications() {
  const [notifications, setNotifications] = useState(mockMerchant.notifications)

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    // Update mock data globally for consistency in this demo
    const n = mockMerchant.notifications.find(item => item.id === id)
    if (n) n.isRead = true
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    mockMerchant.notifications.forEach(n => n.isRead = true)
  }

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    mockMerchant.notifications = mockMerchant.notifications.filter(n => n.id !== id)
  }

  const getIcon = (type) => {
    switch (type) {
      case 'advance': return 'payments'
      case 'trust_score': return 'trending_up'
      case 'payment': return 'check_circle'
      default: return 'notifications'
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'advance': return 'text-emerald-600'
      case 'trust_score': return 'text-blue-600'
      case 'payment': return 'text-purple-600'
      default: return 'text-primary'
    }
  }

  return (
    <MerchantLayout title="Notifications">
      <div className="max-w-4xl mx-auto px-4 lg:px-0 py-6 lg:py-10 animate-fade-in-up">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 lg:mb-12">
          <div>
            <h2 className="text-3xl lg:text-5xl font-headline font-bold tracking-tight text-primary">Alert Center</h2>
            <p className="text-on-surface-variant font-medium mt-1 opacity-70">
              Stay updated with your business performance and account alerts.
            </p>
          </div>
          <button 
            onClick={markAllAsRead}
            className="px-4 py-2 bg-white text-emerald-700 text-xs font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 border border-slate-200 shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-base">done_all</span>
            Mark all as read
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-[32px] p-16 text-center border border-outline-variant/15 editorial-shadow">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-emerald-600 opacity-30">notifications_off</span>
              </div>
              <h3 className="text-xl font-headline text-primary mb-2">Inbox is clear</h3>
              <p className="text-on-surface-variant opacity-60">You're all caught up! No new notifications.</p>
            </div>
          ) : (
            notifications.map((n, idx) => (
              <div 
                key={n.id}
                className={`group relative bg-white rounded-3xl p-5 lg:p-6 border transition-all duration-300 editorial-shadow hover:-translate-y-1 ${!n.isRead ? 'border-primary/20 bg-emerald-50/20 ring-1 ring-primary/5' : 'border-outline-variant/15 opacity-80 hover:opacity-100'}`}
              >
                {!n.isRead && (
                  <div className="absolute top-6 right-6 w-2 h-2 bg-red-600 rounded-full ring-4 ring-red-600/10 animate-pulse"></div>
                )}
                
                <div className="flex gap-4 lg:gap-6">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-500 ${getIconColor(n.type)}`}>
                    <span className="material-symbols-outlined text-3xl lg:text-4xl">{getIcon(n.type)}</span>
                  </div>
                  
                  <div className="flex-1 pr-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                         {new Date(n.createdAt).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                    <p className={`text-base lg:text-lg font-bold leading-snug tracking-tight ${!n.isRead ? 'text-primary' : 'text-on-surface-variant'}`}>{n.message}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                      {!n.isRead && (
                        <button 
                          onClick={() => markAsRead(n.id)}
                          className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotification(n.id)}
                        className="text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Box - Dark Green Premium Theme */}
        <div className="mt-10 lg:mt-16 bg-[#06201B] p-6 lg:p-12 rounded-[32px] lg:rounded-[40px] relative overflow-hidden group shadow-2xl">
          {/* Glassmorphic Highlights */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-20 pointer-events-none transition-transform duration-1000 group-hover:scale-150"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-600 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
          
          <div className="flex flex-col lg:flex-row items-center lg:items-center gap-8 lg:gap-12 relative z-10">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner backdrop-blur-sm">
              <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform duration-500">settings_suggest</span>
            </div>
            
            <div className="flex-1 text-center lg:text-left">
              <h4 className="text-white text-xl sm:text-2xl lg:text-4xl font-headline font-bold tracking-tight mb-3 lg:mb-4">Notification Settings</h4>
              <p className="text-blue-100/70 text-sm lg:text-xl leading-relaxed max-w-2xl font-medium mx-auto lg:mx-0">
                You're currently receiving all system alerts via the <span className="text-emerald-400 font-black">Merchant Dashboard</span> and <span className="text-white font-black">primary registered phone number</span>. 
              </p>
              <div className="mt-8 flex flex-col lg:flex-row items-center gap-3 text-emerald-400/60 transition-colors group-hover:text-emerald-400">
                <span className="material-symbols-outlined text-xl">info</span>
                <p className="text-[10px] lg:text-[12px] font-black uppercase tracking-[0.2em]">To adjust your preferences, contact your onboarding officer.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
