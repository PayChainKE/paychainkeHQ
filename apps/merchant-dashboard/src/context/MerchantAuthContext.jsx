import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const MerchantAuthContext = createContext();

const STORAGE_KEY = 'paychain_merchant_session';
const TOKEN_KEY = 'paychain_merchant_token';

// Use the Vercel staging or production API URL based on environment
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function MerchantAuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const rawMerchant = localStorage.getItem(STORAGE_KEY);
    const rawToken = localStorage.getItem(TOKEN_KEY);
    
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
          .catch(err => console.error("Failed to fetch fresh merchant session", err));
      } catch (e) {
        console.error("Failed to parse local session", e);
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
        axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
      }
      
      return { success: true, email: res.data.email, mfaRequired: res.data.mfaRequired };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  }

  async function biometricLogin(email) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/biometric-login`, { email });
      const { merchant: userData, token: jwt } = res.data;
      
      setMerchant(userData);
      setToken(jwt);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      localStorage.setItem(TOKEN_KEY, jwt);
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
      
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Biometric Login failed' };
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
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
      
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'OTP Verification failed' };
    }
  }

  async function resendOTP(email) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/resend-otp`, { email });
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to resend OTP' };
    }
  }

  async function forgotPassword(email) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/forgot-password`, { email });
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to request reset' };
    }
  }

  async function resetPassword(email, otp, newPassword) {
    try {
      const res = await axios.post(`${API_URL}/api/auth/merchant/reset-password`, { email, otp, newPassword });
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to reset password' };
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setMerchant(null);
    setToken(null);
    navigate('/login');
  }

  return (
    <MerchantAuthContext.Provider value={{ 
      merchant, 
      isLoading, 
      isAuthenticated: !!merchant, 
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
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth() { return useContext(MerchantAuthContext); }

export default MerchantAuthContext;
