import axios from 'axios';

// Ensure baseURL always ends with '/api' regardless of whether VITE_API_URL includes it or not
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosInstance.interceptors.request.use(
  (config) => {
    // 1. Primary: tab-isolated sessionStorage token
    let token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('routexai_token') : null;

    // 2. If not yet in sessionStorage, inspect current page URL to retrieve role-scoped token
    if (!token && typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/driver')) {
        token = localStorage.getItem('routexai_token_DRIVER');
      } else if (path.includes('/customer')) {
        token = localStorage.getItem('routexai_token_CUSTOMER');
      } else if (path.includes('/owner')) {
        token = localStorage.getItem('routexai_token_OWNER');
      }

      if (!token) {
        const activeRole = localStorage.getItem('routexai_active_role');
        token = activeRole ? localStorage.getItem(`routexai_token_${activeRole}`) : null;
      }

      if (!token) {
        token = localStorage.getItem('routexai_token');
      }

      if (token && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('routexai_token', token);
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[RouteXAI Auth] 401 Unauthorized:', error.config?.url);
    } else if (error.response?.status === 403) {
      console.warn('[RouteXAI Auth] 403 Forbidden Role Mismatch:', error.response?.data?.message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
