import { useEffect, useState } from 'react'
import axios from 'axios'

// Fire-and-forget report to the backend so the admin Merchants page can
// show "installed" without the merchant doing anything else. Guarded by a
// localStorage flag (not just the backend's own idempotent update) so an
// already-installed merchant doesn't re-hit this endpoint on every single
// page load — persists across sessions, unlike the banner-dismissed flag
// above which deliberately uses sessionStorage.
const REPORTED_KEY = 'pwa_install_reported'
function reportInstalled() {
  if (localStorage.getItem(REPORTED_KEY) === '1') return
  const token = localStorage.getItem('paychain_merchant_token')
  if (!token) return
  const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'
  axios.put(`${API_URL}/api/auth/merchant/pwa-installed`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(() => localStorage.setItem(REPORTED_KEY, '1'))
    .catch(() => {}) // best-effort — never affect the merchant's actual install experience
}

export default function useInstallPrompt() {
  const [prompt, setPrompt]       = useState(null)   // deferred beforeinstallprompt event
  const [isInstalled, setInstalled] = useState(false) // already running as installed PWA
  const [isIOS, setIsIOS]         = useState(false)   // iOS Safari (no beforeinstallprompt)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa_banner_dismissed') === '1'
  )

  useEffect(() => {
    // Already running in standalone / TWA mode → nothing to install. Also
    // proves this merchant genuinely has it installed (this only renders
    // true once actually launched from a home-screen icon), so report it
    // even though the appinstalled event itself was missed — e.g. they
    // installed before this reporting call existed, or on another device.
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
      reportInstalled()
      return
    }

    // iOS Safari: no beforeinstallprompt, use manual "Add to Home Screen" instructions
    const ua = window.navigator.userAgent
    if (/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)) {
      setIsIOS(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // If installed via the prompt later in this session
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setPrompt(null)
      reportInstalled()
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function triggerInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  function dismiss() {
    sessionStorage.setItem('pwa_banner_dismissed', '1')
    setDismissed(true)
  }

  const showBanner = !isInstalled && !dismissed && (!!prompt || isIOS)

  return { showBanner, isIOS, triggerInstall, dismiss }
}
