import api from "./config";
import { apiCache } from "../../utils/apiCache";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Category {
  _id: string;
  name: string;
  image?: string;
  parentId?: string;
  headerCategoryId?: string | any; // Can be string ID or populated object
  isBestseller: boolean;
  hasWarning: boolean;
  groupCategory?: string;
  totalSubcategory?: number;
  totalProduct?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubCategory {
  _id: string;
  id?: string;
  categoryName: string;
  subcategoryName: string;
  subcategoryImage?: string;
  totalProduct?: number;
  parentId?: string;
}

export interface SubSubCategory {
  _id: string;
  name: string;
  subCategory: string;
  image?: string;
  order: number;
  isActive: boolean;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: SubCategory[];
}

export interface GetCategoriesParams {
  includeSubcategories?: boolean;
  search?: string;
}

export interface GetSubcategoriesParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Get all categories (parent categories only by default)
 * Cached for 10 minutes as categories don't change frequently
 */
export const getCategories = async (
  params?: GetCategoriesParams
): Promise<ApiResponse<Category[]>> => {
  const cacheKey = `categories-${JSON.stringify(params || {})}`;
  return apiCache.getOrFetch(
    cacheKey,
    async () => {
      const response = await api.get<ApiResponse<Category[]>>("/categories", {
        params,
      });
      return response.data;
    },
    10 * 60 * 1000 // 10 minutes cache
  );
};

/**
 * Get category by ID
 */
export const getCategoryById = async (
  id: string
): Promise<ApiResponse<Category>> => {
  const response = await api.get<ApiResponse<Category>>(`/categories/${id}`);
  return response.data;
};

/**
 * Get subcategories by parent category ID
 */
export const getSubcategories = async (
  categoryId: string,
  params?: GetSubcategoriesParams
): Promise<ApiResponse<SubCategory[]>> => {
  const response = await api.get<ApiResponse<SubCategory[]>>(
    `/categories/${categoryId}/subcategories`,
    { params }
  );
  return response.data;
};

/**
 * Get sub-subcategories by subcategory ID
 */
export const getSubSubCategories = async (
  subCategoryId: string,
  params?: { search?: string; isActive?: boolean }
): Promise<ApiResponse<SubSubCategory[]>> => {
  const response = await api.get<ApiResponse<SubSubCategory[]>>(
    `/categories/${subCategoryId}/sub-subcategories`,
    { params }
  );
  return response.data;
};

/**
 * Get all subcategories (across all categories)
 */
export const getAllSubcategories = async (
  params?: GetSubcategoriesParams
): Promise<ApiResponse<SubCategory[]>> => {
  const response = await api.get<ApiResponse<SubCategory[]>>(
    "/categories/subcategories",
    { params }
  );
  return response.data;
};

/**
 * Get all categories with nested subcategories
 */
export const getAllCategoriesWithSubcategories = async (): Promise<
  ApiResponse<CategoryWithSubcategories[]>
> => {
  const response = await api.get<ApiResponse<CategoryWithSubcategories[]>>(
    "/categories/all-with-subcategories"
  );
  return response.data;
};
