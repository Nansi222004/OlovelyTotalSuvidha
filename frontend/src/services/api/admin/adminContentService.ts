import api from "../config";


import { ApiResponse } from "./types";

export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFAQData {
  question: string;
  answer: string;
  category?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateFAQData {
  question?: string;
  answer?: string;
  category?: string;
  isActive?: boolean;
  order?: number;
}

export interface Policy {
  _id: string;
  type: "customer" | "delivery";
  title: string;
  content: string;
  version: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePolicyData {
  type: "customer" | "delivery";
  title: string;
  content: string;
  version: string;
  isActive?: boolean;
}

export interface UpdatePolicyData {
  title?: string;
  content?: string;
  version?: string;
  isActive?: boolean;
}

export interface GetContentParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  type?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * FAQ APIs
 */
export const getFAQs = async (
  params?: GetContentParams
): Promise<ApiResponse<FAQ[]>> => {
  const response = await api.get<ApiResponse<FAQ[]>>("/admin/faqs", { params });
  return response.data;
};

export const createFAQ = async (
  data: CreateFAQData
): Promise<ApiResponse<FAQ>> => {
  const response = await api.post<ApiResponse<FAQ>>("/admin/faqs", data);
  return response.data;
};

export const updateFAQ = async (
  id: string,
  data: UpdateFAQData
): Promise<ApiResponse<FAQ>> => {
  const response = await api.put<ApiResponse<FAQ>>(`/admin/faqs/${id}`, data);
  return response.data;
};

export const deleteFAQ = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/faqs/${id}`);
  return response.data;
};


export interface ContentNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export const getContentNotifications = async (): Promise<ApiResponse<ContentNotification[]>> => {
  const response = await api.get("/admin/content/notifications");
  return response.data;
};

export const createContentNotification = async (data: any): Promise<ApiResponse<ContentNotification>> => {
  const response = await api.post("/admin/content/notifications", data);
  return response.data;
};

export const deleteContentNotification = async (id: string): Promise<ApiResponse<null>> => {
  const response = await api.delete(`/admin/content/notifications/${id}`);
  return response.data;
};

/**
 * Policy APIs
 */
export const getPolicies = async (
  params?: GetContentParams
): Promise<ApiResponse<Policy[]>> => {
  const response = await api.get<ApiResponse<Policy[]>>("/admin/policies", {
    params,
  });
  return response.data;
};

export const createPolicy = async (
  data: CreatePolicyData
): Promise<ApiResponse<Policy>> => {
  const response = await api.post<ApiResponse<Policy>>("/admin/policies", data);
  return response.data;
};

export const updatePolicy = async (
  id: string,
  data: UpdatePolicyData
): Promise<ApiResponse<Policy>> => {
  const response = await api.put<ApiResponse<Policy>>(
    `/admin/policies/${id}`,
    data
  );
  return response.data;
};

export const deletePolicy = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/policies/${id}`);
  return response.data;
};
