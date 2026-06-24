import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const explicitApiUrl = import.meta.env?.VITE_API_URL;

// If env var is missing, fall back to local dev backend.
// For Dev Tunnels: convert https://gkdspbv6-5173.inc1.devtunnels.ms to https://gkdspbv6-5002.inc1.devtunnels.ms
const backendUrl = explicitApiUrl || (
  isLocalhost
    ? 'http://localhost:5002/api'
    : (() => {
        const hostname = window.location.hostname;
        const match = hostname.match(/^([a-z0-9-]+)-(\d+)\.(.+)$/);
        if (match) {
          const [, tunnelId, , region] = match;
          return `${window.location.protocol}//${tunnelId}-5002.${region}/api`;
        }
        return `${window.location.protocol}//${window.location.hostname}/api`;
      })()
);

// Cache for GET requests
import { apiCache } from './cache';

// Debounce function for API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Enhanced API methods with caching
const cachedGet = async (url, ttl = 300000) => { // 5 minutes default
  const cacheKey = `GET:${url}`;
  const cached = apiCache.get(cacheKey);
  
  if (cached) {
    console.log(`Cache hit for ${url}`);
    return { data: cached };
  }
  
  console.log(`Cache miss for ${url}`);
  const response = await API.get(url);
  apiCache.set(cacheKey, response.data, ttl);
  return response;
};

// Batch multiple API calls
const batchGet = async (urls) => {
  const promises = urls.map(url => cachedGet(url));
  return Promise.all(promises);
};

const API = axios.create({
  baseURL: backendUrl,
  withCredentials: import.meta.env?.VITE_API_WITH_CREDENTIALS === 'true',
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': 'true'
  }
});

API.interceptors.request.use((req) => {
  try {
    const raw = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (raw) {
      const userInfo = JSON.parse(raw);
      if (userInfo?.token) {
        req.headers.Authorization = `Bearer ${userInfo.token}`;
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = `Unable to reach backend at ${backendUrl}. Check that the backend is running and CORS allows this frontend origin.`;
    } else if (error.response.status === 401) {
      const requestUrl = String(error.config?.url || '');
      const isLoginRequest =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/doctor/login') ||
        requestUrl.includes('/auth/doctor/verify-otp') ||
        requestUrl.includes('/auth/doctor/forgot-password') ||
        requestUrl.includes('/auth/doctor/verify-reset-otp') ||
        requestUrl.includes('/auth/doctor/reset-password') ||
        requestUrl.includes('/auth/login/verify-otp');

      if (!isLoginRequest && window.location.pathname !== '/') {
        sessionStorage.removeItem('userInfo');
        sessionStorage.removeItem('userType');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('userType');
        window.location.replace('/');
      }
    }
    return Promise.reject(error);
  }
);

/** Origin of the API server (no `/api` suffix), for sockets and static file URLs. */
export function getBackendOrigin() {
  const base = API.defaults.baseURL || '';
  return base.replace(/\/api\/?$/, '') || 'http://localhost:5002';
}

export default API;
