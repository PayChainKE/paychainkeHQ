import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useIdleTimer, markPersistedActive, isPersistedIdleExpired } from '../hooks/useIdleTimer';
import SessionTimeoutModal from '../components/modals/SessionTimeoutModal';

const AuthContext = createContext();
const LAST_ACTIVE_KEY = 'paychain_admin_last_active';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 2 * 60 * 1000;

export function AuthProvider({ children }){
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(()=>{
    // Closing the tab kills the in-tab idle timer (its clock is purely
    // in-memory) — without this check, closing the tab mid-idle-countdown
    // and reopening later would restore the cached session as if no time
    // had passed, silently defeating the 15-minute idle policy the moment
    // the tab closes. Checked before trusting the cached session.
    if (isPersistedIdleExpired(LAST_ACTIVE_KEY, IDLE_TIMEOUT_MS)) {
      localStorage.removeItem('paychain_admin_session');
      localStorage.removeItem('paychain_admin_token');
      localStorage.removeItem(LAST_ACTIVE_KEY);
      setIsLoading(false);
      navigate('/login?reason=idle-timeout');
      return;
    }
    const raw = localStorage.getItem('paychain_admin_session');
    if (raw){
      try{ setAdmin(JSON.parse(raw)); }catch(e){}
    }
    setIsLoading(false);
  },[]);

  async function login(email, password) {
    setIsLoading(true);
    try {
      const response = await api.post('/api/admin/auth/login', { email, password });
      const data = response.data;
      
      if (data.mfaRequired) {
        return { success: true, mfaRequired: true, email: data.email, channel: data.channel, maskedPhone: data.maskedPhone };
      }
      
      if (!data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }
      
      return { success: false, error: 'Unexpected response' };
    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.error || err.response?.data?.message || 'Connection error';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyOtp(email, otpCode) {
    setIsLoading(true);
    try {
      const response = await api.post('/api/admin/auth/verify-otp', { email, otpCode });
      const data = response.data;
      
      if (data.success && data.token) {
        setAdmin(data.admin);
        localStorage.setItem('paychain_admin_session', JSON.stringify(data.admin));
        localStorage.setItem('paychain_admin_token', data.token);
        markPersistedActive(LAST_ACTIVE_KEY);
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Verification failed' };
    } catch (err) {
      console.error('OTP verification error:', err);
      const message = err.response?.data?.error || err.response?.data?.message || 'Connection error';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }

  function logout(reason) {
    localStorage.removeItem('paychain_admin_session');
    localStorage.removeItem('paychain_admin_token');
    localStorage.removeItem(LAST_ACTIVE_KEY);
    setAdmin(null);
    navigate(reason ? `/login?reason=${reason}` : '/login');
  }

  // Idle auto-logout — 15 min of no activity (any tab, any app), warned at
  // 13 min. See hooks/useIdleTimer.js for why this shape was chosen. Passes
  // 'idle-timeout' through to Login's REASON_COPY banner so someone who
  // walked away sees why they were signed out, instead of a silent redirect.
  const { showWarning: showIdleWarning, resetActivity: stayLoggedIn } = useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onIdle: () => logout('idle-timeout'),
    enabled: !!admin,
    storageKey: LAST_ACTIVE_KEY,
  });

  return (
    <AuthContext.Provider value={{ admin, isLoading, isAuthenticated: !!admin, login, verifyOtp, logout }}>
      {children}
      {showIdleWarning && (
        <SessionTimeoutModal
          countdownSec={IDLE_WARNING_MS / 1000}
          onStay={stayLoggedIn}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(){
  return useContext(AuthContext);
}

export default AuthContext;
