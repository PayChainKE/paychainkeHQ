import axios from 'axios';

/**
 * PayChain Admin API Configuration
 */

// 1. Resolve Base URL
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''; // Uses Vite Proxy
  }

  return 'https://www.paychain.co.ke';
};

const API_BASE_URL = getBaseUrl();

// 2. Create Axios Instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 3. Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('paychain_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 4. Response Interceptor: Global Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized access - potential session expiry.');
      // Optional: Clear storage and redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
         localStorage.removeItem('paychain_admin_session');
         localStorage.removeItem('paychain_admin_token');
         window.location.href = '/login';
      }
    }
    
    if (!error.response) {
      console.error('PAYCHAIN_NETWORK_ERROR: Possible CORS mismatch or Backend Down.');
    }
    return Promise.reject(error);
  }
);

export default api;
