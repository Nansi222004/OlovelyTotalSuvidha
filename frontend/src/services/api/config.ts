import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { shouldTerminateCustomerSession } from "./authSessionPolicy";
import {
  persistPanelSession,
  readPanelToken,
  readPanelUser,
  removePanelSession,
} from "./authStorage";

/**
 * Accept either supported frontend setting and normalize it to the backend's
 * mounted `/api/v1` prefix. This prevents `/auth/admin/login` from being sent
 * to the server root (or `/api`) and falling through to "Route not found".
 */
export const normalizeApiBaseUrl = (configuredUrl?: string): string => {
  const cleanUrl = String(configuredUrl || "http://localhost:5000").trim().replace(/\/+$/, "");
  if (/\/api\/v\d+$/i.test(cleanUrl)) return cleanUrl;
  if (/\/api$/i.test(cleanUrl)) return `${cleanUrl}/v1`;
  return `${cleanUrl}/api/v1`;
};

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
);

export type UserPanel = 'admin' | 'seller' | 'delivery' | 'customer';

// Socket.io base URL - extract from API_BASE_URL by removing /api/v1
// Socket connections need the base server URL without the API path
export const getSocketBaseURL = (): string => {
  const rawUrl =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000";

  // Strip trailing /api/v1 or /api to prevent Socket.io from interpreting path as a custom namespace
  const socketUrl = rawUrl.replace(/\/api\/v\d+\/?$|\/api\/?$/, '');

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

  // 1. Current browser path has highest precedence when navigating panel-specific sub-routes
  // This ensures all requests originating from within /admin/* use the admin token, /seller/* use seller token, etc.
  if (currentPath.startsWith('/admin') || currentPath.includes('/admin/')) return 'admin';
  if (currentPath.startsWith('/seller') || currentPath.includes('/seller/')) return 'seller';
  if (currentPath.startsWith('/delivery') || currentPath.includes('/delivery/')) return 'delivery';

  const requestUrl = url || '';

  // 2. Check explicit API request URL prefix (for background requests, auth requests, or specific endpoints)
  if (requestUrl.startsWith('/customer') || requestUrl.includes('/customer/')) return 'customer';
  if (
    requestUrl.startsWith('/admin') ||
    requestUrl.includes('/admin/') ||
    requestUrl.startsWith('/sellers') ||
    requestUrl.includes('/sellers/')
  ) {
    return 'admin';
  }
  if (requestUrl.startsWith('/delivery') || requestUrl.includes('/delivery/')) return 'delivery';
  if (requestUrl.startsWith('/seller/') || requestUrl === '/seller') return 'seller';

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

    // 3. Attach seller active channel header if in seller panel
    if (panel === 'seller' && typeof window !== 'undefined' && config.headers && !config.headers['x-channel']) {
      try {
        const rawUserData = localStorage.getItem('seller_userData');
        if (rawUserData) {
          const sellerUser = JSON.parse(rawUserData);
          const sellerId = sellerUser?.id || sellerUser?._id;
          const vendorType = sellerUser?.vendorType;
          const channel = vendorType === 'HYBRID'
            ? (sellerId ? localStorage.getItem(`olovely_seller_active_channel_${sellerId}`) : null) || 'QUICK_COMMERCE'
            : vendorType;
          if (channel) {
            config.headers['x-channel'] = channel;
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
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
    const status = error.response?.status;
    const errorCode = error.response?.data?.code;
    const isCustomerDeleted = errorCode === 'CUSTOMER_DELETED';
    const isDeliveryDeleted = errorCode === 'DELIVERY_PARTNER_DELETED';
    const isSellerDeleted = errorCode === 'SELLER_DELETED';

    // 1. Explicit Customer-deleted / invalid session detection
    if (isCustomerDeleted) {
      clearCustomerSession({
        sessionExpiredMessage: 'Your account is no longer available. Please log in again.',
      });

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.includes('/login') && !currentPath.includes('/signup')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // 2. Explicit Delivery Partner-deleted / invalid session detection
    if (isDeliveryDeleted) {
      clearDeliverySession({
        sessionExpiredMessage: 'Your delivery partner account is no longer available. Please log in again.',
      });

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.includes('/delivery/login') && !currentPath.includes('/delivery/signup')) {
        window.location.href = '/delivery/login';
      }
      return Promise.reject(error);
    }

    // 3. Explicit Seller-deleted / invalid session detection
    if (isSellerDeleted) {
      clearSellerSession({
        sessionExpiredMessage: 'Your seller account is no longer available. Please log in again.',
      });

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.includes('/seller/login') && !currentPath.includes('/seller/signup')) {
        window.location.href = '/seller/login';
      }
      return Promise.reject(error);
    }

    // 4. Handle 401 (Unauthorized) for auto-logout
    // 403 (Forbidden) means user is authenticated but doesn't have permission - DO NOT LOGOUT
    if (status === 401) {
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

        // Customer panel protection:
        // Do NOT treat every 401 as proof that customer must be logged out.
        // Background/optional requests, public endpoints, tracking, notifications, or serviceability
        // MUST NOT destroy the customer session or force redirect to /login.
        if (panel === 'customer') {
          const responseData = error.response?.data;
          const shouldLogoutCustomer = shouldTerminateCustomerSession(status, responseData?.code);

          if (shouldLogoutCustomer) {
            clearCustomerSession({
              sessionExpiredMessage: 'Your session has expired. Please log in again.',
            });
            window.location.href = '/login';
          } else {
            if (import.meta.env.DEV) {
              console.warn(`[AUTH] Non-terminal 401 on ${apiUrl} - preserving customer session.`);
            }
          }
          return Promise.reject(error);
        }

        // Clean up role-specific session
        if (panel === 'delivery') {
          clearDeliverySession({
            sessionExpiredMessage: 'Your session has expired. Please log in again.',
          });
        } else if (panel === 'seller') {
          clearSellerSession({
            sessionExpiredMessage: 'Your session has expired. Please log in again.',
          });
        } else {
          removeAuthToken(panel);
        }

        window.location.href = redirectPath;
      }
    }

    return Promise.reject(error);
  }
);

// Role-Safe Token Management Helpers
export const setAuthToken = (token: string, userType?: string, userData?: any) => {
  const panel = getPanelFromContext(userType);
  persistPanelSession(panel, token, userData);
};

export const getAuthToken = (panel?: UserPanel | string): string | null => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  return readPanelToken(activePanel);
};

