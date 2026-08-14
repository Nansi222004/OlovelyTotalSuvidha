import api from './config';

export interface WalletStats {
    availableBalance: number;
    totalEarnings: number;
    pendingSettlement: number;
    totalWithdrawn: number;
}

export interface WalletTransaction {
    _id: string;
    amount: number;
    type: 'Credit' | 'Debit';
    description: string;
    status: 'Completed' | 'Pending' | 'Failed';
    reference: string;
    createdAt: string;
}

export interface WithdrawRequest {
    _id: string;
    amount: number;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    paymentMethod: string;
    accountDetails: string;
    remarks?: string;
    createdAt: string;
}

export interface OrderEarning {
    id: string;
    orderId: string;
    source: string;
    amount: number;
    commission: number;
    netEarning: number;
    date: string;
    status: 'Settled' | 'Pending';
}

/**
 * Get seller wallet stats
 */
export const getWalletStats = async (): Promise<any> => {
    const response = await api.get('/seller/wallet/stats');
    return response.data;
};

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (params: any): Promise<any> => {
    const response = await api.get('/seller/wallet/transactions', { params });
    return response.data;
};

/**
 * Get withdrawal requests
 */
export const getWithdrawalRequests = async (params: any): Promise<any> => {
    const response = await api.get('/seller/wallet/withdrawals', { params });
    return response.data;
};

/**
 * Create withdrawal request
 */
export const createWithdrawalRequest = async (data: any): Promise<any> => {
    const response = await api.post('/seller/wallet/withdrawals', data);
    return response.data;
};

/**
 * Get order earnings
 */
export const getOrderEarnings = async (params: any): Promise<any> => {
    const response = await api.get('/seller/wallet/earnings', { params });
    return response.data;
};
