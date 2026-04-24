import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const AuthContext = createContext();

// Credentials provided by user for local/dev login
const ADMIN_EMAIL = 'brandon@paychain.co.ke';
const ADMIN_PW = 'Paychain@25';

export function AuthProvider({ children }){
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(()=>{
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
        return { success: true, mfaRequired: true, email: data.email };
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

  function logout() {
    localStorage.removeItem('paychain_admin_session');
    localStorage.removeItem('paychain_admin_token');
    setAdmin(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ admin, isLoading, isAuthenticated: !!admin, login, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(){
  return useContext(AuthContext);
}

export default AuthContext;

// TODO: Replace mock auth with real API
// POST /api/auth/login
// GET /api/auth/me
