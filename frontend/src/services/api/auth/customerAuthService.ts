import api, { setAuthToken, removeAuthToken } from '../config';

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
      phone: string;
      email: string;
      walletAmount: number;
      refCode: string;
      status: string;
    };
    isNewUser?: boolean;
  };
}

/**
 * Send SMS OTP to customer mobile number.
 * Mobile must be 10-digit string (e.g. "9755620716"). Backend normalizes and sends as 91XXXXXXXXXX to SMS gateway.
 */
export const sendOTP = async (mobile: string): Promise<SendOTPResponse> => {
  const mobileStr = String(mobile ?? '').replace(/\D/g, '').slice(0, 10);
  const response = await api.post<SendOTPResponse>('/auth/customer/send-sms-otp', { mobile: mobileStr });
  return response.data;
};

/**
 * Verify SMS OTP and login customer
 * Auto-creates customer if not exists
 */
export const verifyOTP = async (mobile: string, otp: string, sessionId?: string): Promise<VerifyOTPResponse> => {
  const response = await api.post<VerifyOTPResponse>('/auth/customer/verify-sms-otp', { mobile, otp, sessionId });

  if (response.data.success && response.data.data.token) {
    setAuthToken(response.data.data.token);
    // Add userType to user data for proper identification
    const userData = {
      ...response.data.data.user,
      userType: 'Customer'
    };
    localStorage.setItem('userData', JSON.stringify(userData));
  }

  return response.data;
};

/**
 * Logout customer
 */
export const logout = (): void => {
  removeAuthToken();
};

