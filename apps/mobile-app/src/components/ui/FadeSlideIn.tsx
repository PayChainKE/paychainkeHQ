import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

// A single, shared entrance animation so every primary screen enters the
// same way instead of just snapping into view — subtle on purpose (12px
// rise + fade over 260ms), meant to be felt more than noticed. Not used for
// modals/success states that already have their own bespoke animation (see
// BiometricSetup.tsx's ScannerRing) — those stay as-is.
export default function FadeSlideIn({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
    // Runs once on mount only — a re-render (e.g. a data refresh) must
    // never replay the entrance animation, only the initial navigation to
    // this screen should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