export const getStoredUserData = (panel?: UserPanel | string): any => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  return readPanelUser(activePanel);
};

export const removeAuthToken = (panel?: UserPanel | string) => {
  const activePanel = getPanelFromContext(typeof panel === 'string' ? panel : undefined);
  removePanelSession(activePanel);
};

/**
 * Safely clear all customer-specific authentication and cached session data
 * without affecting Seller, Admin, or global app settings.
 */
export const clearCustomerSession = (options?: { sessionExpiredMessage?: string }) => {
  removeAuthToken('customer');
  localStorage.removeItem('customer_authToken');
  localStorage.removeItem('customer_userData');
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('saved_cart');
  localStorage.removeItem('fcm_token_web');

  if (options?.sessionExpiredMessage && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('customer_session_notice', options.sessionExpiredMessage);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('olovely:customer-logged-out', {
        detail: { reason: options?.sessionExpiredMessage || 'CUSTOMER_DELETED' },
      })
    );
  }
};

/**
 * Safely clear all delivery-partner-specific authentication and cached session data
 * without affecting Customer, Seller, Admin, or global app settings.
 */
export const clearDeliverySession = (options?: { sessionExpiredMessage?: string }) => {
  removeAuthToken('delivery');
  localStorage.removeItem('delivery_authToken');
  localStorage.removeItem('delivery_userData');
  localStorage.removeItem('delivery_user_name');
  localStorage.removeItem('delivery_push_prompt_dismissed');

  // Clear any delivery order notification queues
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('delivery_order_notifications_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    // Ignore storage iteration errors
  }

  if (options?.sessionExpiredMessage && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('delivery_session_notice', options.sessionExpiredMessage);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('olovely:delivery-logged-out', {
        detail: { reason: options?.sessionExpiredMessage || 'DELIVERY_PARTNER_DELETED' },
      })
    );
  }
};

/**
 * Safely clear all seller-specific authentication and cached session data
 * without affecting Customer, Delivery, Admin, or global app settings.
 */
export const clearSellerSession = (options?: { sessionExpiredMessage?: string }) => {
  removeAuthToken('seller');
  localStorage.removeItem('seller_authToken');
  localStorage.removeItem('seller_userData');

  if (options?.sessionExpiredMessage && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('seller_session_notice', options.sessionExpiredMessage);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('olovely:seller-logged-out', {
        detail: { reason: options?.sessionExpiredMessage || 'SELLER_DELETED' },
      })
    );
  }
};

export default api;
