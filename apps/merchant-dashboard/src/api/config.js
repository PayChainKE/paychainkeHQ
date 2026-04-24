import axios from 'axios';

/**
 * PayChain Merchant Dashboard API Configuration
 * 
 * Standardized connectivity layer to support both local development
 * and production deployment via Vercel.
 */

const getBaseUrl = () => {
  // 1. Check environment variables first (Highest Priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const hostname = window.location.hostname;
  
  // 2. Development/Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168')) {
    return ''; // Uses Vite proxy
  }

  // 3. Ultimate Fallback (Hardcoded Gateway)
  return 'https://www.paychain.co.ke';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
