import api from "../config";

import { ApiResponse } from "./types";

// ==================== Category Interfaces ====================
export interface Category {
  _id: string;
  name: string;
  image?: string;
  order: number;
  isBestseller: boolean;
  hasWarning: boolean;
  groupCategory?: string;
  totalSubcategories?: number;
  status: "Active" | "Inactive";
  parentId?: string | null;
  parent?: Category;
  children?: Category[];
  childrenCount?: number;
  headerCategoryId?: string | null;
  headerCategory?: {
    _id: string;
    name: string;
    status: "Published" | "Unpublished";
  };
  createdAt?: string;
  updatedAt?: string;
  commissionRate?: number;
}

export interface CreateCategoryData {
  name: string;
  image?: string;
  order?: number;
  isBestseller?: boolean;
  hasWarning?: boolean;
  groupCategory?: string;
  parentId?: string | null;
  headerCategoryId?: string | null;
  status?: "Active" | "Inactive";
  commissionRate?: number;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> { }

export interface BulkDeleteData {
  categoryIds: string[];
}

export interface ReorderCategoriesData {
  categories: Array<{ id: string; order: number }>;
}

export interface UpdateCategoryOrderData {
  categories: Array<{ id: string; order: number }>;
}

export interface UpdateProductOrderData {
  products: Array<{ id: string; order: number }>;
}

// ==================== SubCategory Interfaces ====================
export interface SubCategory {
  _id: string;
  name: string;
  category: string | Category;
  image?: string;
  order: number;
  totalProduct?: number; // Total products in this subcategory
  createdAt?: string;
  updatedAt?: string;
  commissionRate?: number;
}

export interface CreateSubCategoryData {
  name: string;
  category: string;
  image?: string;
  order?: number;
  commissionRate?: number;
}

// ==================== Seller Interfaces ====================
export interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  profile?: string;
  status: string;
}

