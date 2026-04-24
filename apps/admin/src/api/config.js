import axios from 'axios';

/**
 * PayChain Admin API Configuration
 * 
 * We use VITE_API_BASE_URL from the environment dashboard (Vercel/Render).
 * If not set, we fall back to the production gateway.
 */

const getBaseUrl = () => {
  // 1. Check environment variable first (Highest Priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const hostname = window.location.hostname;
  
  // 2. Development/Localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168')) {
    return ''; // Uses Vite proxy
  }

  // 3. Automated Fallback for Production Subdomains
  if (hostname.includes('paychain.co.ke')) {
    return 'https://www.paychain.co.ke';
  }

  // 4. Default Production Gateway
  return 'https://www.paychain.co.ke';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Crucial for session/cookie auth if needed
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Potentially trigger a logout or redirect to login if session expires
      console.warn('Unauthorized access - potential session expiry.');
    }
    return Promise.reject(error);
  }
);

export default api;
