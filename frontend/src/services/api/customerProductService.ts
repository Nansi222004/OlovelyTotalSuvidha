import api from './config';
import { Product } from './productService'; // Reuse generic product type if compatible or define new one
import { apiCache } from '../../utils/apiCache';

export interface Category {
    _id: string; // MongoDB ID
    id?: string; // Virtual ID
    name: string;
    slug?: string;
    parent?: string | null;
    parentId?: string | null;
    image?: string;
    icon?: string;
    description?: string;
    isActive: boolean;
    order?: number;
    children?: Category[];
    subcategories?: Category[];
    headerCategoryId?: string | { _id: string; name?: string };
    totalProducts?: number;
    commerceChannels?: ("QUICK_COMMERCE" | "ECOMMERCE")[];
    wholesaleEnabled?: boolean;
}

export interface GetProductsParams {
    search?: string;
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'price_asc' | 'price_desc' | 'popular' | 'discount';
    page?: number;
    limit?: number;
    latitude?: number; // User location latitude
    longitude?: number; // User location longitude
    channel?: string;
    productType?: string;
    isWholesale?: boolean | string;
}

export interface ProductListResponse {
    success: boolean;
    data: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ProductDetailResponse {
    success: boolean;
    message?: string;
    data: Product & { similarProducts?: Product[] };
}

export interface CategoryListResponse {
    success: boolean;
    data: Category[];
}

/**
 * Get products with filters (Public)
 * Location (latitude/longitude) is required to filter products by seller's service radius
 */
export const getProducts = async (params?: GetProductsParams): Promise<ProductListResponse> => {
    const response = await api.get<ProductListResponse>('/customer/products', { params });
    return response.data;
};

/**
 * Get product details by ID (Public)
 * Location (latitude/longitude) is required to verify product availability
 */
export const getProductById = async (
    id: string,
    latitude?: number,
    longitude?: number,
    isWholesale?: boolean
): Promise<ProductDetailResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    if (isWholesale) {
        params.isWholesale = 'true';
    }
    const response = await api.get<ProductDetailResponse>(`/customer/products/${id}`, { params });
    return response.data;
};

/**
 * Get category details by ID or slug (Public)
 */
export const getCategoryById = async (id: string): Promise<any> => {
    const response = await api.get<any>(`/customer/categories/${id}`);
    return response.data;
};

/**
 * Get all categories (Public)
 * Using /tree endpoint to get hierarchy if available, otherwise just /
 * Cached for 10 minutes as categories don't change frequently
 */
export const getCategories = async (
    tree: boolean = false,
    skipCache: boolean = false,
    channel?: "QUICK_COMMERCE" | "ECOMMERCE"
): Promise<CategoryListResponse> => {
    const url = tree ? '/customer/categories/tree' : '/customer/categories';
    const params = channel ? { channel } : undefined;
    if (skipCache) {
        const response = await api.get<CategoryListResponse>(url, { params });
        return response.data;
    }
    const cacheKey = `customer-categories-v3-${tree ? 'tree' : 'list'}${channel ? `-${channel}` : ''}`;
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
            const response = await api.get<CategoryListResponse>(url, { params });
            return response.data;
        },
        5 * 60 * 1000 // 5 minutes cache
    );
};

export interface SuggestionCategory {
    _id: string;
    name: string;
    slug?: string;
    image?: string | null;
    icon?: string | null;
}

export interface SuggestionSubcategory {
    _id: string;
    name: string;
    category: string;
    categorySlug?: string | null;
    categoryName?: string | null;
    image?: string | null;
}

export interface SuggestionProduct {
    _id: string;
    productName: string;
    mainImage?: string | null;
    price: number;
    discPrice: number;
    productType: string;
    categoryName?: string | null;
    categorySlug?: string | null;
    wholesaleEnabled?: boolean;
    wholesalePrice?: number | null;
    wholesaleMinQty?: number | null;
}

export interface SuggestionBrand {
    _id: string;
    name: string;
    image?: string | null;
}

export interface SearchSuggestionsData {
    categories: SuggestionCategory[];
    subcategories: SuggestionSubcategory[];
    products: SuggestionProduct[];
    brands: SuggestionBrand[];
}

export interface SearchSuggestionsResponse {
    success: boolean;
    data: SearchSuggestionsData;
    message?: string;
}

/**
 * Get search autocomplete suggestions from real database records (Public)
 * Lightweight query with client-side 30s cache and in-flight deduplication
 */
export const getSearchSuggestions = async (
    query: string,
    channel?: string,
    isWholesale?: boolean
): Promise<SearchSuggestionsResponse> => {
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ || cleanQ.length < 2) {
        return {
            success: true,
            data: { categories: [], subcategories: [], products: [], brands: [] },
        };
    }

    const channelKey = (channel || 'ALL').toUpperCase();
    const modeKey = isWholesale ? 'ws' : 'rt';
    const cacheKey = `search-sugg-v1-${cleanQ}-${channelKey}-${modeKey}`;

    return apiCache.getOrFetch(
        cacheKey,
        async () => {
            const params: any = { q: query.trim() };
            if (channel && channel !== 'ALL') {
                params.channel = channel;
            }
            if (isWholesale) {
                params.isWholesale = 'true';
            }
            const response = await api.get<SearchSuggestionsResponse>('/customer/search/suggestions', {
                params,
            });
            return response.data;
        },
        30 * 1000 // 30 seconds cache
    );
};

