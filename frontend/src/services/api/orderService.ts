import api from './config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Order {
  id: string;
  orderId: string;
  deliveryDate: string;
  orderDate: string;
  status: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  deliveryBoyName?: string;
  deliveryBoyPhone?: string;
  paymentMethod?: string;
}

export interface OrderItem {
  srNo: string;
  product: string;
  soldBy: string;
  unit: string;
  price: number;
  tax: number;
  taxPercent: number;
  qty: number;
  subtotal: number;
}

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
}

export interface OrderDetail {
  id: string;
  invoiceNumber: string;
  orderDate: string;
  deliveryDate: string;
  timeSlot: string;
  status: 'Out For Delivery' | 'Received' | 'Payment Pending' | 'Cancelled' | 'Rejected';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryBoyName: string;
  deliveryBoyPhone: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: DeliveryAddress;
  deliveryOption?: 'Instant' | 'Standard';
}

export interface UpdateOrderStatusData {
  status: 'Accepted' | 'On the way' | 'Delivered' | 'Cancelled' | 'Rejected';
  deliveryPreference?: 'Self' | 'Admin';
}

export interface GetOrdersParams {
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
 * Get orders with filters
 */
export const getOrders = async (params?: GetOrdersParams): Promise<ApiResponse<Order[]>> => {
  const response = await api.get<ApiResponse<Order[]>>('/orders', { params });
  return response.data;
};

/**
 * Get pending order alerts that require seller action (persists across refresh).
 */
export const getPendingOrderAlerts = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get('/orders/pending-alerts');
  return response.data;
};

/**
 * Get order by ID
 */
export const getOrderById = async (id: string): Promise<ApiResponse<OrderDetail>> => {
  const response = await api.get<ApiResponse<OrderDetail>>(`/orders/${id}`);
  return response.data;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (id: string, data: UpdateOrderStatusData): Promise<ApiResponse<{ id: string; status: string }>> => {
  const response = await api.patch<ApiResponse<{ id: string; status: string }>>(`/orders/${id}/status`, data);
  return response.data;
};

/**
 * COD breakdown for seller (admin share to pay, your earning, Self Assign note)
 */
export interface SellerCODBreakdown {
  orderId: string;
  orderNumber: string;
  adminProductCommission: number;
  platformFee: number;
  totalDeliveryCharge: number;
  deliveryBoyCommission: number;
  isSelfAssign?: boolean;
  totalAdminEarning: number;
  yourEarning: number;
  note?: string;
}

export const getOrderCODBreakdown = async (id: string): Promise<ApiResponse<SellerCODBreakdown>> => {
  const response = await api.get<ApiResponse<SellerCODBreakdown>>(`/orders/${id}/cod-breakdown`);
  return response.data;
};

/** Earning breakdown for any order (COD or Online): your earning, admin commission, delivery (Self = you get delivery) */
export interface SellerEarningBreakdown {
  orderId: string;
  orderNumber: string;
  adminProductCommission: number;
  platformFee: number;
  totalDeliveryCharge: number;
  deliveryBoyCommission: number;
  isSelfAssign?: boolean;
  totalAdminEarning: number;
  yourEarning: number;
  note?: string;
}

export const getOrderEarningBreakdown = async (id: string): Promise<ApiResponse<SellerEarningBreakdown>> => {
  const response = await api.get<ApiResponse<SellerEarningBreakdown>>(`/orders/${id}/earning-breakdown`);
  return response.data;
};

/** Settlement page: list of seller's orders with breakdown */
export interface SettlementOrderItem {
  order: {
    _id: string;
    orderNumber: string;
    orderDate: string;
    paymentMethod: string;
    total: number;
    shipping?: number;
    deliveryPreference?: string;
    status: string;
  };
  codBreakdown: SellerCODBreakdown | null;
}

export const getSettlementOrders = async (params?: {
  page?: number;
  limit?: number;
  paymentMethod?: string;
  settlementStatus?: 'pending' | 'settled' | 'all';
}): Promise<
  ApiResponse<{
    orders: SettlementOrderItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>
> => {
  const response = await api.get("/orders/settlement", { params });
  return response.data;
};

/** Seller marks COD as paid to admin (order leaves pending settlement list) */
export const markOrderCODPaid = async (orderId: string): Promise<ApiResponse<{ orderId: string; codPaidToAdminAt: string }>> => {
  const response = await api.patch<ApiResponse<{ orderId: string; codPaidToAdminAt: string }>>(`/orders/${orderId}/mark-cod-paid`);
  return response.data;
};
