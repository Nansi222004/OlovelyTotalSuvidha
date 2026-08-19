import api from './config';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth?: string;
  registrationDate: string;
  status: string;
  refCode: string;
  walletAmount: number;
  totalOrders: number;
  totalSpent: number;
}

export interface GetProfileResponse {
  success: boolean;
  message: string;
  data: CustomerProfile;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  dateOfBirth?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data: CustomerProfile;
}

/**
 * Get customer profile
 */
export const getProfile = async (): Promise<GetProfileResponse> => {
  const response = await api.get<GetProfileResponse>('/customer/profile');
  return response.data;
};

/**
 * Update customer profile
 */
export const updateProfile = async (data: UpdateProfileData): Promise<UpdateProfileResponse> => {
  const response = await api.put<UpdateProfileResponse>('/customer/profile', data);
  return response.data;
};

export interface SupportContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface SupportContactResponse {
  success: boolean;
  message: string;
  data?: {
    requestId: string;
  };
}

/**
 * Submit customer support contact message
 */
export const submitCustomerSupport = async (data: SupportContactData): Promise<SupportContactResponse> => {
  const response = await api.post<SupportContactResponse>('/customer/support/contact', data);
  return response.data;
};


