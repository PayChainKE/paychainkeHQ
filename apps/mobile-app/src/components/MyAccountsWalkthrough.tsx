import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import SpotlightTour from './SpotlightTour';

// Points at the real Generate QR / Download Sticker buttons on the first
// account card (see <TourTarget id="..."> in MyAccountsTab.tsx). No
// `screen` needed — this is the default sub-tab of More, already active by
// the time this mounts.
const STEPS = [
  {
    icon: 'maximize' as const,
    title: 'Generate a QR Code',
    body: 'Tap Generate QR on any account to get a scan-to-pay code — customers scan it and pay straight into your balance, no typing an account number.',
    targetId: 'generate-qr-btn',
  },
  {
    icon: 'download' as const,
    title: 'Download Sticker',
    body: 'Download a print-ready paybill sticker for your counter or storefront, pre-filled with your account details.',
    targetId: 'download-sticker-btn',
  },
];

// Shows exactly once, on a merchant's first visit to My Accounts — same
// server-gated one-time pattern as MerchantWalkthrough, scoped to this tab.
export default function MyAccountsWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenAccountsWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenAccountsWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    try {
      await api.put('/api/auth/merchant/accounts-walkthrough');
    } catch (err) {
      console.error('Failed to save accounts walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  return (
    <SpotlightTour steps={STEPS} visible={visible} onFinish={finish} finishLabel="Got it" />
  );
}
