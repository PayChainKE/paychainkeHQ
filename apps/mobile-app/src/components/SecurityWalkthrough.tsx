import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import SpotlightTour from './SpotlightTour';

// Points at the real biometrics/password/PIN sections on SecurityTab.tsx
// (see <TourTarget id="..."> there). No `screen` needed — this component
// only ever mounts once Security is the active sub-tab of More, so every
// target is already on-screen by the time this becomes visible.
const STEPS = [
  {
    icon: 'unlock' as const,
    title: 'Enable Biometrics',
    body: 'Turn on Face ID or Touch ID for instant, secure sign-in — no password needed.',
    targetId: 'biometrics-register',
  },
  {
    icon: 'lock' as const,
    title: 'Change Password',
    body: 'Update your password any time from here — you\'ll need your current password to confirm the change.',
    targetId: 'change-password-section',
  },
  {
    icon: 'grid' as const,
    title: 'Change PIN',
    body: 'Your Payment PIN authorizes every transfer you make. Change it any time, or reset it if you forget.',
    targetId: 'change-pin-section',
  },
];

// Shows exactly once, on a merchant's first visit to the Security tab —
// same server-gated one-time pattern as the other walkthroughs.
export default function SecurityWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenSecurityWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenSecurityWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    try {
      await api.put('/api/auth/merchant/security-walkthrough');
    } catch (err) {
      console.error('Failed to save security walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  return (
    <SpotlightTour steps={STEPS} visible={visible} onFinish={finish} finishLabel="Got it" />
  );
}
