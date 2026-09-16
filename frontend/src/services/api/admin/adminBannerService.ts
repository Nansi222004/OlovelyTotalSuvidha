/**
 * adminBannerService.ts
 * API service for admin banner management
 */
import api from "../config";

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  commerceSection: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL";
  targetType: "NONE" | "CATEGORY" | "PRODUCT" | "URL";
  targetId?: string;
  ctaText?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface BannerFormData {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  commerceSection: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL";
  targetType: "NONE" | "CATEGORY" | "PRODUCT" | "URL";
  targetId?: string;
  ctaText?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  priority: number;
}

export const getBanners = async (params?: {
  section?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) => {
  const response = await api.get(`/admin/banners`, {
    params,
  });
  return response.data;
};

export const createBanner = async (data: BannerFormData): Promise<Banner> => {
  const response = await api.post(`/admin/banners`, data);
  return response.data.data;
};

export const updateBanner = async (id: string, data: Partial<BannerFormData>): Promise<Banner> => {
  const response = await api.put(`/admin/banners/${id}`, data);
  return response.data.data;
};

export const toggleBanner = async (id: string): Promise<Banner> => {
  const response = await api.patch(`/admin/banners/${id}/toggle`, {});
  return response.data.data;
};

export const deleteBanner = async (id: string): Promise<void> => {
  await api.delete(`/admin/banners/${id}`);
};
