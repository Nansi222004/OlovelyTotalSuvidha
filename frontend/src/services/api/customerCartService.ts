import api from './config';

export interface CartItem {
    _id: string;
    product: {
        _id: string;
        productName: string;
        price: number;
        mainImage: string;
        stock: number;
        pack?: string;
    };
    quantity: number;
    variation?: string;
}

export interface Cart {
    _id: string;
    items: CartItem[];
    total: number;
    estimatedDeliveryFee?: number;
    platformFee?: number;
    freeDeliveryThreshold?: number;
    minimumOrderValue?: number;
    debug_config?: any;
    backendTotal?: number;
}

export interface CartResponse {
    success: boolean;
    message?: string;
    data: Cart;
}

export interface CartLocationParams {
    latitude?: number;
    longitude?: number;
    deliveryOption?: string;
}

/**
 * Get current user's cart
 */
export const getCart = async (params?: CartLocationParams): Promise<CartResponse> => {
    const response = await api.get<CartResponse>('/customer/cart', { params });
    return response.data;
};

/**
 * Add item to cart
 */
export const addToCart = async (productId: string, quantity: number = 1, variation?: string, latitude?: number, longitude?: number, deliveryOption?: string): Promise<CartResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    if (deliveryOption) {
        params.deliveryOption = deliveryOption;
    }
    const response = await api.post<CartResponse>('/customer/cart/add', {
        productId,
        quantity,
        variation,
        deliveryOption
    }, { params });
    return response.data;
};

/**
 * Update cart item quantity
 */
export const updateCartItem = async (itemId: string, quantity: number, latitude?: number, longitude?: number, deliveryOption?: string): Promise<CartResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    if (deliveryOption) {
        params.deliveryOption = deliveryOption;
    }
    const response = await api.put<CartResponse>(`/customer/cart/item/${itemId}`, { quantity, deliveryOption }, { params });
    return response.data;
};

/**
 * Remove item from cart
 */
export const removeFromCart = async (itemId: string, latitude?: number, longitude?: number, deliveryOption?: string): Promise<CartResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    if (deliveryOption) {
        params.deliveryOption = deliveryOption;
    }
    const response = await api.delete<CartResponse>(`/customer/cart/item/${itemId}`, { params });
    return response.data;
};

/**
 * Clear cart
 */
export const clearCart = async (): Promise<CartResponse> => {
    const response = await api.delete<CartResponse>('/customer/cart');
    return response.data;
};
