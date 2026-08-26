import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import SpotlightTour from './SpotlightTour'

// Every step but the intro points at a real element on a real page (see
// data-tour attributes: Overview.jsx's balance card/"Move money" trigger,
// MerchantSidebar.jsx's nav links) instead of the old generic centered
// modal — `route` sends the tour to the right page first if the merchant
// isn't already there.
const STEPS = [
  {
    icon: 'waving_hand',
    title: 'Welcome to PayChain',
    body: "A 60-second tour of what you can do here — skip anytime.",
    route: '/overview',
  },
  {
    icon: 'dashboard',
    title: 'Overview',
    body: 'Your home base — balance, recent activity, and quick actions at a glance.',
    route: '/overview',
    target: 'balance-card',
  },
  {
    icon: 'send',
    title: 'Send & Request Money',
    body: 'Tap Move Money to send to M-Pesa or a bank instantly, or request payment from a customer.',
    route: '/overview',
    target: 'move-money-trigger',
  },
  {
    icon: 'group_add',
    title: 'Bulk Payments',
    body: 'Pay salaries, suppliers, or many recipients at once — upload a list, review, and send.',
    route: '/overview',
    target: 'nav-/bulk-pay',
    placement: 'right',
  },
  {
    icon: 'receipt_long',
    title: 'Invoices',
    body: 'Create and send professional invoices, then track who has paid.',
    route: '/overview',
    target: 'nav-/invoices',
    placement: 'right',
  },
  {
    icon: 'payments',
    title: 'Cash Advance',
    body: 'Short-term working capital, made available against your transaction history.',
    route: '/overview',
    target: 'nav-/cash-advance',
    placement: 'right',
  },
  {
    icon: 'settings',
    title: 'Settings & Support',
    body: 'Complete your business profile, manage security, and reach support anytime.',
    route: '/overview',
    target: 'nav-/profile',
    placement: 'right',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// ─── MerchantWalkthrough ───────────────────────────────────────────────────
// Shows exactly once, on a merchant's first dashboard login after signup —
// gated server-side (Merchant.hasSeenOnboardingWalkthrough) so it never
// reappears on another device or after a re-login, unlike BiometricOnboarding
// Modal's localStorage-only approach.
// ────────────────────────────────────────────────────────────────────────────
export default function MerchantWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  // Lazy initializer (not a plain `false` + effect) — a mid-tour step whose
  // route differs from the current page makes SpotlightTour navigate there,
  // which unmounts and remounts this whole component (every page wraps
  // itself in its own <MerchantLayout>, see MerchantLayout.jsx). Starting
  // at `false` and only flipping true in an effect would flash the
  // underlying page for a frame on every such step; merchant is already
  // loaded in context by the time a mid-session navigation happens, so this
  // reads the right value immediately. The effect below still covers the
  // one case this can't: the very first mount of a session, before
  // merchant has loaded at all.
  const [visible, setVisible] = useState(() => merchant?.hasSeenOnboardingWalkthrough === false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenOnboardingWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenOnboardingWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/onboarding-walkthrough`)
    } catch (err) {
      console.error('Failed to save walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  return (
    <SpotlightTour
      steps={STEPS}
      visible={visible}
      onFinish={finish}
      storageKey="paychain_tour_merchant"
      finishLabel="Get Started"
    />
  )
}
