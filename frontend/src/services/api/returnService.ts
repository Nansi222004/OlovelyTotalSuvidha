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
  requestType?: 'RETURN' | 'EXCHANGE';
  price: number;
  discPrice: number;
  quantity: number;
  total: number;
  status: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
  image?: string;
  returnReason?: string;
  reason?: string;
  rejectionReason?: string;
}

export interface ReturnRequestDetail {
  id: string;
  _id?: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  variantTitle: string;
  requestType?: 'RETURN' | 'EXCHANGE';
  price: number;
  discPrice: number;
  quantity: number;
  total: number;
  status: ReturnLifecycleStatus;
  financialSettlementStatus?: 'Pending' | 'Completed' | 'Failed';
  returnDate: string;
  processedDate?: string;
  reason?: string;
  reasonDescription?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  items?: Array<{
    id?: string;
    name?: string;
    sku?: string;
    price?: number;
    quantity?: number;
    total?: number;
    image?: string;
  }>;
  // Delivery partner fields
  deliveryBoy?: { _id: string; name: string; phone: string } | null;
  assignedAt?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  handedToSellerAt?: string;
  completedAt?: string;
  approvedAt?: string;
}


export interface UpdateReturnStatusData {
  status: 'Approved' | 'Rejected';
  reason?: string;
}

export type ReturnLifecycleStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Pickup Pending'
  | 'Delivery Partner Assigned'
  | 'Picked Up'
  | 'In Transit'
  | 'Handed To Seller'
  | 'Completed';

export interface GetReturnRequestsParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  requestType?: 'RETURN' | 'EXCHANGE' | 'All Types';
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

/**
 * Seller: Confirm physical receipt of returned item.
 * This is the ONLY action that triggers financial settlement.
 * Return status must be 'Handed To Seller' for this to succeed.
 */
export const confirmSellerReceipt = async (
  returnId: string
): Promise<ApiResponse<{ id: string; status: string; financialSettlementStatus: string }>> => {
  const response = await api.post<ApiResponse<{ id: string; status: string; financialSettlementStatus: string }>>(
    `/returns/${returnId}/confirm-receipt`,
    {}
  );
  return response.data;
};
