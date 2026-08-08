import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, Platform } from 'react-native';
import api from '../api/config';

// Re-lock threshold — if the app has been backgrounded for at least this
// long, returning to the foreground re-arms the PIN gate (isPinUnlocked ->
// false), same as a stranger picking the phone up needing to re-enter it.
// Short enough to tolerate a quick app-switch (e.g. reading an SMS OTP)
// without nagging, long enough that leaving the phone unattended for real
// doesn't stay unlocked indefinitely.
const REAUTH_BACKGROUND_MS = 30_000;

// Full-session idle timeout — 15 min with no touch activity while the app is
// foregrounded and unlocked, matching the web dashboards' idle-logout policy
// (see useIdleTimer.js in the web apps). Also reused as the threshold for a
// full logout (not just a PIN re-lock) when the app returns from background
// after being away this long — someone leaving the phone unattended for real
// should have to sign in again, not just re-enter a 4-digit PIN.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_POLL_MS = 15_000;

const AuthContext = createContext<any>(null);

const STORAGE_KEY        = 'paychain_merchant_session'; // merchant profile (non-sensitive)
const TOKEN_KEY          = 'paychain_merchant_token';   // JWT in OS secure enclave
const PIN_KEY            = 'paychain_app_pin';          // app-unlock PIN in OS secure enclave
const BIOMETRIC_DONE_KEY = 'paychain_biometrics_setup'; // 'true' once setup screen is shown

