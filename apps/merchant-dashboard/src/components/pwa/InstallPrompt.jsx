import React, { useEffect, useState, useCallback } from 'react'

const DISMISS_KEY = 'paychain_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days — re-offer later rather than never again

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // legacy iOS Safari flag
  )
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function recentlyDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS
}

// Mobile-only install banner. Android/Chrome/Edge get a real one-tap
// install via the captured `beforeinstallprompt` event; iOS Safari never
// fires that event at all (Apple's choice), so it gets manual "Share ->
// Add to Home Screen" instructions instead — that's the only way to
// install a PWA on iOS.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState(null) // 'android' | 'ios'
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return

    if (isIOS()) {
      setMode('ios')
      setVisible(true)
      return
    }

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setMode('android')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    const onInstalled = () => {
      setVisible(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
      setVisible(false)
    }
  }, [deferredPrompt])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] sm:hidden animate-in slide-in-from-bottom-6 fade-in duration-500">
      <div className="bg-[#00351D] text-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-white/10 p-4 flex items-start gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#5EFEB3]/10 rounded-full -mr-10 -mt-10 blur-2xl" />

        <div className="w-11 h-11 rounded-xl bg-[#5EFEB3] text-[#00351D] flex items-center justify-center shrink-0 shadow-lg">
          <img src="/icons/icon-192.png" alt="" className="w-7 h-7" />
        </div>

        <div className="flex-1 min-w-0 relative">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5EFEB3]/70 mb-0.5">Install App</p>
          {mode === 'ios' ? (
            <p className="text-xs font-medium leading-snug text-white/90">
              Add PayChain to your Home Screen: tap{' '}
              <span className="material-symbols-outlined align-middle text-sm mx-0.5">ios_share</span>
              Share, then <strong>"Add to Home Screen"</strong>.
            </p>
          ) : (
            <p className="text-xs font-medium leading-snug text-white/90">
              Get the full-screen PayChain app on your phone — faster access, no browser bar.
            </p>
          )}

          <div className="flex items-center gap-3 mt-2.5">
            {mode === 'android' && (
              <button
                onClick={install}
                disabled={installing}
                className="px-3.5 py-1.5 rounded-lg bg-[#5EFEB3] text-[#00351D] text-[11px] font-black uppercase tracking-widest hover:brightness-95 disabled:opacity-50 transition-all"
              >
                {installing ? 'Installing…' : 'Install'}
              </button>
            )}
            <button
              onClick={dismiss}
              className="text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
