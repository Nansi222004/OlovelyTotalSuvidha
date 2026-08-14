import api from './config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ReturnRequest {
  id: string;
  orderItemId: string;
  product: string;
  variant: string;
  price: number;
  discPrice: number;
  quantity: number;
  total: number;
  status: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
}

export interface ReturnRequestDetail {
  id: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  variantTitle: string;
  price: number;
  discPrice: number;
  quantity: number;
  total: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  returnDate: string;
  processedDate?: string;
  reason?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface UpdateReturnStatusData {
  status: 'Approved' | 'Rejected' | 'Completed';
}

export interface GetReturnRequestsParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
 * Get return requests with filters
 */
export const getReturnRequests = async (params?: GetReturnRequestsParams): Promise<ApiResponse<ReturnRequest[]>> => {
  const response = await api.get<ApiResponse<ReturnRequest[]>>('/returns', { params });
  return response.data;
};

/**
 * Get return request by ID
 */
export const getReturnRequestById = async (id: string): Promise<ApiResponse<ReturnRequestDetail>> => {
  const response = await api.get<ApiResponse<ReturnRequestDetail>>(`/returns/${id}`);
  return response.data;
};

/**
 * Update return request status
 */
export const updateReturnStatus = async (id: string, data: UpdateReturnStatusData): Promise<ApiResponse<{ id: string; status: string; processedDate?: string }>> => {
  const response = await api.patch<ApiResponse<{ id: string; status: string; processedDate?: string }>>(`/returns/${id}/status`, data);
  return response.data;
};
