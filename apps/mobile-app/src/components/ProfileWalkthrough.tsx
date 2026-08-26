import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import SpotlightTour from './SpotlightTour';

// Points at the real identity card / KRA PIN row on Profile.tsx's Business
// Profile panel (see <TourTarget id="..."> there). No `screen` needed on
// either step — this component only ever mounts once that panel is already
// the active sub-tab (see BusinessProfilePanel in Profile.tsx), so both
// targets are already on-screen by the time this becomes visible.
const STEPS = [
  {
    icon: 'user' as const,
    title: 'Your Identity',
    body: 'Business name, email, phone, and your PayChain account number are shown here for your records.',
    targetId: 'profile-identity-card',
  },
  {
    icon: 'file-text' as const,
    title: 'KRA PIN & Business Number',
    body: 'Keep these accurate and up to date — they unlock Bulk Payments and are used for compliance and eTIMS filing.',
    targetId: 'kra-pin-field',
  },
];

// Shows exactly once, on a merchant's first visit to the Business Profile
// section of More — same server-gated one-time pattern as the other
// walkthroughs.
export default function ProfileWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenProfileWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenProfileWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    try {
      await api.put('/api/auth/merchant/profile-walkthrough');
    } catch (err) {
      console.error('Failed to save profile walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  return (
    <SpotlightTour steps={STEPS} visible={visible} onFinish={finish} finishLabel="Got it" />
  );
}
