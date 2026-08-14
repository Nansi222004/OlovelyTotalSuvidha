import api, { setAuthToken, removeAuthToken } from '../config';

export interface SendOTPResponse {
  success: boolean;
  message: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      sellerName: string;
      mobile: string;
      email: string;
      storeName: string;
      status: string;
      logo?: string;
      address?: string;
      city?: string;
    };
  };
}

export interface RegisterData {
  sellerName: string;
  mobile: string;
  email: string;
  storeName: string;
  category?: string; // primary category (optional if categories array provided)
  categories: string[]; // multiple categories
  address: string;
  city: string;
  serviceableArea?: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  serviceRadiusKm?: string | number;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      sellerName: string;
      mobile: string;
      email: string;
      storeName: string;
      status: string;
      categories?: string[];
    };
  };
}

/**
 * Send OTP to seller mobile number
 */
export const sendOTP = async (mobile: string): Promise<SendOTPResponse> => {
  const response = await api.post<SendOTPResponse>('/auth/seller/send-otp', { mobile });
  return response.data;
};

/**
 * Verify OTP and login seller
 */
export const verifyOTP = async (mobile: string, otp: string): Promise<VerifyOTPResponse> => {
  const response = await api.post<VerifyOTPResponse>('/auth/seller/verify-otp', { mobile, otp });
  return response.data;
};

/**
 * Register new seller
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/seller/register', data);
  return response.data;
};

/**
 * Get current seller profile
 */
export const getSellerProfile = async (): Promise<any> => {
  const response = await api.get('/auth/seller/profile');
  return response.data;
};

/**
 * Update seller profile
 */
export const updateSellerProfile = async (data: any): Promise<any> => {
  const response = await api.put('/auth/seller/profile', data);
  return response.data;
};

/**
 * Logout seller
 */
export const logout = (): void => {
  removeAuthToken();
};

/**
 * Toggle shop status (Open/Close)
 */
export const toggleShopStatus = async (): Promise<any> => {
  const response = await api.put('/auth/seller/toggle-shop-status');
  return response.data;
};


