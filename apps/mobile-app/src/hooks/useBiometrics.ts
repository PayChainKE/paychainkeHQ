import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricSupport = {
  hardware: boolean;
  enrolled: boolean;
  available: boolean;
  types: LocalAuthentication.AuthenticationType[];
};

// Shared with BiometricSetup.tsx and PinEntry.tsx so both screens describe
// the same device capability the same way ("Face ID" vs "Fingerprint" etc.)
// instead of drifting if one gets edited and not the other.
export function biometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris Scan';
  }
  return 'Fingerprint';
}

export type BiometricResult =
  | { success: true }
  | { success: false; error: string; cancelled?: boolean };

const INITIAL_SUPPORT: BiometricSupport = {
  hardware: false,
  enrolled: false,
  available: false,
  types: [],
};

export function useBiometrics() {
  const [support, setSupport] = useState<BiometricSupport>(INITIAL_SUPPORT);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const [hardware, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      setSupport({ hardware, enrolled, available: hardware && enrolled, types });
    } catch (err) {
      console.warn('useBiometrics: hardware probe failed', err);
      setSupport(INITIAL_SUPPORT);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const authenticate = useCallback(
    async (promptMessage: string): Promise<BiometricResult> => {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      if (!hardware) return { success: false, error: 'Device does not support biometrics.' };
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return { success: false, error: 'No biometrics enrolled on this device.' };

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });
        if (result.success) return { success: true };
        const cancelled = result.error === 'user_cancel' || result.error === 'system_cancel';
        return {
          success: false,
          error: cancelled ? 'Biometric prompt cancelled.' : result.error || 'Biometric authentication failed.',
          cancelled,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Biometric authentication failed.' };
      }
    },
    []
  );

  return { support, checking, refresh, authenticate };
}
