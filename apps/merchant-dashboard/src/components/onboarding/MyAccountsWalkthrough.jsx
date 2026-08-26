import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import SpotlightTour from './SpotlightTour'

// Points at the real Generate QR / Download Sticker buttons on the first
// account row (see data-tour attributes in MyAccounts.jsx).
const STEPS = [
  {
    icon: 'qr_code_2',
    title: 'Generate a QR Code',
    body: 'Tap Generate QR on any account to get a scan-to-pay code — customers scan it and pay straight into your balance, no typing an account number.',
    target: 'generate-qr-btn',
  },
  {
    icon: 'download',
    title: 'Download Sticker',
    body: 'Download a print-ready paybill sticker for your counter or storefront, pre-filled with your account details.',
    target: 'download-sticker-btn',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Shows exactly once, on a merchant's first visit to My Accounts — same
// server-gated one-time pattern as MerchantWalkthrough, scoped to this page.
export default function MyAccountsWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenAccountsWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenAccountsWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/accounts-walkthrough`)
    } catch (err) {
      console.error('Failed to save accounts walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  return (
    <SpotlightTour
      steps={STEPS}
      visible={visible}
      onFinish={finish}
      storageKey="paychain_tour_accounts"
      finishLabel="Got it"
    />
  )
}
