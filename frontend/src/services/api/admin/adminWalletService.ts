import api from "../config";
import { ApiResponse } from "./types";

// TYPES

export interface WalletStats {
  totalGMV: number;
  currentAccountBalance: number;
  totalAdminEarnings: number;
  sellerPendingPayouts: number;
  deliveryPendingPayouts: number;
  pendingAmountFromDeliveryBoy: number;
  pendingWithdrawalsCount?: number;
}

export interface WalletTransaction {
  _id: string; // Mongoose ID
  type: string; // Credit/Debit
  userType: string;
  userName?: string;
  amount: number;
  description: string;
  status: string;
  reference: string;
  createdAt: string;
  relatedOrder?: { orderNumber: string };
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  requestDate: string;
  status: "Pending" | "Approved" | "Rejected";
  paymentMethod: string;
  accountDetails: string;
  remark?: string;
  transactionReference?: string;
}

export interface AdminEarning {
  id: string;
  source: string;
  amount: number;
  date: string;
  status: string;
  description: string;
}

export interface SellerTransaction {
  id: string;
  amount: number;
  transactionType: string;
  date: string;
  type: string;
  status: string;
  description: string;
}

export interface WalletSummaryUser {
  _id: string;
  name: string;
  mobile: string;
  balance: number;
  cashCollected: number;
  profileImage?: string;
}

// API METHODS

/**
 * Get Wallet Summary (balances) for all Delivery Boys
 */
export const getWalletSummary = async (): Promise<ApiResponse<WalletSummaryUser[]>> => {
  const response = await api.get<ApiResponse<WalletSummaryUser[]>>("/admin/wallet/summary");
  return response.data;
};

/**
 * Create Manual Transfer
 */
export const createManualTransfer = async (data: {
  userId: string;
  userType: 'DELIVERY_BOY' | 'SELLER';
  amount: number;
  type: 'Credit' | 'Debit';
  description: string;
}): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>("/admin/wallet/transfer", data);
  return response.data;
};

/**
 * Get Financial Dashboard Stats
 */
export const getFinancialDashboard = async (): Promise<
  ApiResponse<WalletStats>
> => {
  const response = await api.get<ApiResponse<WalletStats>>(
    "/admin/financial/dashboard",
  );
  return response.data;
};

/**
 * Get Admin Earnings (Commissions)
 */
export const getAdminEarnings = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ApiResponse<AdminEarning[]>> => {
  const response = await api.get<ApiResponse<AdminEarning[]>>(
    "/admin/wallet/earnings",
    { params },
  );
  return response.data;
};

/**
 * Get Wallet Transactions (Platform Level)
 */
export const getWalletTransactions = async (params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  userType?: string;
  userId?: string;
}): Promise<ApiResponse<WalletTransaction[]>> => {
  const response = await api.get<ApiResponse<WalletTransaction[]>>(
    "/admin/wallet/transactions",
    { params },
  );
  return response.data;
};

/**
 * Get Withdrawal Requests
 */
export const getWithdrawalRequests = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<
  ApiResponse<{ requests: WithdrawalRequest[]; pagination: any }>
> => {
  const response = await api.get<
    ApiResponse<{ requests: WithdrawalRequest[]; pagination: any }>
  >("/admin/wallet/withdrawals", { params });
  return response.data;
};

/**
 * Process Withdrawal (Approve/Reject/Complete)
 */
export const processWithdrawal = async (data: {
  requestId: string;
  action: "Approve" | "Reject" | "Complete";
  remark?: string;
  transactionReference?: string;
}): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>(
    "/admin/wallet/withdrawal/process",
    data,
  );
  return response.data;
};

// Legacy / Other Helpers
export const getSellerTransactions = async (
  sellerId: string,
  params?: { page?: number; limit?: number },
): Promise<ApiResponse<any[]>> => {
  const response = await api.get<ApiResponse<any[]>>(
    `/admin/wallet/seller/${sellerId}`,
    { params },
  );
  return response.data;
};
