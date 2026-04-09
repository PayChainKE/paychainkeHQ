import { useState, useEffect } from 'react'

const STORAGE_KEY = 'paychain_privacy_mode'
const EVENT_NAME = 'paychain_privacy_toggle'

export function usePrivacyMode() {
  const [showAmounts, setShowAmounts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved !== null ? JSON.parse(saved) : true
  })

  // Function to toggle the state and notify other components
  const togglePrivacy = () => {
    const newState = !showAmounts
    setShowAmounts(newState)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    window.dispatchEvent(new Event(EVENT_NAME))
  }

  useEffect(() => {
    const handleToggle = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      setShowAmounts(saved !== null ? JSON.parse(saved) : true)
    }
    window.addEventListener(EVENT_NAME, handleToggle)
    return () => window.removeEventListener(EVENT_NAME, handleToggle)
  }, [])

  return { showAmounts, togglePrivacy }
}
