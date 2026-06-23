import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/config';

const AuthContext = createContext<any>(null);

const STORAGE_KEY = 'paychain_merchant_session';
const TOKEN_KEY = 'paychain_merchant_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant, setMerchant] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [appPin, setAppPinState] = useState<string | null>(null);
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [hasSetBiometrics, setHasSetBiometrics] = useState(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);

  // Load session on startup
  useEffect(() => {
    const loadSession = async () => {
      try {
        const rawMerchant = await AsyncStorage.getItem(STORAGE_KEY);
        const rawToken = await AsyncStorage.getItem(TOKEN_KEY);
        const rawOnboarding = await AsyncStorage.getItem('paychain_onboarding_complete');
        const rawPin = await AsyncStorage.getItem('paychain_app_pin');
        const rawBiometricSetup = await AsyncStorage.getItem('paychain_biometrics_setup');
        const rawBiometricEnabled = await AsyncStorage.getItem('paychain_biometrics_enabled');
        
        if (rawOnboarding === 'true') setHasCompletedOnboarding(true);
        if (rawPin) setAppPinState(rawPin);
        if (rawBiometricSetup === 'true') setHasSetBiometrics(true);
        if (rawBiometricEnabled === 'true') setIsBiometricsEnabled(true);
        
        if (rawMerchant && rawToken) {
          setMerchant(JSON.parse(rawMerchant));
          setToken(rawToken);
          
          // Optionally refresh the session immediately from the backend to ensure it's still valid
          api.get('/api/auth/merchant/me')
            .then(async (res) => {
              if (res.data.success && res.data.merchant) {
                setMerchant(res.data.merchant);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
              }
            })
            .catch((err) => {
              console.error("Failed to fetch fresh merchant session on startup", err);
              // If it's a 401, we might want to log them out
              if (err.response?.status === 401) {
                logout();
              }
            });
        }
      } catch (e) {
        console.error("Failed to parse local session", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  async function refreshSession() {
    try {
      const res = await api.get('/api/auth/merchant/me');
      if (res.data.success && res.data.merchant) {
        setMerchant(res.data.merchant);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
      }
    } catch (err) {
      console.error("Failed to refresh session", err);
    }
  }

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/api/auth/merchant/login', { email, password });
      
      if (!res.data.mfaRequired) {
        const { merchant: userData, token: jwt } = res.data;
        setMerchant(userData);
        setToken(jwt);
        
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem(TOKEN_KEY, jwt);
      }
      
      return { success: true, email: res.data.email, mfaRequired: res.data.mfaRequired };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
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

  async function biometricLogin(email: string) {
    try {
      const res = await api.post('/api/auth/merchant/biometric-login', { email });
      const { merchant: userData, token: jwt } = res.data;
      
      setMerchant(userData);
      setToken(jwt);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.setItem(TOKEN_KEY, jwt);
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Biometric Login failed' };
    }
  }

  async function verifyOTP(email: string, otp: string) {
    try {
      const res = await api.post('/api/auth/merchant/verify-otp', { email, otp });
      
      const { merchant: userData, token: jwt } = res.data;
      
      setMerchant(userData);
      setToken(jwt);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.setItem(TOKEN_KEY, jwt);
      
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
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      setMerchant(null);
      setToken(null);
      setIsPinUnlocked(false);
    } catch (err) {
      console.error("Failed to logout securely", err);
    }
  }

  async function completeOnboarding() {
    await AsyncStorage.setItem('paychain_onboarding_complete', 'true');
    setHasCompletedOnboarding(true);
  }

  async function setAppPin(pin: string) {
    try {
      // Sync with backend
      await api.post('/api/auth/merchant/set-app-pin', { pin });
    } catch (err) {
      console.warn('Failed to sync app PIN to backend', err);
    }
    await AsyncStorage.setItem('paychain_app_pin', pin);
    setAppPinState(pin);
  }

  async function completeBiometricSetup(enabled: boolean) {
    await AsyncStorage.setItem('paychain_biometrics_setup', 'true');
    await AsyncStorage.setItem('paychain_biometrics_enabled', enabled ? 'true' : 'false');
    setHasSetBiometrics(true);
    setIsBiometricsEnabled(enabled);
  }

  function unlockApp() {
    setIsPinUnlocked(true);
  }

  return (
    <AuthContext.Provider value={{ 
      merchant, 
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
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { 
  return useContext(AuthContext); 
}

export default AuthContext;
