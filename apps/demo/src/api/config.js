import axios from 'axios';

/**
 * PayChain Merchant Dashboard API Configuration
 * Senior DevOps Refactor: Using import.meta.env for Vite compliance
 */

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  if (import.meta.env.PROD) {
    console.log("PayChain Merchant Diagnostic - Current API URL:", envUrl || "FALLBACK DIRECT TO WWW");
  }

  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''; // Use Vite Proxy for local development
  }

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('PAYCHAIN_MERCHANT_NETWORK_ERROR: Possible CORS mismatch or Backend Down.');
    }
    return Promise.reject(error);
  }
);

export default api;
