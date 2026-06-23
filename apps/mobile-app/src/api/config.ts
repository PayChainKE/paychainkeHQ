import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * PayChain Mobile API Configuration
 * Manages dynamic routing based on environment and intercepts requests
 * to automatically attach JWT authorization tokens.
 */

// We will default to the local machine's IP for Android emulator (10.0.2.2) 
// or standard localhost for iOS simulators. The user can override this later.
const getBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000';
    }
    return 'http://localhost:5000';
  }
  // Production fallback
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

// Request Interceptor: Automatically attach the token if we have one
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('paychain_merchant_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token from SecureStorage', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors (e.g., 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('PAYCHAIN_MOBILE_NETWORK_ERROR: Possible CORS mismatch, wrong IP, or Backend Down.');
    } else if (error.response.status === 401) {
      console.warn('Unauthorized session detected. User might need to log in again.');
      // Future: Could trigger a global logout event here
    }
    return Promise.reject(error);
  }
);

export default api;
