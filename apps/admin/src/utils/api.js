/**
 * Centralized API configuration for the PayChain Admin App.
 * Handles dynamic base URL resolution to support both local development (proxy)
 * and production deployment (full URL).
 */

const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  
  // Local development fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''; // Uses the Vite proxy (mapped to http://127.0.0.1:5000)
  }
  
  // Production fallback (Unified API Gateway)
  return 'https://www.paychain.co.ke';
};

export const API_BASE_URL = getApiBaseUrl(); 
