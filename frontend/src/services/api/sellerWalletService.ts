import api from './config';

/**
 * Get wallet balance (for sellers)
 */
export const getSellerWalletBalance = async () => {
    try {
        const response = await api.get('/seller/wallet-new/balance');
        return response.data;
    } catch (error: any) {
        console.error('Error getting wallet balance:', error);
        throw error;
    }
};

/**
 * Get wallet transactions (for sellers)
 */
export const getSellerWalletTransactions = async (page: number = 1, limit: number = 20) => {
    try {
        const response = await api.get('/seller/wallet-new/transactions', {
            params: { page, limit },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error getting wallet transactions:', error);
        throw error;
    }
};

/**
 * Request withdrawal (for sellers)
 */
export const requestSellerWithdrawal = async (amount: number, paymentMethod: 'Bank Transfer' | 'UPI') => {
    try {
        const response = await api.post('/seller/wallet-new/withdraw', {
            amount,
            paymentMethod,
        });
        return response.data;
    } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        throw error;
    }
};

/**
 * Get withdrawal requests (for sellers)
 */
export const getSellerWithdrawals = async (status?: string) => {
    try {
        const response = await api.get('/seller/wallet-new/withdrawals', {
            params: status ? { status } : {},
        });
        return response.data;
    } catch (error: any) {
        console.error('Error getting withdrawals:', error);
        throw error;
    }
};

/**
 * Get commission earnings (for sellers)
 */
export const getSellerCommissions = async () => {
    try {
        const response = await api.get('/seller/wallet-new/commissions');
        return response.data;
    } catch (error: any) {
        console.error('Error getting commissions:', error);
        throw error;
    }
};
