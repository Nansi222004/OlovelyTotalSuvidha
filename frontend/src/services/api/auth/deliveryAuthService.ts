import api, { setAuthToken, removeAuthToken } from '../config';
const handleApiError = (error: any) => {
  if (error.response && error.response.data && error.response.data.message) {
    throw new Error(error.response.data.message);
  }
  throw new Error(error.message || 'An unexpected error occurred');
};

export interface SendOTPResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      mobile: string;
      email: string;
      city: string;
      status: string;
    };
  };
}

export interface RegisterData {
  name: string;
  mobile: string;
  email: string;
  dateOfBirth?: string;
  password: string;
  address: string;
  city: string;
  pincode?: string;
  drivingLicense?: string;
  nationalIdentityCard?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bonusType?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;
    user?: {
      id: string;
      name: string;
      mobile: string;
      email: string;
      city: string;
      status: string;
    };
  };
}

// Send SMS OTP
export const sendOTP = async (mobile: string): Promise<SendOTPResponse> => {
  const response = await api.post('/auth/delivery/send-sms-otp', { mobile });
  return response.data;
};

// Verify SMS OTP
export const verifyOTP = async (
  mobile: string,
  otp: string,
  sessionId?: string
): Promise<VerifyOTPResponse> => {
  const response = await api.post('/auth/delivery/verify-sms-otp', {
    mobile,
    otp,
    sessionId,
  });

  if (response.data.success && response.data.data?.token) {
    setAuthToken(response.data.data.token);
    const userData = {
      ...response.data.data.user,
      userType: 'Delivery' as const,
    };
    localStorage.setItem('userData', JSON.stringify(userData));
  }

  return response.data;
};

/**
 * Register new delivery partner
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/delivery/register', data);
  return response.data;
};

/**
 * Logout delivery partner
 */
export const logout = (): void => {
  removeAuthToken();
};

