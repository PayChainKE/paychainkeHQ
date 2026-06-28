import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../api/config';

const AuthContext = createContext<any>(null);

const STORAGE_KEY        = 'paychain_merchant_session'; // merchant profile (non-sensitive)
const TOKEN_KEY          = 'paychain_merchant_token';   // JWT in OS secure enclave
const BIOMETRIC_DONE_KEY = 'paychain_biometrics_setup'; // 'true' once setup screen is shown

// ── SecureStore helpers ──────────────────────────────────────────────────────
async function storeToken(jwt: string) { await SecureStore.setItemAsync(TOKEN_KEY, jwt); }
async function loadToken(): Promise<string | null> { return SecureStore.getItemAsync(TOKEN_KEY); }
async function clearToken() { await SecureStore.deleteItemAsync(TOKEN_KEY); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant,               setMerchant]               = useState<any>(null);
  const [token,                  setToken]                  = useState<string | null>(null);
  const [isLoading,              setIsLoading]              = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [appPin,                 setAppPinState]            = useState<string | null>(null);
  const [isPinUnlocked,          setIsPinUnlocked]          = useState(false);
  const [hasSetBiometrics,       setHasSetBiometrics]       = useState(false);

  // isBiometricsEnabled = the SERVER'S biometricsEnabled flag, synced on every login.
  // This is the single source of truth across all platforms.
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);

  // hasBiometricToken = true when a JWT is stored in SecureStore (OS encrypted).
  // Biometric quick-login only works when this is true (there's a credential to unlock).
  const [hasBiometricToken, setHasBiometricToken] = useState(false);

  // ── Session restore on app launch ─────────────────────────────────────────
  useEffect(() => {
    const loadSession = async () => {
      try {
        const [rawMerchant, rawOnboarding, rawPin, rawBiometricDone] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem('paychain_onboarding_complete'),
          AsyncStorage.getItem('paychain_app_pin'),
          AsyncStorage.getItem(BIOMETRIC_DONE_KEY),
        ]);

        if (rawOnboarding === 'true') setHasCompletedOnboarding(true);
        if (rawPin)                   setAppPinState(rawPin);
        if (rawBiometricDone === 'true') setHasSetBiometrics(true);

        // Check whether a JWT is available in the secure enclave.
        const jwt = await loadToken();
        setHasBiometricToken(!!jwt);

        if (rawMerchant && jwt) {
          const parsed = JSON.parse(rawMerchant);
          setMerchant(parsed);
          setToken(jwt);
          api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;

          // Sync biometricsEnabled from the stored profile immediately,
          // then refresh from server in the background.
          if (parsed.biometricsEnabled) applyBiometricsEnabled(true);

          api.get('/api/auth/merchant/me')
            .then(async (res) => {
              if (res.data.success && res.data.merchant) {
                const fresh = res.data.merchant;
                setMerchant(fresh);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
                applyBiometricsEnabled(!!fresh.biometricsEnabled);
              }
            })
            .catch((err) => {
              if (err.response?.status === 401) logout();
            });
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // ── applyBiometricsEnabled ────────────────────────────────────────────────
  // Syncs the server flag to all relevant local state in one place.
  // If the server says biometrics are enabled (e.g. from web registration),
  // we also mark hasSetBiometrics = true so the BiometricSetup screen is
  // skipped — no need to set up again on this platform.
  function applyBiometricsEnabled(enabled: boolean) {
    setIsBiometricsEnabled(enabled);
    if (enabled) {
      setHasSetBiometrics(true);
      AsyncStorage.setItem(BIOMETRIC_DONE_KEY, 'true').catch(() => {});
    }
  }

  // ── Internal: persist a successful login ───────────────────────────────────
  async function persistSession(userData: any, jwt: string) {
    setMerchant(userData);
    setToken(jwt);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    await storeToken(jwt);
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    setHasBiometricToken(true);

    // The server's biometricsEnabled is authoritative — sync it now.
    applyBiometricsEnabled(!!userData.biometricsEnabled);
  }

  // ── Auth functions ─────────────────────────────────────────────────────────

  async function refreshSession() {
    try {
      const res = await api.get('/api/auth/merchant/me');
      if (res.data.success && res.data.merchant) {
        const fresh = res.data.merchant;
        setMerchant(fresh);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        applyBiometricsEnabled(!!fresh.biometricsEnabled);
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
  // Caller must already have verified the biometric locally via
  // expo-local-authentication before calling this. We retrieve the JWT
  // stored in the OS Keychain/Keystore from the most recent password login
  // and validate it against the server. Expired JWTs force a password re-login.
  async function biometricLogin() {
    try {
      const jwt = await loadToken();
      if (!jwt) {
        return {
          success: false,
          error: 'No saved session found. Please sign in with your password first.',
        };
      }
      const res = await api.get('/api/auth/merchant/me', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.data.success || !res.data.merchant) {
        return { success: false, error: 'Session expired. Please sign in with your password.' };
      }
      await persistSession(res.data.merchant, jwt);
      return { success: true };
    } catch (err: any) {
      if (err.response?.status === 401) {
        return { success: false, error: 'Session expired. Please sign in with your password.' };
      }
      return { success: false, error: err.response?.data?.error || 'Biometric login failed.' };
    }
  }

  async function signup(formData: any) {
    try {
      const res = await api.post('/api/auth/merchant/register', {
        ...formData,
        registrationSource: 'mobile',
      });
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
    setHasBiometricToken(false);
    // Note: isBiometricsEnabled and hasSetBiometrics are deliberately NOT
    // cleared here — they survive logout so the biometric button and setup
    // screen behave correctly on next login.
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

  // completeBiometricSetup — called from BiometricSetup screen after the user
  // taps "Enable" and expo-local-authentication succeeds.
  //
  // When `enabled = true` we also tell the server so the flag is consistent
  // across all platforms (web dashboard, mobile web, native app).
  async function completeBiometricSetup(enabled: boolean) {
    if (enabled) {
      try {
        // Sync to server so web sees biometricsEnabled = true immediately.
        await api.put('/api/auth/merchant/biometrics', { enabled: true });
      } catch (err) {
        console.warn('Failed to sync biometrics flag to server:', err);
      }
    }
    await AsyncStorage.setItem(BIOMETRIC_DONE_KEY, 'true');
    applyBiometricsEnabled(enabled);
  }

  function unlockApp() {
    setIsPinUnlocked(true);
  }

  return (
    <AuthContext.Provider value={{
      merchant,
      token,
      isLoading,
      isAuthenticated:        !!merchant && !!token,
      hasCompletedOnboarding,
      appPin,
      isPinUnlocked,
      hasSetBiometrics,
      isBiometricsEnabled,
      hasBiometricToken,
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
