import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import SpotlightTour from './SpotlightTour'

// Each step points at its real section on Profile.jsx (see data-tour
// attributes: profile-identity-card, kra-pin-field, update-profile-btn) —
// no `route` needed, this page is already where all three live.
const STEPS = [
  {
    icon: 'badge',
    title: 'Your Identity',
    body: 'Name, phone, and sign-in activity are shown here for your records — your name and phone are locked once your account is set up.',
    target: 'profile-identity-card',
  },
  {
    icon: 'fact_check',
    title: 'KRA PIN & Business Number',
    body: 'Keep these accurate and up to date — they unlock Bulk Payments and are used for compliance and eTIMS filing.',
    target: 'kra-pin-field',
  },
  {
    icon: 'sync',
    title: 'Update Global Profile',
    body: 'Made a change? Tap Update Global Profile at the bottom to save it.',
    target: 'update-profile-btn',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Shows exactly once, on a merchant's first visit to the Profile section of
// Settings — same server-gated one-time pattern as the other walkthroughs.
// Runs BEFORE SecurityWalkthrough (same page, further down) — that one
// waits for this one to finish so the two never pop up at once.
export default function ProfileWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenProfileWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenProfileWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/profile-walkthrough`)
    } catch (err) {
      console.error('Failed to save profile walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  return (
    <SpotlightTour
      steps={STEPS}
      visible={visible}
      onFinish={finish}
      storageKey="paychain_tour_profile"
      finishLabel="Got it"
    />
  )
}
