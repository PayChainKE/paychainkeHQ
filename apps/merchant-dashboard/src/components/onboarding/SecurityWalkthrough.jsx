import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import SpotlightTour from './SpotlightTour'

// Each step points at its real section on Profile.jsx (see data-tour
// attributes: biometrics-register, change-password-section,
// change-pin-section) — no `route` needed, this page is already where all
// three live.
const STEPS = [
  {
    icon: 'fingerprint',
    title: 'Enable Biometrics',
    body: 'Register a passkey for Face ID, Touch ID, or Windows Hello — sign in instantly next time, no password needed.',
    target: 'biometrics-register',
  },
  {
    icon: 'lock',
    title: 'Change Password',
    body: 'Update your password any time from here — you\'ll need your current password to confirm the change.',
    target: 'change-password-section',
  },
  {
    icon: 'dialpad',
    title: 'Change PIN',
    body: 'Your Payment PIN authorizes every transfer you make. Change it any time, or reset it if you forget.',
    target: 'change-pin-section',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Shows exactly once, on a merchant's first visit to the Security section
// of Profile — same server-gated one-time pattern as MerchantWalkthrough
// and MyAccountsWalkthrough, scoped to this section. Waits for
// ProfileWalkthrough (same page, above this section) to finish first so the
// two never pop up at once.
export default function SecurityWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenProfileWalkthrough === false) return
    if (merchant.hasSeenSecurityWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenProfileWalkthrough, merchant?.hasSeenSecurityWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/security-walkthrough`)
    } catch (err) {
      console.error('Failed to save security walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  return (
    <SpotlightTour
      steps={STEPS}
      visible={visible}
      onFinish={finish}
      storageKey="paychain_tour_security"
      finishLabel="Got it"
    />
  )
}
