import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/config';
import SpotlightTour from './SpotlightTour';

// Every step but the intro points at a real element on a real screen (see
// <TourTarget id="..."> in Dashboard.tsx and the tab icons in
// AppNavigator.tsx) instead of the old generic centered modal — `screen`
// sends the tour to the right tab first if the merchant isn't already there.
const STEPS = [
  {
    icon: 'sun' as const,
    title: 'Welcome to PayChain',
    body: "A 60-second tour of what you can do here — skip anytime.",
    screen: 'Home',
  },
  {
    icon: 'home' as const,
    title: 'Home',
    body: 'Your balance, recent activity, and quick actions at a glance.',
    screen: 'Home',
    targetId: 'home-balance',
  },
  {
    icon: 'send' as const,
    title: 'Send & Request Money',
    body: 'Send to M-Pesa or bank instantly, or request payment from a customer.',
    screen: 'Home',
    targetId: 'send-request-row',
  },
  {
    icon: 'users' as const,
    title: 'Bulk Payments',
    body: 'Pay salaries, suppliers, or many recipients at once — upload a list, review, and send.',
    screen: 'Home',
    targetId: 'tab-pay',
  },
  {
    icon: 'arrow-down-circle' as const,
    title: 'Transactions',
    body: 'See every payment in and out of your account, track your collections at a glance, and download a statement any time.',
    screen: 'Home',
    targetId: 'tab-collections',
  },
  {
    icon: 'trending-up' as const,
    title: 'Cash Advance',
    body: 'Short-term working capital, made available against your transaction history.',
    screen: 'Home',
    targetId: 'tab-advance',
  },
  {
    icon: 'grid' as const,
    title: 'More',
    body: 'Complete your business profile, manage security, and reach support anytime.',
    screen: 'Home',
    targetId: 'tab-more',
  },
];

// Shows exactly once, on a merchant's first login after signup — gated
// server-side (Merchant.hasSeenOnboardingWalkthrough) so it never reappears
// on another device or after a re-login. Self-contained: mount it once
// (Dashboard.tsx) with no props.
export default function MerchantWalkthrough() {
  const { merchant, refreshSession } = useAuth();
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!merchant || finishedRef.current) return;
    if (merchant.hasSeenOnboardingWalkthrough === false) setVisible(true);
  }, [merchant?._id, merchant?.hasSeenOnboardingWalkthrough]);

  const finish = useCallback(async () => {
    finishedRef.current = true;
    setVisible(false);
    try {
      await api.put('/api/auth/merchant/onboarding-walkthrough');
    } catch (err) {
      console.error('Failed to save walkthrough completion', err);
    }
    refreshSession?.();
  }, [refreshSession]);

  return (
    <SpotlightTour steps={STEPS} visible={visible} onFinish={finish} finishLabel="Get Started" />
  );
}
