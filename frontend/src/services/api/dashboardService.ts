import api from './config';

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
    yearlyOrderData: { date: string; value: number }[];
    dailyOrderData: { date: string; value: number }[];
}

export interface NewOrder {
    id: string;
    orderDate: string;
    status: string;
    amount: number;
}

export interface DashboardResponse {
    success: boolean;
    message: string;
    data: {
        stats: DashboardStats;
        newOrders: NewOrder[];
    };
}

/**
 * Get seller's dashboard statistics
 */
export const getSellerDashboardStats = async (): Promise<DashboardResponse> => {
    const response = await api.get<DashboardResponse>('/seller/dashboard/stats');
    return response.data;
};
