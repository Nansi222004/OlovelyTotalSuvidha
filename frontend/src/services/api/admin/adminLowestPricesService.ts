import api from "../config";

export interface LowestPricesProduct {
    _id: string;
    product: {
        _id: string;
        productName: string;
        mainImage?: string;
        price: number;
        mrp?: number;
        discount?: number;
        status: string;
        publish: boolean;
    };
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LowestPricesProductFormData {
    product: string;
    order?: number;
    isActive: boolean;
}

export interface LowestPricesProductResponse {
    success: boolean;
    message?: string;
    data?: LowestPricesProduct | LowestPricesProduct[];
}

// Get all lowest prices products
export const getLowestPricesProducts = async (): Promise<LowestPricesProductResponse> => {
    const response = await api.get<LowestPricesProductResponse>("/admin/lowest-prices-products");
    return response.data;
};

// Get single lowest prices product by ID
export const getLowestPricesProductById = async (
    id: string
): Promise<LowestPricesProductResponse> => {
    const response = await api.get<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`
    );
    return response.data;
};

// Create new lowest prices product
export const createLowestPricesProduct = async (
    data: LowestPricesProductFormData
): Promise<LowestPricesProductResponse> => {
    const response = await api.post<LowestPricesProductResponse>(
        "/admin/lowest-prices-products",
        data
    );
    return response.data;
};

// Update lowest prices product
export const updateLowestPricesProduct = async (
    id: string,
    data: Partial<LowestPricesProductFormData>
): Promise<LowestPricesProductResponse> => {
    const response = await api.put<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`,
        data
    );
    return response.data;
};

// Delete lowest prices product
export const deleteLowestPricesProduct = async (
    id: string
): Promise<LowestPricesProductResponse> => {
    const response = await api.delete<LowestPricesProductResponse>(
        `/admin/lowest-prices-products/${id}`
    );
    return response.data;
};

// Reorder lowest prices products
export const reorderLowestPricesProducts = async (
    products: { id: string; order: number }[]
): Promise<LowestPricesProductResponse> => {
    const response = await api.put<LowestPricesProductResponse>(
        "/admin/lowest-prices-products/reorder",
        { products }
    );
    return response.data;
};

