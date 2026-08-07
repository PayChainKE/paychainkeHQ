import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useIdleTimer, markPersistedActive, isPersistedIdleExpired } from '../hooks/useIdleTimer';
import SessionTimeoutModal from '../components/modals/SessionTimeoutModal';

const MerchantAuthContext = createContext();

const STORAGE_KEY = 'paychain_merchant_session';
const TOKEN_KEY = 'paychain_merchant_token';
const LAST_ACTIVE_KEY = 'paychain_merchant_last_active';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 2 * 60 * 1000;

// Use the Vercel staging or production API URL based on environment
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function MerchantAuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const interceptorRef = useRef(null);

  // Axios 401 interceptor — any API call that gets a 401 (expired/invalid
  // token) automatically clears the session and redirects to login.
  useEffect(() => {
    interceptorRef.current = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          const url = err.config?.url || '';
          console.warn('Received 401 on', url, '- automatic logout disabled per configuration.');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptorRef.current);
  }, [navigate]);

  useEffect(() => {
    const rawMerchant = localStorage.getItem(STORAGE_KEY);
    const rawToken = localStorage.getItem(TOKEN_KEY);

    // Closing the tab kills the in-tab idle timer (useIdleTimer's clock is
    // purely in-memory) — without this check, closing the tab mid-idle-
    // countdown and reopening it later would restore the cached session as
    // if no time had passed at all, silently defeating the 15-minute idle
    // policy the moment the tab is closed. Checked BEFORE trusting the
    // cached session, so a stale reopen never even flashes the dashboard.
    if (rawMerchant && rawToken && isPersistedIdleExpired(LAST_ACTIVE_KEY, IDLE_TIMEOUT_MS)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LAST_ACTIVE_KEY);
      setIsLoading(false);
      navigate('/login?reason=idle-timeout');
      return;
    }

    if (rawMerchant && rawToken) {
      try {
        setMerchant(JSON.parse(rawMerchant));
        setToken(rawToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${rawToken}`;

        axios.get(`${API_URL}/api/auth/merchant/me`)
          .then(res => {
            if (res.data.success && res.data.merchant) {
              setMerchant(res.data.merchant);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
            }
          })
          .catch(err => {
            // 401 is handled by the interceptor above; log others
            if (err.response?.status !== 401) {
              console.error('Failed to fetch fresh merchant session', err);
            }
          });
      } catch (e) {
        console.error('Failed to parse local session', e);
      }
    }

    setIsLoading(false);
  }, []);

  async function refreshSession() {
    try {
      const res = await axios.get(`${API_URL}/api/auth/merchant/me`);
      if (res.data.success && res.data.merchant) {
        setMerchant(res.data.merchant);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.merchant));
      }
    } catch (err) {
      console.error("Failed to refresh session", err);
    }
  }

  // Poll for balance/profile changes so kesBalance (and everything else
  // derived from `merchant`) stays live across every page without each one
  // needing its own refresh loop. Keyed on merchant._id (not the whole
  // object) so the interval isn't torn down and recreated on every tick.
  useEffect(() => {
    if (!merchant?._id) return;
    const interval = setInterval(refreshSession, 5000);
    return () => clearInterval(interval);
  }, [merchant?._id]);

  // Idle auto-logout — 15 min of no activity (any tab, any app), warned at
  // 13 min. See hooks/useIdleTimer.js for why this shape was chosen. Passes
  // 'idle-timeout' through so Login can show why the merchant was signed
  // out, instead of a silent redirect.
  const { showWarning: showIdleWarning, resetActivity: stayLoggedIn } = useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onIdle: () => logout('idle-timeout'),
    enabled: !!merchant,
    storageKey: LAST_ACTIVE_KEY,
  });

  async function signup(formData) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/register`, formData);
      return { success: true, email: res.data.email, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  }

  async function login(email, password) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/login`, { email, password });
      
      if (!res.data.mfaRequired) {
        const { merchant: userData, token: jwt } = res.data;
        setMerchant(userData);
        setToken(jwt);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        localStorage.setItem(TOKEN_KEY, jwt);
        markPersistedActive(LAST_ACTIVE_KEY);
        axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
      }

      return {
        success: true,
        email: res.data.email,
        mfaRequired: res.data.mfaRequired,
        channel: res.data.channel,
        maskedPhone: res.data.maskedPhone,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  }

  async function verifyOTP(email, otp) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/verify-otp`, { email, otp });
      
      const { merchant: userData, token: jwt } = res.data;
      
      setMerchant(userData);
      setToken(jwt);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      localStorage.setItem(TOKEN_KEY, jwt);
      markPersistedActive(LAST_ACTIVE_KEY);
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;

      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'OTP Verification failed' };
    }
  }

  async function resendOTP(email) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/resend-otp`, { email });
      return {
        success: true,
        message: res.data.message,
        channel: res.data.channel,
        maskedPhone: res.data.maskedPhone,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to resend OTP' };
    }
  }

  async function forgotPassword(email) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/forgot-password`, { email });
      return {
        success: true,
        message: res.data.message,
        maskedEmail: res.data.maskedEmail || null,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to send verification code.' };
    }
  }

  async function verifyResetOTP(email, otp) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/verify-reset-otp`, { email, otp });
      return {
        success: true,
        message: res.data.message,
        resetToken: res.data.resetToken,
        expiresInSeconds: res.data.expiresInSeconds,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Code verification failed.' };
    }
  }

  // Accepts the new (resetToken, newPassword) shape AND the legacy
  // (email, otp, newPassword) shape so older mobile/web clients keep working.
  async function resetPassword(arg1, arg2, arg3) {
    try {
      const payload = (arg2 != null && arg3 != null)
        ? { email: arg1, otp: arg2, newPassword: arg3 }
        : { resetToken: arg1, newPassword: arg2 };
      const res = await axios.post(`${API_URL}/api/auth/merchant/reset-password`, payload);
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to reset password.' };
    }
  }

  // Called by BiometricLoginButton after the WebAuthn verify-login API returns
  // { token, merchant }. Stores session identically to the password login path.
  function loginWithPasskey({ token: jwt, merchant: userData }) {
    setMerchant(userData);
    setToken(jwt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, jwt);
    markPersistedActive(LAST_ACTIVE_KEY);
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  // Called after any endpoint that rotates the JWT server-side (e.g.
  // change-password bumping tokenVersion, which invalidates the token this
  // very request was authenticated with) — swaps in the new token without
  // otherwise touching the session, so the merchant isn't unexpectedly
  // logged out by their own security-hygiene action.
  function updateToken(jwt) {
    setToken(jwt);
    localStorage.setItem(TOKEN_KEY, jwt);
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  function logout(reason) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setMerchant(null);
    setToken(null);
    navigate(reason ? `/login?reason=${reason}` : '/login');
  }

  return (
    <MerchantAuthContext.Provider value={{
      merchant,
      token,
      isLoading,
      isAuthenticated: !!merchant,
      login,
      loginWithPasskey,
      updateToken,
      signup,
      verifyOTP,
      resendOTP,
      forgotPassword,
      verifyResetOTP,
      resetPassword,
      logout,
      refreshSession
    }}>
      {children}
      {showIdleWarning && (
        <SessionTimeoutModal
          countdownSec={IDLE_WARNING_MS / 1000}
          onStay={stayLoggedIn}
          onLogout={logout}
        />
      )}
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth() { return useContext(MerchantAuthContext); }

export default MerchantAuthContext;
