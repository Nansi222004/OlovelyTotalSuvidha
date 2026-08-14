import api from "../config";


import { ApiResponse } from "./types";

export interface Tax {
  _id: string;
  name: string;
  percentage: number;
  status: "Active" | "Inactive";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTaxData {
  name: string;
  percentage: number;
}

export interface UpdateTaxData {
  name?: string;
  percentage?: number;
  status?: "Active" | "Inactive";
}

export interface GetTaxesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Create a new tax
 */
export const createTax = async (
  data: CreateTaxData
): Promise<ApiResponse<Tax>> => {
  const response = await api.post<ApiResponse<Tax>>("/admin/taxes", data);
  return response.data;
};

/**
 * Get all taxes
 */
export const getTaxes = async (
  params?: GetTaxesParams
): Promise<ApiResponse<Tax[]>> => {
  const response = await api.get<ApiResponse<Tax[]>>("/admin/taxes", {
    params,
  });
  return response.data;
};

/**
 * Get tax by ID
 */
export const getTaxById = async (id: string): Promise<ApiResponse<Tax>> => {
  const response = await api.get<ApiResponse<Tax>>(`/admin/taxes/${id}`);
  return response.data;
};

/**
 * Update tax
 */
export const updateTax = async (
  id: string,
  data: UpdateTaxData
): Promise<ApiResponse<Tax>> => {
  const response = await api.put<ApiResponse<Tax>>(`/admin/taxes/${id}`, data);
  return response.data;
};

/**
 * Delete tax
 */
export const deleteTax = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/taxes/${id}`);
  return response.data;
};

/**
 * Update tax status
 */
export const updateTaxStatus = async (
  id: string,
  status: "Active" | "Inactive"
): Promise<ApiResponse<Tax>> => {
  const response = await api.patch<ApiResponse<Tax>>(
    `/admin/taxes/${id}/status`,
    { status }
  );
  return response.data;
};
