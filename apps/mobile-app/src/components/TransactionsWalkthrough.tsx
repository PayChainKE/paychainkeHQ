import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import SpotlightTour from './SpotlightTour';

// Points at the real transaction list header and Statement export button on
// Transactions.tsx (see <TourTarget id="..."> there). No `screen` needed —
// only mounts once this screen is already open.
const STEPS = [
  {
    icon: 'list' as const,
    title: 'Your Transaction History',
    body: 'Every payment in and out of your account lands here, most recent first.',
    targetId: 'transactions-list-header',
  },
  {
    icon: 'download' as const,
    title: 'Download a Statement',
    body: 'Tap Statement, pick a period — last 7 days, 30 days, this month, this year, or a custom range — and get an official PDF. A copy is also emailed to you automatically.',
    targetId: 'export-statement-btn',
  },
];

// Shows exactly once, on a merchant's first visit to Transactions — same
// server-gated one-time pattern as the other walkthroughs.
export default function TransactionsWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenTransactionsWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenTransactionsWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    try {
      await api.put('/api/auth/merchant/transactions-walkthrough');
    } catch (err) {
      console.error('Failed to save transactions walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  return (
    <SpotlightTour steps={STEPS} visible={visible} onFinish={finish} finishLabel="Got it" />
  );
}
