import React, { useEffect, useState } from 'react'
import appMark from '../assets/paychain-mark.png'

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ke.co.paychain.app'

const BANNER_DISMISSED_KEY = 'paychain_get_app_banner_dismissed'

// Small helpers — localStorage can throw (private windows, blocked storage),
// and none of this is worth breaking the login page over.
function readDismissed() {
  try { return localStorage.getItem(BANNER_DISMISSED_KEY) === '1' } catch { return false }
}
function writeDismissed() {
  try { localStorage.setItem(BANNER_DISMISSED_KEY, '1') } catch { /* ignore */ }
}

// The app is on Google Play only, so the phone banner is for Android visitors.
// Showing it to an iPhone user would send them to a store page they cannot
// install from. Also skipped when the dashboard is already running as an
// installed app (standalone display mode).
function shouldShowPhoneBanner() {
  if (typeof window === 'undefined') return false
  const isAndroid = /Android/i.test(window.navigator.userAgent || '')
  const isSmallScreen = window.matchMedia?.('(max-width: 767px)').matches
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
  return Boolean(isAndroid && isSmallScreen && !isStandalone)
}

function PlayStoreButton({ className = '', tone = 'light', label = 'Get the app', source }) {
  const styles = tone === 'light'
    ? 'bg-emerald-400 text-[#06201B] hover:bg-emerald-300'
    : 'bg-[#06201B] text-white hover:opacity-90'
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-source={source}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black tracking-wide transition-all active:scale-[0.97] ${styles} ${className}`}
    >
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>android</span>
      {label}
    </a>
  )
}

// Compact, dismissible banner for the login screen on an Android phone.
export function GetAppBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(shouldShowPhoneBanner() && !readDismissed())
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Get the PayChain app"
      className="mb-6 flex items-center gap-3 rounded-2xl bg-[#06201B] p-3 pr-2 shadow-[0_12px_30px_rgba(6,32,27,0.25)] animate-fade-in-up"
    >
      <img src={appMark} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black leading-tight text-white">Manage your business on the go</p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-emerald-100/60">Get the PayChain app, free on Google Play</p>
      </div>
      <PlayStoreButton source="login_banner" label="Get app" className="shrink-0" />
      <button
        type="button"
        onClick={() => { writeDismissed(); setVisible(false) }}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1.5 text-emerald-100/40 hover:text-white"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  )
}

const APP_POINTS = [
  { icon: 'notifications_active', text: 'See every payment the moment it lands' },
  { icon: 'groups', text: 'Pay staff and suppliers with Bulk Pay' },
  { icon: 'fingerprint', text: 'Sign in quickly with your fingerprint' },
]

// Fuller card shown once a merchant has an account (after they submit their
// application and after they set their password).
export function GetAppCard({ heading = 'Take PayChain with you', source = 'card', className = '' }) {
  return (
    <div className={`w-full overflow-hidden rounded-3xl bg-[#06201B] p-5 text-left shadow-[0_20px_50px_rgba(6,32,27,0.2)] ${className}`}>
      <div className="flex items-center gap-3">
        <img src={appMark} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-2" />
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400/70">PayChain app</p>
          <h4 className="text-base font-black leading-tight text-white">{heading}</h4>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {APP_POINTS.map((p) => (
          <li key={p.icon} className="flex items-center gap-3 text-[13px] font-medium text-emerald-50/80">
            <span className="material-symbols-outlined text-lg text-emerald-400">{p.icon}</span>
            {p.text}
          </li>
        ))}
      </ul>
      <PlayStoreButton source={source} label="Get it on Google Play" className="mt-5 w-full py-3 text-sm" />
      <p className="mt-2.5 text-center text-[10px] font-medium text-emerald-100/40">Free for Android. Use the same login as on the web.</p>
    </div>
  )
}
