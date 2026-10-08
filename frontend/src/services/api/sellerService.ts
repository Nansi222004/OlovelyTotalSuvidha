import api from "./config";
import { apiCache } from "../../utils/apiCache";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pickupProvisioning?: {
    required: boolean;
    status: "NOT_REQUIRED" | "PENDING" | "PROVISIONING" | "ACTIVE" | "FAILED";
    message: string;
  };
}

export interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  mobile: string;
  email: string;
  logo?: string;
  balance: number;
  commission: number;
  categories: string[];
  categoryCommissions?: Array<{
    headerCategory: string;
    commissionRate: number;
  }>;
  status: "Approved" | "Pending" | "Rejected";
  category?: string;
  address?: string;
  city?: string;
  serviceableArea?: string;
  panCard?: string;
  taxName?: string;
  taxNumber?: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  serviceRadiusKm?: number;
  accountName?: string;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  ifsc?: string;
  profile?: string;
  idProof?: string;
  addressProof?: string;
  requireProductApproval?: boolean;
  viewCustomerDetails?: boolean;
  vendorType?: "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID";
  wholesaleEnabled?: boolean;
  shippingConfig?: {
    warehouseAddress?: string;
    pickupAddress?: string;
    pickupPincode?: string;
    pickupCity?: string;
    pickupState?: string;
    returnAddress?: string;
    defaultCourier?: string;
    freeShippingThreshold?: number;
    flatShippingFee?: number;
    shiprocketPickupLocationId?: string;
    shiprocketPickupLocationName?: string;
    shiprocketPickupStatus?: "NOT_REQUIRED" | "PENDING" | "PROVISIONING" | "ACTIVE" | "FAILED" | "RETIRING" | "RETRY_PENDING" | "RETIRED";
    shiprocketPickupLastError?: string;
    shiprocketPickupAddressFingerprint?: string;
    shiprocketPickupLastSyncedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface GetAllSellersParams {
  status?: "Approved" | "Pending" | "Rejected";
  search?: string;
}

export type SellerSuggestion = Pick<
  Seller,
  "_id" | "sellerName" | "storeName" | "email" | "mobile" | "profile" | "logo" | "status" | "vendorType"
>;

export interface CreateSellerData {
  sellerName: string;
  storeName: string;
  email: string;
  mobile: string;
  password: string;
  category: string;
  address?: string;
  city: string;
  serviceableArea: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  serviceRadiusKm?: number;
  panCard?: string;
  taxName?: string;
  taxNumber?: string;
  accountName?: string;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  ifsc?: string;
  profile?: string;
  idProof?: string;
  addressProof?: string;
  requireProductApproval: boolean;
  viewCustomerDetails: boolean;
  commission: number;
}

/**
 * Create a new seller
 */
export const createSeller = async (
  data: CreateSellerData
): Promise<ApiResponse<Seller>> => {
  const response = await api.post<ApiResponse<Seller>>("/sellers", data);
  return response.data;
};

/**
 * Get all sellers
 */
export const getAllSellers = async (
  params?: GetAllSellersParams
): Promise<ApiResponse<Seller[]>> => {
  const response = await api.get<ApiResponse<Seller[]>>("/sellers", { params });
  return response.data;
};

export const getSellerSuggestions = async (
  query: string,
  limit = 8
): Promise<ApiResponse<SellerSuggestion[]>> => {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length < 2) {
    return { success: true, message: "", data: [] };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 10);
  return apiCache.getOrFetch(
    `seller-sugg-v1-${cleanQuery}-${safeLimit}`,
    async () => {
      const response = await api.get<ApiResponse<SellerSuggestion[]>>("/sellers/suggestions", {
        params: { q: query.trim(), limit: safeLimit },
      });
      return response.data;
    },
    30 * 1000
  );
};

/**
 * Get seller by ID
 */
export const getSellerById = async (
  id: string
): Promise<ApiResponse<Seller>> => {
  const response = await api.get<ApiResponse<Seller>>(`/sellers/${id}`);
  return response.data;
};

/**
 * Update seller status
 */
export const updateSellerStatus = async (
  id: string,
  status: "Approved" | "Pending" | "Rejected"
): Promise<ApiResponse<Seller>> => {
  const response = await api.patch<ApiResponse<Seller>>(
    `/sellers/${id}/status`,
    { status }
  );
  return response.data;
};

export const retrySellerPickupProvisioning = async (
  id: string
): Promise<ApiResponse<Seller>> => {
  const response = await api.post<ApiResponse<Seller>>(`/sellers/${id}/courier-pickup/retry`);
  return response.data;
};

/**
 * Update seller details
 */
export const updateSeller = async (
  id: string,
  data: Partial<Seller>
): Promise<ApiResponse<Seller>> => {
  const response = await api.put<ApiResponse<Seller>>(`/sellers/${id}`, data);
  return response.data;
};

/**
 * Delete seller
 */
export const deleteSeller = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete<ApiResponse<void>>(`/sellers/${id}`);
  return response.data;
};

/**
 * Update seller category commissions (Admin only)
 */
export const updateSellerCategoryCommissions = async (
  sellerId: string,
  categoryCommissions: Array<{ headerCategory: string; commissionRate: number }>
): Promise<ApiResponse<Seller>> => {
  const response = await api.put<ApiResponse<Seller>>(
    `/sellers/${sellerId}/category-commissions`,
    { categoryCommissions }
  );
  return response.data;
};

