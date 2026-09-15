import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// expo-haptics is a no-op on web (and throws on some unsupported Android
// devices) — every call here is wrapped so a screen never needs its own
// try/catch just to add a tap of feedback. Three named moments rather than
// exposing the raw Haptics API directly, so every screen reaches for the
// same handful of feelings instead of picking an arbitrary impact style.

// A button press, a step forward, a selection — the most common one.
export function hapticTap() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Money actually moved, an application was approved, a code verified.
export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// A failed payment, a wrong PIN/OTP, a rejected application.
export function hapticError() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
