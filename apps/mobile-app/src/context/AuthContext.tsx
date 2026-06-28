import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../api/config';

const AuthContext = createContext<any>(null);

// Merchant profile (non-sensitive) stored in AsyncStorage — readable without biometrics.
const STORAGE_KEY = 'paychain_merchant_session';
// JWT stored in the OS secure enclave (iOS Keychain / Android Keystore).
// Requires biometric authentication to read when biometrics are enabled.
const TOKEN_KEY = 'paychain_merchant_token';
// Flag stored in AsyncStorage: 'true' means SecureStore holds a valid JWT
// and the user has enabled biometric login for this device.
const BIOMETRIC_ENABLED_KEY = 'paychain_biometrics_enabled';

// ── SecureStore helpers ──────────────────────────────────────────────────────
async function storeToken(jwt: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, jwt);
}
async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant, setMerchant] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [appPin, setAppPinState] = useState<string | null>(null);
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [hasSetBiometrics, setHasSetBiometrics] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);

  // ── Session restore on app launch ─────────────────────────────────────────
  useEffect(() => {
    const loadSession = async () => {
      try {
        const [rawMerchant, rawOnboarding, rawPin, rawBiometricSetup, rawBiometricEnabled] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEY),
            AsyncStorage.getItem('paychain_onboarding_complete'),
            AsyncStorage.getItem('paychain_app_pin'),
            AsyncStorage.getItem('paychain_biometrics_setup'),
            AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY),
          ]);

        if (rawOnboarding === 'true')   setHasCompletedOnboarding(true);
        if (rawPin)                     setAppPinState(rawPin);
        if (rawBiometricSetup === 'true') setHasSetBiometrics(true);
        if (rawBiometricEnabled === 'true') setIsBiometricsEnabled(true);

        if (rawMerchant) {
          // JWT is in SecureStore — retrieve it and restore the axios header.
          const jwt = await loadToken();
          if (jwt) {
            const parsed = JSON.parse(rawMerchant);
            setMerchant(parsed);
            setToken(jwt);
            api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;

            // Refresh from server in the background
            api.get('/api/auth/merchant/me')
              .then(async (res) => {
                if (res.data.success && res.data.merchant) {
                  setMerchant(res.data.merchant);
                  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
                }
              })
              .catch((err) => {
                if (err.response?.status === 401) logout();
              });
          }
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // ── Internal helper: persist a successful login ───────────────────────────
  async function persistSession(userData: any, jwt: string) {
    setMerchant(userData);
    setToken(jwt);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    await storeToken(jwt);
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  // ── Auth functions ─────────────────────────────────────────────────────────

  async function refreshSession() {
    try {
      const res = await api.get('/api/auth/merchant/me');
      if (res.data.success && res.data.merchant) {
        setMerchant(res.data.merchant);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  }

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/api/auth/merchant/login', { email, password });

      if (!res.data.mfaRequired) {
        await persistSession(res.data.merchant, res.data.token);
      }

      return { success: true, email: res.data.email, mfaRequired: res.data.mfaRequired };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  }

  // ── Biometric login ────────────────────────────────────────────────────────
  // Security model: after the caller verifies biometrics locally with
  // expo-local-authentication, it calls this function. We retrieve the JWT that
  // was stored in the OS Keychain/Keystore on the last password+OTP login and
  // rehydrate the session. If the JWT has expired the server will 401 and we
  // force a full re-login — same behaviour as all major banking apps.
  async function biometricLogin() {
    try {
      const jwt = await loadToken();
      if (!jwt) {
        return { success: false, error: 'No biometric credential found. Please sign in with your password.' };
      }

      // Verify the token is still accepted by the server
      const tempHeader = { Authorization: `Bearer ${jwt}` };
      const res = await api.get('/api/auth/merchant/me', { headers: tempHeader });

      if (!res.data.success || !res.data.merchant) {
        return { success: false, error: 'Session expired. Please sign in with your password.' };
      }

      await persistSession(res.data.merchant, jwt);
      return { success: true };
    } catch (err: any) {
      if (err.response?.status === 401) {
        return { success: false, error: 'Session expired. Please sign in with your password to continue.' };
      }
      return { success: false, error: err.response?.data?.error || 'Biometric login failed.' };
    }
  }

  async function signup(formData: any) {
    try {
      const payload = { ...formData, registrationSource: 'mobile' };
      const res = await api.post('/api/auth/merchant/register', payload);
      return { success: true, email: res.data.email, message: res.data.message };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  }

  async function verifyOTP(email: string, otp: string) {
    try {
      const res = await api.post('/api/auth/merchant/verify-otp', { email, otp });
      await persistSession(res.data.merchant, res.data.token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'OTP Verification failed' };
    }
  }

  async function resendOTP(email: string) {
    try {
      const res = await api.post('/api/auth/merchant/resend-otp', { email });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Failed to resend OTP' };
    }
  }

  async function forgotPassword(email: string) {
    try {
      const res = await api.post('/api/auth/merchant/forgot-password', { email });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Failed to request reset' };
    }
  }

  async function resetPassword(email: string, otp: string, newPassword: string) {
    try {
      const res = await api.post('/api/auth/merchant/reset-password', { email, otp, newPassword });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Failed to reset password' };
    }
  }

  async function logout() {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY, 'paychain_onboarding_complete']);
      await clearToken();
    } catch (e) {
      console.error('Logout cleanup failed:', e);
    }
    delete api.defaults.headers.common['Authorization'];
    setMerchant(null);
    setToken(null);
    setIsPinUnlocked(false);
  }

  async function completeOnboarding() {
    await AsyncStorage.setItem('paychain_onboarding_complete', 'true');
    setHasCompletedOnboarding(true);
  }

  async function setAppPin(pin: string) {
    try {
      await api.post('/api/auth/merchant/set-app-pin', { pin });
    } catch (err) {
      console.warn('Failed to sync PIN to backend:', err);
    }
    await AsyncStorage.setItem('paychain_app_pin', pin);
    setAppPinState(pin);
  }

  // Called from BiometricSetup after the user confirms the biometric prompt.
  // `enabled = true`  → marks this device as having biometric login active.
  // `enabled = false` → clears the flag (user opted out or hardware unavailable).
  async function completeBiometricSetup(enabled: boolean) {
    await AsyncStorage.setItem('paychain_biometrics_setup', 'true');
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    setHasSetBiometrics(true);
    setIsBiometricsEnabled(enabled);
  }

  function unlockApp() {
    setIsPinUnlocked(true);
  }

  return (
    <AuthContext.Provider value={{
      merchant,
      token,
      isLoading,
      isAuthenticated: !!merchant && !!token,
      hasCompletedOnboarding,
      appPin,
      isPinUnlocked,
      hasSetBiometrics,
      isBiometricsEnabled,
      completeOnboarding,
      setAppPin,
      completeBiometricSetup,
      unlockApp,
      login,
      biometricLogin,
      signup,
      verifyOTP,
      resendOTP,
      forgotPassword,
      resetPassword,
      logout,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