// ── SecureStore helpers ──────────────────────────────────────────────────────
async function storeToken(jwt: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(TOKEN_KEY, jwt);
}
async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}
async function clearToken() {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// App-unlock PIN — previously stored in plain-text AsyncStorage (readable
// unencrypted on-device, e.g. via backup extraction or a rooted device);
// moved to the same OS-encrypted keystore as the JWT.
async function storeAppPin(pin: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(PIN_KEY, pin);
}
async function loadAppPin(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(PIN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant,               setMerchant]               = useState<any>(null);
  const [token,                  setToken]                  = useState<string | null>(null);
  const [isLoading,              setIsLoading]              = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [appPin,                 setAppPinState]            = useState<string | null>(null);
  const [isPinUnlocked,          setIsPinUnlocked]          = useState(false);
  const [hasSetBiometrics,       setHasSetBiometrics]       = useState(false);

  // isBiometricsEnabled = the SERVER'S mobileBiometricUnlockEnabled flag,
  // synced on every login. This is mobile's own local Face ID/Touch ID
  // device-unlock state — deliberately independent of the web dashboard's
  // biometricsEnabled (which means "has a registered WebAuthn passkey", a
  // completely different credential this app never touches).
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);

  // hasBiometricToken = true when a JWT is stored in SecureStore (OS encrypted).
  // Biometric quick-login only works when this is true (there's a credential to unlock).
  const [hasBiometricToken, setHasBiometricToken] = useState(false);

  // Set (only) by a forced logout, so Login.tsx can show why the merchant
  // landed back there instead of a silent bounce. Cleared once Login reads it.
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  function clearLogoutReason() {
    setLogoutReason(null);
  }

  // ── Re-lock / full-logout on return from background ───────────────────────
  // Plain ref, not state — this is a timestamp bookkeeping value read only
  // inside the AppState listener itself, so there's nothing to re-render for.
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (nextState !== 'active') return;

      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (backgroundedAt === null) return;

      const awayMs = Date.now() - backgroundedAt;

      // Away long enough that this is the same "left it unattended" scenario
      // as the foreground idle timer below — a full sign-out, not just a
      // PIN re-lock.
      if (awayMs >= IDLE_TIMEOUT_MS) {
        logout('idle-timeout');
        return;
      }
      if (awayMs < REAUTH_BACKGROUND_MS) return;

      // Only matters once the user has actually unlocked into the app with
      // a PIN set — re-locking a merchant who's still on Login/Onboarding
      // is a no-op AppNavigator.tsx would ignore anyway, but skip the state
      // update entirely rather than firing it pointlessly on every return.
      setIsPinUnlocked((wasUnlocked: boolean) => (wasUnlocked ? false : wasUnlocked));
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ── Foreground idle timeout ────────────────────────────────────────────────
  // Any touch anywhere in the app calls recordActivity() (wired at the root
  // in App.tsx). A ref, not state, polled on an interval — same reasoning as
  // the background timestamp above: this fires far too often to live in
  // React state without causing constant re-renders.
  const lastActiveAtRef = useRef<number>(Date.now());
  function recordActivity() {
    lastActiveAtRef.current = Date.now();
  }

  useEffect(() => {
    // Only run once actually unlocked into the app — no point idling out a
    // PIN entry screen or the login form itself.
    if (!merchant || !token || !isPinUnlocked) return;
    lastActiveAtRef.current = Date.now();

    const interval = setInterval(() => {
      if (Date.now() - lastActiveAtRef.current >= IDLE_TIMEOUT_MS) {
        logout('idle-timeout');
      }
    }, IDLE_POLL_MS);
    return () => clearInterval(interval);
  }, [merchant, token, isPinUnlocked]);

  // ── Session restore on app launch ─────────────────────────────────────────
  useEffect(() => {
    const loadSession = async () => {
      try {
        const [rawMerchant, rawOnboarding, rawPin, rawBiometricDone] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem('paychain_onboarding_complete'),
          loadAppPin(),
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

          // Sync mobileBiometricUnlockEnabled from the stored profile
          // immediately, then refresh from server in the background.
          if (parsed.mobileBiometricUnlockEnabled) applyBiometricsEnabled(true);

          api.get('/api/auth/merchant/me')
            .then(async (res) => {
              if (res.data.success && res.data.merchant) {
                const fresh = res.data.merchant;
                setMerchant(fresh);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
                applyBiometricsEnabled(!!fresh.mobileBiometricUnlockEnabled);
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
  // Syncs the server's mobileBiometricUnlockEnabled flag to all relevant
  // local state in one place. If already enabled (e.g. restored from a
  // previous session on this device), also mark hasSetBiometrics = true so
  // the BiometricSetup screen is skipped. Deliberately does NOT look at
  // the web dashboard's biometricsEnabled/passkeys — registering a passkey
  // on web gives this app no local-unlock capability at all, so it must
  // never cause mobile's own onboarding to be silently skipped.
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

    // The server's mobileBiometricUnlockEnabled is authoritative — sync it now.
    applyBiometricsEnabled(!!userData.mobileBiometricUnlockEnabled);
  }

  // ── Auth functions ─────────────────────────────────────────────────────────

  async function refreshSession() {
    try {
      const res = await api.get('/api/auth/merchant/me');
      if (res.data.success && res.data.merchant) {
        const fresh = res.data.merchant;
        setMerchant(fresh);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        applyBiometricsEnabled(!!fresh.mobileBiometricUnlockEnabled);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  }

  // Poll for balance/profile changes so kesBalance (and everything else
  // derived from `merchant`) stays live across every screen without each
  // one needing its own refresh loop. Keyed on merchant._id (not the whole
  // object) so the interval isn't torn down and recreated on every tick.
  useEffect(() => {
    if (!merchant?._id) return;
    const interval = setInterval(refreshSession, 5000);
    return () => clearInterval(interval);
  }, [merchant?._id]);

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/api/auth/merchant/login', { email, password });
      if (!res.data.mfaRequired) {
        await persistSession(res.data.merchant, res.data.token);
      }
      return {
        success: true,
        email: res.data.email,
        mfaRequired: res.data.mfaRequired,
        channel: res.data.channel,
        maskedPhone: res.data.maskedPhone,
      };
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
      return {
        success: true,
        message: res.data.message,
        channel: res.data.channel,
        maskedPhone: res.data.maskedPhone,
      };
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

  async function logout(reason?: string) {
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
    if (reason) setLogoutReason(reason);
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
    await storeAppPin(pin);
    setAppPinState(pin);
  }

  // completeBiometricSetup — called from BiometricSetup screen after the user
  // taps "Enable" and expo-local-authentication succeeds.
  //
  // When `enabled = true` we also tell the server, so mobileBiometricUnlockEnabled
  // stays in sync if the merchant reinstalls the app or signs in on another
  // device — this is purely mobile's own local-unlock state, unrelated to
  // the web dashboard's WebAuthn passkeys.
  async function completeBiometricSetup(enabled: boolean) {
    if (enabled) {
      try {
        await api.put('/api/auth/merchant/biometrics', { enabled: true });
      } catch (err) {
        console.warn('Failed to sync biometrics flag to server:', err);
      }
    }
    await AsyncStorage.setItem(BIOMETRIC_DONE_KEY, 'true');
    applyBiometricsEnabled(enabled);
  }

  function unlockApp() {
    lastActiveAtRef.current = Date.now();
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
      logoutReason,
      clearLogoutReason,
      recordActivity,
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
