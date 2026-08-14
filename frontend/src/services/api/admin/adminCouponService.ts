import api from "../config";


import { ApiResponse } from "./types";

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: "Percentage" | "Fixed";
  discountValue: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  usageLimitPerUser?: number;
  applicableTo: "All" | "Category" | "Product" | "Seller";
  applicableIds?: string[];
  createdBy: string | { firstName: string; lastName: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCouponData {
  code: string;
  description?: string;
  discountType: "Percentage" | "Fixed";
  discountValue: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  applicableTo?: "All" | "Category" | "Product" | "Seller";
  applicableIds?: string[];
}

export interface GetCouponsParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ValidateCouponData {
  code: string;
  amount: number;
  userId?: string;
}

export interface ValidateCouponResponse {
  coupon: Coupon;
  discount: number;
  finalAmount: number;
}

/**
 * Create a new coupon
 */
export const createCoupon = async (
  data: CreateCouponData
): Promise<ApiResponse<Coupon>> => {
  const response = await api.post<ApiResponse<Coupon>>("/admin/coupons", data);
  return response.data;
};

/**
 * Get all coupons
 */
export const getCoupons = async (
  params?: GetCouponsParams
): Promise<ApiResponse<Coupon[]>> => {
  const response = await api.get<ApiResponse<Coupon[]>>("/admin/coupons", {
    params,
  });
  return response.data;
};

/**
 * Get coupon by ID
 */
export const getCouponById = async (
  id: string
): Promise<ApiResponse<Coupon>> => {
  const response = await api.get<ApiResponse<Coupon>>(`/admin/coupons/${id}`);
  return response.data;
};

/**
 * Update coupon
 */
export const updateCoupon = async (
  id: string,
  data: Partial<CreateCouponData>
): Promise<ApiResponse<Coupon>> => {
  const response = await api.put<ApiResponse<Coupon>>(
    `/admin/coupons/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete coupon
 */
export const deleteCoupon = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/coupons/${id}`);
  return response.data;
};

/**
 * Validate coupon
 */
export const validateCoupon = async (
  data: ValidateCouponData
): Promise<ApiResponse<ValidateCouponResponse>> => {
  const response = await api.post<ApiResponse<ValidateCouponResponse>>(
    "/admin/coupons/validate",
    data
  );
  return response.data;
};
