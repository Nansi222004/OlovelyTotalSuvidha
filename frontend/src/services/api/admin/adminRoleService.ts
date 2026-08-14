import api from "../config";


import { ApiResponse } from "./types";

export interface Role {
  _id: string;
  name: string;
  type: "System" | "Custom";
  permissions: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRoleData {
  name: string;
  permissions?: string[];
  description?: string;
}

export interface UpdateRoleData {
  name?: string;
  permissions?: string[];
  description?: string;
}

export interface GetRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "System" | "Custom";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Get all roles
 */
export const getRoles = async (
  params?: GetRolesParams
): Promise<ApiResponse<Role[]>> => {
  const response = await api.get<ApiResponse<Role[]>>("/admin/roles", {
    params,
  });
  return response.data;
};

/**
 * Get role by ID
 */
export const getRoleById = async (id: string): Promise<ApiResponse<Role>> => {
  const response = await api.get<ApiResponse<Role>>(`/admin/roles/${id}`);
  return response.data;
};

/**
 * Create a new role
 */
export const createRole = async (
  data: CreateRoleData
): Promise<ApiResponse<Role>> => {
  const response = await api.post<ApiResponse<Role>>("/admin/roles", data);
  return response.data;
};

/**
 * Update role
 */
export const updateRole = async (
  id: string,
  data: UpdateRoleData
): Promise<ApiResponse<Role>> => {
  const response = await api.put<ApiResponse<Role>>(`/admin/roles/${id}`, data);
  return response.data;
};

/**
 * Delete role (only custom roles can be deleted)
 */
export const deleteRole = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/admin/roles/${id}`);
  return response.data;
};

/**
 * Get role permissions
 */
export const getRolePermissions = async (): Promise<ApiResponse<string[]>> => {
  const response = await api.get<ApiResponse<string[]>>(
    "/admin/roles/permissions"
  );
  return response.data;
};
