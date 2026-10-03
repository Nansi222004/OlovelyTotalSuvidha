import api, { setAuthToken, removeAuthToken } from '../config';

export interface AdminLoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      mobile: string;
      email: string;
      role: string;
    };
  };
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
  role?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      mobile: string;
      email: string;
      role: string;
    };
  };
}

/**
 * Login admin with email and password
 */
export const login = async (email: string, password: string): Promise<AdminLoginResponse> => {
  const response = await api.post<AdminLoginResponse>('/auth/admin/login', { email, password });

  if (response.data.success && response.data.data.token) {
    const userWithUserType = {
      ...response.data.data.user,
      userType: 'Admin' as const,
    };
    setAuthToken(response.data.data.token, 'Admin', userWithUserType);
  }

  return response.data;
};

/**
 * Register new admin
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/admin/register', data);

  if (response.data.success && response.data.data.token) {
    const userWithUserType = {
      ...response.data.data.user,
      userType: 'Admin' as const,
    };
    setAuthToken(response.data.data.token, 'Admin', userWithUserType);
  }

  return response.data;
};

/**
 * Logout admin
 */
export const logout = (): void => {
  removeAuthToken('admin');
};

export interface AdminProfileResponse {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    name: string;
    email: string;
    mobile: string;
    profileImage?: string;
    role: string;
  };
}

/**
 * Get admin profile
 */
export const getAdminProfile = async (): Promise<AdminProfileResponse> => {
  const response = await api.get<AdminProfileResponse>('/auth/admin/profile');
  return response.data;
};

/**
 * Update admin profile
 */
export const updateAdminProfile = async (data: {
  name?: string;
  mobile?: string;
  profileImage?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<AdminProfileResponse> => {
  const response = await api.put<AdminProfileResponse>('/auth/admin/profile', data);
  return response.data;
};
