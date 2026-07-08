import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useNotification } from '../context/NotificationContext'

const ICON_META = {
  payment:  { icon: 'payments',                bg: 'bg-emerald-50', text: 'text-emerald-600' },
  wallet:   { icon: 'account_balance_wallet',   bg: 'bg-blue-50',    text: 'text-blue-600'    },
  security: { icon: 'shield',                   bg: 'bg-amber-50',  text: 'text-amber-600'   },
  default:  { icon: 'notifications',            bg: 'bg-slate-100', text: 'text-slate-500'   },
}
const metaFor = (type) => ICON_META[type] || ICON_META.default

const timeAgo = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Notifications() {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotification()

  const [filter, setFilter] = useState('all')

  const unreadCount = notifications.filter(n => !n.isRead).length
  const visible = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications

  return (
    <MerchantLayout title="Notifications">
      <div className="max-w-3xl mx-auto px-4 lg:px-0 py-6 lg:py-10 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-headline font-bold tracking-tight text-primary">Notifications</h2>
            <p className="text-on-surface-variant text-sm mt-1 opacity-70">
              Everything happening in your business, in one place.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-white text-primary text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-base">done_all</span>
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-outline-variant/20">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: `Unread${unreadCount ? ` (${unreadCount})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                filter === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant/60 hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-2xl border border-outline-variant/15 overflow-hidden editorial-shadow">
          {visible.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl text-slate-300">notifications_none</span>
              </div>
              <h3 className="text-base font-semibold text-primary mb-1">
                {filter === 'unread' ? "You're all caught up" : 'Nothing here yet'}
              </h3>
              <p className="text-on-surface-variant text-sm opacity-60">
                {filter === 'unread'
                  ? 'No unread notifications right now.'
                  : "We'll let you know the moment something needs your attention."}
              </p>
            </div>
          ) : (
            visible.map((n, idx) => {
              const meta = metaFor(n.type)
              return (
                <div
                  key={n.id}
                  className={`group flex gap-4 px-5 lg:px-6 py-4 lg:py-5 transition-colors ${idx !== 0 ? 'border-t border-outline-variant/10' : ''} ${
                    !n.isRead ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
                    <span className="material-symbols-outlined text-xl">{meta.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                          <p className={`text-sm font-semibold truncate ${!n.isRead ? 'text-primary' : 'text-on-surface-variant'}`}>
                            {n.title || 'Notification'}
                          </p>
                        </div>
                        <p className="text-sm text-on-surface-variant/80 mt-0.5 leading-snug">{n.message}</p>
                      </div>
                      <span className="text-xs text-on-surface-variant/50 shrink-0 whitespace-nowrap pt-0.5">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Settings note */}
        <div className="mt-8 bg-[#06201B] rounded-2xl p-6 lg:p-8 flex flex-col sm:flex-row items-start gap-5">
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
            <span className="material-symbols-outlined text-xl">settings_suggest</span>
          </div>
          <div>
            <h4 className="text-white text-base font-semibold mb-1.5">How you're notified</h4>
            <p className="text-white/60 text-sm leading-relaxed">
              Every alert lands here in your dashboard the moment it happens. Want that to change? Reach out to your onboarding officer and we'll sort it out.
            </p>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
