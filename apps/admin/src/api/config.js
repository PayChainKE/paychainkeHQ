import axios from 'axios';

/**
 * PayChain Admin API Configuration
 * 
 * We use VITE_API_BASE_URL from the environment dashboard (Vercel/Render).
 * If not set, we fall back to the production gateway.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '' 
    : 'https://www.paychain.co.ke');

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
