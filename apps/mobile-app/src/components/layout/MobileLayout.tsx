import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { recordActivity } = useAuth();

  // Capture-phase responder hooks fire on every touch anywhere in the app,
  // before any nested Touchable claims it, and returning false declines to
  // actually become the responder — so this observes activity for the idle
  // timer without stealing touches from real interactive elements.
  return (
    <View
      className="flex-1 bg-[#f0fdf4]"
      onStartShouldSetResponderCapture={() => { recordActivity?.(); return false; }}
      onMoveShouldSetResponderCapture={() => { recordActivity?.(); return false; }}
    >
      {children}
    </View>
  );
}
