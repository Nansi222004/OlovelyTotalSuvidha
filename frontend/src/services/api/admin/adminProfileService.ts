import api from '../config';

export interface AdminProfile {
    id: string;
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    role: string;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateProfileData {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobile?: string;
}

export interface ProfileResponse {
    success: boolean;
    message?: string;
    data: AdminProfile;
}

/**
 * Get admin profile
 */
export const getProfile = async (): Promise<ProfileResponse> => {
    const response = await api.get<ProfileResponse>('/admin/profile');
    return response.data;
};

/**
 * Update admin profile
 */
export const updateProfile = async (data: UpdateProfileData): Promise<ProfileResponse> => {
    const response = await api.put<ProfileResponse>('/admin/profile', data);
    return response.data;
};
