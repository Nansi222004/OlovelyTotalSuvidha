import api from "../config";


import { ApiResponse } from "./types";

export interface DashboardStats {
  totalUser: number;
  totalCategory: number;
  totalSubcategory: number;
  totalProduct: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  soldOutProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  avgCompletedOrderValue: number;
}

export interface SalesData {
  date: string;
  value: number;
}

export interface SalesAnalytics {
  thisPeriod: SalesData[];
  lastPeriod: SalesData[];
}

export interface TopSeller {
  sellerId: string;
  sellerName: string;
  storeName: string;
  totalRevenue: number;
  totalOrders: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  status: string;
  amount: number;
  deliveryBoy?: {
    name: string;
    mobile: string;
  } | null;
}

export interface SalesByLocation {
  location: string;
  amount: number;
}

export interface TodaySales {
  salesToday: number;
  salesLastWeekSameDay: number;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<
  ApiResponse<DashboardStats>
> => {
  const response = await api.get<ApiResponse<DashboardStats>>(
    "/admin/dashboard/stats"
  );
  return response.data;
};

/**
 * Get sales analytics
 */
export const getSalesAnalytics = async (
  period?: "day" | "week" | "month" | "year"
): Promise<ApiResponse<SalesAnalytics>> => {
  const response = await api.get<ApiResponse<SalesAnalytics>>(
    "/admin/dashboard/analytics",
    {
      params: { period },
    }
  );
  return response.data;
};

/**
 * Get top sellers
 */
export const getTopSellers = async (
  limit?: number
): Promise<ApiResponse<TopSeller[]>> => {
  const response = await api.get<ApiResponse<TopSeller[]>>(
    "/admin/dashboard/top-sellers",
    {
      params: { limit },
    }
  );
  return response.data;
};

/**
 * Get recent orders
 */
export const getRecentOrders = async (
  limit?: number
): Promise<ApiResponse<RecentOrder[]>> => {
  const response = await api.get<ApiResponse<RecentOrder[]>>(
    "/admin/dashboard/recent-orders",
    {
      params: { limit },
    }
  );
  return response.data;
};

/**
 * Get sales by location
 */
export const getSalesByLocation = async (): Promise<
  ApiResponse<SalesByLocation[]>
> => {
  const response = await api.get<ApiResponse<SalesByLocation[]>>(
    "/admin/dashboard/sales-by-location"
  );
  return response.data;
};

/**
 * Get today's sales
 */
export const getTodaySales = async (): Promise<ApiResponse<TodaySales>> => {
  const response = await api.get<ApiResponse<TodaySales>>(
    "/admin/dashboard/today-sales"
  );
  return response.data;
};

/**
 * Get order analytics
 */
export const getOrderAnalytics = async (
  period?: "day" | "month"
): Promise<ApiResponse<SalesAnalytics>> => {
  const response = await api.get<ApiResponse<SalesAnalytics>>(
    "/admin/dashboard/order-analytics",
    {
      params: { period },
    }
  );
  return response.data;
};