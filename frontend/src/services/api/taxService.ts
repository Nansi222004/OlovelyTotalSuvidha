import api from './config';

export interface Tax {
    _id: string;
    name: string;
    percentage: number;
    type: string;
    description?: string;
    status: string;
}

export const getTaxes = async (): Promise<any> => {
    const response = await api.get('/seller/taxes');
    return response.data;
};

export const getActiveTaxes = async (): Promise<any> => {
    const response = await api.get('/seller/taxes/active');
    return response.data;
};

export const createTax = async (data: Partial<Tax>): Promise<any> => {
    const response = await api.post('/seller/taxes', data);
    return response.data;
};

export const updateTaxStatus = async (id: string, isActive: boolean): Promise<any> => {
    const response = await api.patch(`/seller/taxes/${id}/status`, { isActive });
    return response.data;
};
