import { useEffect, useState } from 'react'

export default function useInstallPrompt() {
  const [prompt, setPrompt]       = useState(null)   // deferred beforeinstallprompt event
  const [isInstalled, setInstalled] = useState(false) // already running as installed PWA
  const [isIOS, setIsIOS]         = useState(false)   // iOS Safari (no beforeinstallprompt)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa_banner_dismissed') === '1'
  )

  useEffect(() => {
    // Already running in standalone / TWA mode → nothing to install
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
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
