import axios from 'axios';

/**
 * PayChain Web API Configuration
 * 
 * Standardized connectivity layer to support both local development
 * and production deployment via Vercel.
 */

const getBaseUrl = (): string => {
  // 1. Check environment variables first (Highest Priority)
  // We check both VITE_API_URL and VITE_API_BASE_URL for consistency
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  // Debug log for production diagnostics
  if (import.meta.env.PROD) {
    console.log("PayChain Web Diagnostic - Current API URL:", envUrl || "FALLBACK DIRECT TO WWW");
  }

  if (envUrl) {
    return envUrl;
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

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized access - potential session expiry.');
    }
    return Promise.reject(error);
  }
);

export default api;
