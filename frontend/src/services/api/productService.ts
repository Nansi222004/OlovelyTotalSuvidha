import api from "./config";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ProductVariation {
  _id?: string;
  name?: string; // Mapped from title if needed, or direct
  value?: string;
  title?: string; // Frontend uses title
  price: number;
  discPrice: number;
  stock: number;
  status: "Available" | "Sold out" | "In stock"; // Added In stock
  sku?: string;
}

export interface Product {
  _id: string;
  productName: string;
  seller: string | any; // Updated to allow populated object
  headerCategoryId?: string | any; // Updated to allow populated object
  category?: string | any; // Updated to allow populated object
  subcategory?: string | any;
  subSubCategory?: string | any; // Added subSubCategory
  brand?: string | any; // Updated
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  seoTitle?: string;
  seoKeywords?: string;
  seoImageAlt?: string;
  seoDescription?: string;
  smallDescription?: string;
  tags: string[];
  manufacturer?: string;
  madeIn?: string;
  tax?: string | any; // Updated
  isReturnable: boolean;
  maxReturnDays?: number;
  totalAllowedQuantity: number;
  fssaiLicNo?: string;
  mainImageUrl?: string;
  mainImage?: string; // Mapped directly from Product model
  galleryImageUrls: string[];
  price?: number;
  discPrice?: number;
  compareAtPrice?: number;
  mrp?: number;
  discount?: number;
  variations: ProductVariation[];
  variationType?: string;
  createdAt?: string;
  updatedAt?: string;
  // Fallback for old fields if any legacy code uses them
  sellerId?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  taxId?: string;
  // Shop by Store fields
  isShopByStoreOnly?: boolean;
  shopId?: string | any;
  rating?: number;
  reviewsCount?: number;
}

export interface CreateProductData {
  productName: string;
  headerCategoryId?: string;
  categoryId?: string;
  subcategoryId?: string;
  subSubCategoryId?: string;
  brandId?: string;
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  seoTitle?: string;
  seoKeywords?: string;
  seoImageAlt?: string;
  seoDescription?: string;
  smallDescription?: string;
  tags?: string[];
  manufacturer?: string;
  madeIn?: string;
  taxId?: string;
  isReturnable: boolean;
  maxReturnDays?: number;
  totalAllowedQuantity: number;
  fssaiLicNo?: string;
  mainImageUrl?: string;
  galleryImageUrls?: string[];
  variations: ProductVariation[];
  variationType?: string;
  isShopByStoreOnly?: boolean;
  shopId?: string;
}

export interface Shop {
  _id: string;
  name: string;
  storeId: string;
  image?: string;
}

export interface UpdateProductData extends Partial<CreateProductData> { }

export interface GetProductsParams {
  search?: string;
  category?: string;
  status?: "published" | "unpublished" | "popular" | "dealOfDay";
  stock?: "inStock" | "outOfStock";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Create a new product
 */
export const createProduct = async (
  data: CreateProductData
): Promise<ApiResponse<Product>> => {
  const response = await api.post<ApiResponse<Product>>("/products", data);
  return response.data;
};

/**
 * Get seller's products with filters
 */
export const getProducts = async (
  params?: GetProductsParams
): Promise<ApiResponse<Product[]>> => {
  const response = await api.get<ApiResponse<Product[]>>("/products", {
    params,
  });
  return response.data;
};

/**
 * Get product by ID
 */
export const getProductById = async (
  id: string
): Promise<ApiResponse<Product>> => {
  const response = await api.get<ApiResponse<Product>>(`/products/${id}`);
  return response.data;
};

/**
 * Update product
 */
export const updateProduct = async (
  id: string,
  data: UpdateProductData
): Promise<ApiResponse<Product>> => {
  const response = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
  return response.data;
};

/**
 * Update stock for a product variation
 */
export const updateStock = async (
  productId: string,
  variationId: string,
  stock: number,
  status?: "Available" | "Sold out"
): Promise<ApiResponse<Product>> => {
  const response = await api.patch<ApiResponse<Product>>(
    `/products/${productId}/variations/${variationId}/stock`,
    { stock, status }
  );
  return response.data;
};

/**
 * Bulk update stock for multiple variations
 */
export const bulkUpdateStock = async (
  updates: { productId: string; variationId: string; stock: number }[]
): Promise<any> => {
  const response = await api.patch("/products/bulk-stock-update", { updates });
  return response.data;
};

/**
 * Delete product
 */
export const deleteProduct = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/products/${id}`);
  return response.data;
};

/**
 * Update product status (publish, popular, dealOfDay)
 */
export const updateProductStatus = async (
  id: string,
  status: { publish?: boolean; popular?: boolean; dealOfDay?: boolean }
): Promise<ApiResponse<Product>> => {
  const response = await api.patch<ApiResponse<Product>>(
    `/products/${id}/status`,
    status
  );
  return response.data;
};

/**
 * Get all active shops (for seller to select when creating shop-by-store-only products)
 */
export const getShops = async (): Promise<ApiResponse<Shop[]>> => {
  const response = await api.get<ApiResponse<Shop[]>>("/products/shops");
  return response.data;
};

/**
 * Get header categories that the current seller is allowed to sell in
 * (filtered by categories selected during registration)
 */
export const getAllowedHeaderCategories = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>("/products/allowed-header-categories");
  return response.data;
};
