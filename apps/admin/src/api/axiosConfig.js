import axios from 'axios';

/**
 * PayChain Admin API Configuration
 * Senior DevOps Refactor: Using import.meta.env for Vite compliance
 */

// 1. Resolve Base URL
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  // Debug log for production diagnostics (Step 1)
  if (import.meta.env.PROD) {
    console.log("PayChain Diagnostic - Current API URL:", envUrl || "FALLBACK DIRECT TO WWW");
  }

  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Return empty string to use Vite Proxy in local development
    // This resolves CORS issues and uses the proxy defined in vite.config.js
    return ''; 
  }

  // Fallback for production if env isn't reachable
  return 'https://www.paychain.co.ke';
};

const API_BASE_URL = getBaseUrl();

// 2. Create Axios Instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Step 2: Ensure credentials enabled
  headers: {
    'Content-Type': 'application/json',
  },
});

// 3. Global Interceptors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('PAYCHAIN_NETWORK_ERROR: Possible CORS mismatch or Backend Down.');
    }
    return Promise.reject(error);
  }
);

export default api;
