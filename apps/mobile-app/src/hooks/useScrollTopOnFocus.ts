import { useCallback, useRef } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Every screen in this app is registered as a tab (including the "hidden"
// ones like SendMoney/RequestMoney/Notifications — see AppNavigator.tsx's
// tabBarButton: () => null screens), and React Navigation's bottom tab
// navigator keeps every visited tab mounted rather than unmounting it on
// navigation away. That means a ScrollView's scroll position survives a
// round trip to another tab and back — a merchant who scrolled halfway
// down Transactions, switched to Pay, then came back, landed exactly where
// they left off instead of at the top of the screen they just navigated
// to. useScrollToTop from @react-navigation/native doesn't cover this —
// it only fires on re-pressing an already-active tab, not on navigating to
// a screen fresh. This resets scroll position on every focus instead.
export function useScrollTopOnFocus() {
  const ref = useRef<ScrollView>(null);

  // Wrapped in useCallback with no deps — without it, a fresh function
  // identity every render (e.g. from a screen's own polling/timer state,
  // like Dashboard's promo carousel autoplay or clock tick) re-fires this
  // effect on every render, not just on actual focus, yanking the scroll
  // back to the top repeatedly while the merchant is mid-scroll.
  useFocusEffect(
    useCallback(() => {
      ref.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  return ref;
}
