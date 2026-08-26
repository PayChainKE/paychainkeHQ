import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import SpotlightTour from './SpotlightTour'

// Points at the real filter bar and Download Statement button on
// Transactions.jsx (see data-tour attributes).
const STEPS = [
  {
    icon: 'receipt_long',
    title: 'Your Transaction History',
    body: 'Every payment in and out of your account lands here — search by reference, or filter by Inbound, Outbound, and FX Swaps.',
    target: 'transactions-filter-bar',
  },
  {
    icon: 'description',
    title: 'Download a Statement',
    body: 'Tap Download Statement, pick a period — last 7 days, 30 days, this month, this year, or a custom range — and download an official PDF. A copy is also emailed to you automatically.',
    target: 'export-statement-btn',
  },
]

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Shows exactly once, on a merchant's first visit to Transactions — same
// server-gated one-time pattern as the other walkthroughs.
export default function TransactionsWalkthrough() {
  const { merchant, refreshSession } = useMerchantAuth()
  const [visible, setVisible] = useState(false)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!merchant || finishedRef.current) return
    if (merchant.hasSeenTransactionsWalkthrough === false) setVisible(true)
  }, [merchant?._id, merchant?.hasSeenTransactionsWalkthrough])

  const finish = useCallback(async () => {
    finishedRef.current = true
    setVisible(false)
    try {
      await axios.put(`${API_URL}/api/auth/merchant/transactions-walkthrough`)
    } catch (err) {
      console.error('Failed to save transactions walkthrough completion', err)
    }
    refreshSession()
  }, [refreshSession])

  return (
    <SpotlightTour
      steps={STEPS}
      visible={visible}
      onFinish={finish}
      storageKey="paychain_tour_transactions"
      finishLabel="Got it"
    />
  )
}