// ==================== Brand Interfaces ====================
export interface Brand {
  _id: string;
  name: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBrandData {
  name: string;
  image?: string;
}

// ==================== Product Interfaces ====================
export interface Product {
  _id: string;
  productName: string;
  smallDescription?: string;
  description?: string;
  category: string | Category;
  subcategory?: string | SubCategory;
  brand?: string | Brand;
  seller: string | { sellerName: string; storeName: string };
  mainImage?: string;
  galleryImages: string[];
  price: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  barcode?: string;
  variationType?: string;
  variations?: Array<{
    name: string;
    value: string;
    price?: number;
    stock?: number;
    sku?: string;
  }>;
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  status: "Active" | "Inactive" | "Pending" | "Rejected";
  manufacturer?: string;
  madeIn?: string;
  tax?: string;
  fssaiLicNo?: string;
  totalAllowedQuantity?: number;
  isReturnable: boolean;
  maxReturnDays?: number;
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;
  tags: string[];
  requiresApproval: boolean;
  approvedBy?: string | { firstName: string; lastName: string };
  approvedAt?: string;
  commission?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductData {
  productName: string;
  smallDescription?: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  seller?: string;
  mainImage?: string;
  galleryImages?: string[];
  price: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  barcode?: string;
  variationType?: string;
  variations?: Array<{
    name: string;
    value: string;
    price?: number;
    stock?: number;
    sku?: string;
  }>;
  publish?: boolean;
  popular?: boolean;
  dealOfDay?: boolean;
  manufacturer?: string;
  madeIn?: string;
  tax?: string;
  fssaiLicNo?: string;
  totalAllowedQuantity?: number;
  isReturnable?: boolean;
  maxReturnDays?: number;
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;
  tags?: string[];
  commission?: number;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  seller?: string;
  status?: "Active" | "Inactive" | "Pending" | "Rejected";
  publish?: boolean;
}

export interface BulkImportProductsData {
  products: CreateProductData[];
}

export interface BulkUpdateProductsData {
  productIds: string[];
  updateData: Partial<Product>;
}

// ==================== Category API Functions ====================

/**
 * Create a new category
 */
export const createCategory = async (
  data: CreateCategoryData
): Promise<ApiResponse<Category>> => {
  const response = await api.post<ApiResponse<Category>>(
    "/admin/categories",
    data
  );
  return response.data;
};

/**
 * Get all categories
 */
export const getCategories = async (params?: {
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  parentId?: string | null;
  includeChildren?: boolean;
  status?: "Active" | "Inactive";
}): Promise<ApiResponse<Category[]>> => {
  const queryParams: any = { ...params };
  if (params?.includeChildren !== undefined) {
    queryParams.includeChildren = params.includeChildren.toString();
  }
  if (params?.parentId === null || params?.parentId === undefined) {
    // Don't include parentId in query if it's null/undefined
    delete queryParams.parentId;
  }
  const response = await api.get<ApiResponse<Category[]>>("/admin/categories", {
    params: queryParams,
  });
  return response.data;
};

/**
 * Update category
 */
export const updateCategory = async (
  id: string,
  data: UpdateCategoryData
): Promise<ApiResponse<Category>> => {
  const response = await api.put<ApiResponse<Category>>(
    `/admin/categories/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete category
 */
export const deleteCategory = async (
  id: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(
    `/admin/categories/${id}`
  );
  return response.data;
};

/**
 * Update category order
 */
export const updateCategoryOrder = async (
  data: ReorderCategoriesData
): Promise<ApiResponse<void>> => {
  const response = await api.put<ApiResponse<void>>(
    "/admin/categories/reorder",
    data
  );
  return response.data;
};

/**
 * Toggle category status
 */
export const toggleCategoryStatus = async (
  id: string,
  status: "Active" | "Inactive",
  cascadeToChildren?: boolean
): Promise<ApiResponse<Category>> => {
  const response = await api.patch<ApiResponse<Category>>(
    `/admin/categories/${id}/status`,
    { status, cascadeToChildren }
  );
  return response.data;
};

/**
 * Bulk delete categories
 */
export const bulkDeleteCategories = async (
  categoryIds: string[]
): Promise<
  ApiResponse<{
    deleted: string[];
    failed: Array<{ id: string; reason: string }>;
  }>
> => {
  const response = await api.post<
    ApiResponse<{
      deleted: string[];
      failed: Array<{ id: string; reason: string }>;
    }>
  >("/admin/categories/bulk-delete", { categoryIds });
  return response.data;
};

/**
 * Update product order
 */
export const updateProductOrder = async (
  data: UpdateProductOrderData
): Promise<ApiResponse<void>> => {
  const response = await api.put<ApiResponse<void>>(
    "/admin/products/order",
    data
  );
  return response.data;
};

// ==================== SubCategory API Functions ====================

/**
 * Create a new subcategory
 */
export const createSubCategory = async (
  data: CreateSubCategoryData
): Promise<ApiResponse<SubCategory>> => {
  const response = await api.post<ApiResponse<SubCategory>>(
    "/admin/subcategories",
    data
  );
  return response.data;
};

/**
 * Get all subcategories
 */
export const getSubCategories = async (params?: {
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<ApiResponse<SubCategory[]>> => {
  const response = await api.get<ApiResponse<SubCategory[]>>(
    "/admin/subcategories",
    { params }
  );
  return response.data;
};

/**
 * Update subcategory
 */
export const updateSubCategory = async (
  id: string,
  data: Partial<CreateSubCategoryData>
): Promise<ApiResponse<SubCategory>> => {
  const response = await api.put<ApiResponse<SubCategory>>(
    `/admin/subcategories/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete subcategory
 */
export const deleteSubCategory = async (
  id: string
): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(
    `/admin/subcategories/${id}`
  );
  return response.data;
};

// ==================== Seller API Functions ====================

/**
 * Get all sellers
 */
export const getSellers = async (): Promise<ApiResponse<Seller[]>> => {
  const response = await api.get<ApiResponse<Seller[]>>("/admin/sellers");
  return response.data;
};

// ==================== Brand API Functions ====================

/**
 * Create a new brand
 */
export const createBrand = async (
  data: CreateBrandData
): Promise<ApiResponse<Brand>> => {
  const response = await api.post<ApiResponse<Brand>>("/admin/brands", data);
  return response.data;
};

/**
 * Get all brands
 */
export const getBrands = async (params?: {
  search?: string;
}): Promise<ApiResponse<Brand[]>> => {
  const response = await api.get<ApiResponse<Brand[]>>("/admin/brands", {
    params,
  });
  return response.data;
};

/**
 * Update brand
 */
export const updateBrand = async (
  id: string,
  data: Partial<CreateBrandData>
): Promise<ApiResponse<Brand>> => {
  const response = await api.put<ApiResponse<Brand>>(
    `/admin/brands/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete brand
 */
export const deleteBrand = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/brands/${id}`);
  return response.data;
};

// ==================== Product API Functions ====================

/**
 * Create a new product
 */
export const createProduct = async (
  data: CreateProductData
): Promise<ApiResponse<Product>> => {
  const response = await api.post<ApiResponse<Product>>(
    "/admin/products",
    data
  );
  return response.data;
};

/**
 * Get all products
 */
export const getProducts = async (
  params?: GetProductsParams
): Promise<ApiResponse<Product[]>> => {
  const response = await api.get<ApiResponse<Product[]>>("/admin/products", {
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
  const response = await api.get<ApiResponse<Product>>(`/admin/products/${id}`);
  return response.data;
};

/**
 * Update product
 */
export const updateProduct = async (
  id: string,
  data: Partial<CreateProductData>
): Promise<ApiResponse<Product>> => {
  const response = await api.put<ApiResponse<Product>>(
    `/admin/products/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete product
 */
export const deleteProduct = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/products/${id}`);
  return response.data;
};

/**
 * Approve/reject product request
 */
export const approveProductRequest = async (
  id: string,
  status: "Active" | "Rejected",
  rejectionReason?: string
): Promise<ApiResponse<Product>> => {
  const response = await api.patch<ApiResponse<Product>>(
    `/admin/products/${id}/approve`,
    {
      status,
      rejectionReason,
    }
  );
  return response.data;
};

/**
 * Bulk import products
 */
export const bulkImportProducts = async (
  data: BulkImportProductsData
): Promise<ApiResponse<{ success: number; failed: number; errors: any[] }>> => {
  const response = await api.post<
    ApiResponse<{ success: number; failed: number; errors: any[] }>
  >("/admin/products/bulk-import", data);
  return response.data;
};

/**
 * Bulk update products
 */
export const bulkUpdateProducts = async (
  data: BulkUpdateProductsData
): Promise<ApiResponse<{ matched: number; modified: number }>> => {
  const response = await api.put<
    ApiResponse<{ matched: number; modified: number }>
  >("/admin/products/bulk-update", data);
  return response.data;
};
