import api from './config';

export const getCustomerWalletBalance = async () => {
  const response = await api.get('/customer/wallet/balance');
  return response.data;
};

export const getCustomerWalletTransactions = async (page = 1, limit = 20) => {
  const response = await api.get('/customer/wallet/transactions', {
    params: { page, limit },
  });
  return response.data;
};
