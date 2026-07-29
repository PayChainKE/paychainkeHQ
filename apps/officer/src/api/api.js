import axios from 'axios';

/**
 * PayChain Officer API Configuration
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
    const token = localStorage.getItem('paychain_officer_token');
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
//
// Normalise backend errors so every action handler can read `err.response.data.error`
// reliably. The backend sends { error, code } consistently; we still tolerate
// the older { message } shape for backward-compat. On token expiry we hard-redirect
// to /login with a banner reason so the user understands why they were bumped.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const data    = error.response?.data;
    if (data && !data.error && data.message) {
      error.response.data = { ...data, error: data.message };
    }

    if (status === 401) {
      const code = data?.code;
      const reason = code === 'TOKEN_EXPIRED' ? 'session-expired'
                   : code === 'ADMIN_NOT_FOUND' ? 'account-missing'
                   : 'session-invalid';
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('paychain_officer_session');
        localStorage.removeItem('paychain_officer_token');
        sessionStorage.setItem('paychain_officer_login_reason', reason);
        window.location.href = `/login?reason=${reason}`;
      }
    }

    if (!error.response) {
      console.error('PAYCHAIN_NETWORK_ERROR: backend unreachable, CORS, or timeout.');
      error.response = { data: { error: 'Cannot reach PayChain API. Check your connection or try again in a moment.' } };
    }
    return Promise.reject(error);
  }
);

export default api;
