import api from './config';

export interface Address {
    _id?: string;
    fullName: string;
    phone: string;
    address: string; // "Flat, Street"
    city: string;
    state?: string;
    pincode: string;
    type: 'Home' | 'Work' | 'Hotel' | 'Other';
    isDefault: boolean;
    latitude?: number;
    longitude?: number;
    landmark?: string;
}

export interface AddressResponse {
    success: boolean;
    message?: string;
    data: Address | Address[];
}

/**
 * Get all addresses
 */
export const getAddresses = async (): Promise<AddressResponse> => {
    const response = await api.get<AddressResponse>('/customer/addresses');
    return response.data;
};

/**
 * Add new address
 */
export const addAddress = async (data: Partial<Address> & { flat?: string, street?: string }): Promise<AddressResponse> => {
    const response = await api.post<AddressResponse>('/customer/addresses', data);
    return response.data;
};

/**
 * Update address
 */
export const updateAddress = async (id: string, data: Partial<Address> & { flat?: string, street?: string }): Promise<AddressResponse> => {
    const response = await api.put<AddressResponse>(`/customer/addresses/${id}`, data);
    return response.data;
};

/**
 * Delete address
 */
export const deleteAddress = async (id: string): Promise<any> => {
    const response = await api.delete(`/customer/addresses/${id}`);
    return response.data;
};
