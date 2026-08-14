// Common types for the application

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
}

// Model Types
export type AdminRole = 'Super Admin' | 'Admin';

export type SellerStatus = 'Approved' | 'Pending' | 'Rejected';

export type CustomerStatus = 'Active' | 'Inactive';

// Re-export model interfaces
export type { IAdmin } from '../models/Admin';
export type { ISeller } from '../models/Seller';
export type { ICustomer } from '../models/Customer';







