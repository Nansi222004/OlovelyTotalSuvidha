import api from "./config";
import { ApiResponse } from "./admin/types";

// ==================== Brand Interfaces ====================
export interface Brand {
    _id: string;
    name: string;
    image?: string;
    createdAt?: string;
    updatedAt?: string;
}

// ==================== Brand API Functions ====================

/**
 * Get all brands (accessible for sellers and admins)
 * Uses /products/brands endpoint which is available for authenticated sellers
 */
export const getBrands = async (params?: {
    search?: string;
}): Promise<ApiResponse<Brand[]>> => {
    // Use products endpoint to fetch brands - accessible for sellers
    const response = await api.get<ApiResponse<Brand[]>>("/products/brands", {
        params,
    });
    return response.data;
};

/**
 * Get brand by ID
 */
export const getBrandById = async (
    id: string
): Promise<ApiResponse<Brand>> => {
    const response = await api.get<ApiResponse<Brand>>(`/products/brands/${id}`);
    return response.data;
};
