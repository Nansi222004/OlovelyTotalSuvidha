import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// Base API URL - adjust based on your backend URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export type UserPanel = 'admin' | 'seller' | 'delivery' | 'customer';

// Socket.io base URL - extract from API_BASE_URL by removing /api/v1
// Socket connections need the base server URL without the API path
export const getSocketBaseURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
  const socketUrl = apiBaseUrl.replace(/\/api\/v\d+$|\/api$/, '');

  return socketUrl || "http://localhost:5000";
};

/**
 * Determine active panel context from explicit parameter, userType, or URL
 */
export const getPanelFromContext = (hint?: string, url?: string): UserPanel => {
  if (hint) {
    const norm = hint.toLowerCase();
    if (norm === 'admin') return 'admin';
    if (norm === 'seller') return 'seller';
    if (norm === 'delivery') return 'delivery';
    if (norm === 'customer') return 'customer';
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const requestUrl = url || '';

  // 1. Check current browser location pathname first
  if (currentPath.includes('/admin')) return 'admin';
  if (currentPath.includes('/seller') || currentPath.includes('/sellers')) return 'seller';
  if (currentPath.includes('/delivery')) return 'delivery';

  // 2. Check API request URL endpoint
  if (requestUrl.includes('/admin')) return 'admin';
  if (requestUrl.includes('/seller') || requestUrl.includes('/sellers')) return 'seller';
  if (requestUrl.includes('/delivery')) return 'delivery';

  return 'customer';
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add role-safe token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Skip if authorization header already explicitly attached
    if (config.headers?.Authorization) {
      return config;
    }

    // 2. Determine target panel from request URL or browser location
    const panel = getPanelFromContext(undefined, config.url);
    const token = getAuthToken(panel);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.log(`[AUTH DEBUG] Panel: ${panel} | Request: ${config.method?.toUpperCase()} ${config.url} | Token Present: ${!!token}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle authentication errors cleanly
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: any) => {
    // Only handle 401 (Unauthorized) for auto-logout
    // 403 (Forbidden) means user is authenticated but doesn't have permission - DO NOT LOGOUT
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes("/auth/");
      const hadToken = error.config?.headers?.Authorization;

      if (!isAuthEndpoint && hadToken) {
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

        // Skip redirect if already on public auth pages (login/signup)
        if (currentPath.includes("/login") || currentPath.includes("/signup")) {
          return Promise.reject(error);
        }

        const apiUrl = error.config?.url || "";
        const panel = getPanelFromContext(undefined, apiUrl || currentPath);

        let redirectPath = "/login";
        if (panel === 'admin') redirectPath = "/admin/login";
        else if (panel === 'seller') redirectPath = "/seller/login";
        else if (panel === 'delivery') redirectPath = "/delivery/login";

        // Remove ONLY the specific panel's token
        removeAuthToken(panel);
        window.location.href = redirectPath;
      }
    }

    return Promise.reject(error);
  }
);

// Role-Safe Token Management Helpers
export const setAuthToken = (token: string, userType?: string, userData?: any) => {
  const panel = getPanelFromContext(userType);
  const tokenKey = `${panel}_authToken`;
  const userKey = `${panel}_userData`;

  localStorage.setItem(tokenKey, token);

  if (userData) {
    localStorage.setItem(userKey, typeof userData === 'string' ? userData : JSON.stringify(userData));
  }

  // Purge obsolete shared legacy keys to prevent cross-panel ambiguity
  localStorage.removeItem("authToken");
  localStorage.removeItem("userData");
};

export const getAuthToken = (panel?: UserPanel | string): string | null => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  const panelKey = `${activePanel}_authToken`;

  return localStorage.getItem(panelKey);
};

export const getStoredUserData = (panel?: UserPanel | string): any => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  const userKey = `${activePanel}_userData`;

  const stored = localStorage.getItem(userKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
};

export const removeAuthToken = (panel?: UserPanel | string) => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  const tokenKey = `${activePanel}_authToken`;
  const userKey = `${activePanel}_userData`;

  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);

  // Purge obsolete shared legacy keys
  localStorage.removeItem("authToken");
  localStorage.removeItem("userData");
};

export default api;

