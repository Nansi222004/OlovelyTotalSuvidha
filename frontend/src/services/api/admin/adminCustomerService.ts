import api from "../config";


import { ApiResponse } from "./types";

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  registrationDate: string;
  status: "Active" | "Inactive";
  refCode: string;
  walletAmount: number;
  totalOrders: number;
  totalSpent: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  locationUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetCustomersParams {
  page?: number;
  limit?: number;
  status?: "Active" | "Inactive";
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UpdateCustomerStatusData {
  status: "Active" | "Inactive";
}

export interface CustomerOrder {
  _id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  total: number;
  items: any[];
  deliveryBoy?: any;
}

/**
 * Get all customers
 */
export const getAllCustomers = async (
  params?: GetCustomersParams
): Promise<ApiResponse<Customer[]>> => {
  const response = await api.get<ApiResponse<Customer[]>>("/admin/customers", {
    params,
  });
  return response.data;
};

/**
 * Get customer by ID
 */
export const getCustomerById = async (
  id: string
): Promise<ApiResponse<Customer>> => {
  const response = await api.get<ApiResponse<Customer>>(
    `/admin/customers/${id}`
  );
  return response.data;
};

/**
 * Update customer status
 */
export const updateCustomerStatus = async (
  id: string,
  data: UpdateCustomerStatusData
): Promise<ApiResponse<Customer>> => {
  const response = await api.patch<ApiResponse<Customer>>(
    `/admin/customers/${id}/status`,
    data
  );
  return response.data;
};

/**
 * Get customer orders
 */
export const getCustomerOrders = async (
  id: string,
  params?: { page?: number; limit?: number; status?: string }
): Promise<ApiResponse<CustomerOrder[]>> => {
  const response = await api.get<ApiResponse<CustomerOrder[]>>(
    `/admin/customers/${id}/orders`,
    {
      params,
    }
  );
  return response.data;
};

