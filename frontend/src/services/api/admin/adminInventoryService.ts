/**
 * adminInventoryService.ts
 * API service for admin inventory & POS management
 */
import api from "../config";

export interface InventoryTransaction {
  _id: string;
  product: { _id: string; productName: string; mainImage?: string; sku?: string; barcode?: string };
  seller?: { _id: string; storeName?: string; sellerName?: string; email?: string } | null;
  ownerType?: "PLATFORM" | "VENDOR";
  ownerLabel?: string;
  variationId?: string;
  variationName?: string;
  type: "SALE" | "RETURN" | "ADJUSTMENT" | "STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "EXPIRED" | "TRANSFER_IN" | "TRANSFER_OUT" | "OPENING";
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: string;
  performedByRole: string;
  note?: string;
  createdAt: string;
}

export interface LowStockProduct {
  _id: string;
  productId: string;
  variationId?: string;
  productName: string;
  variationTitle?: string;
  displayName: string;
  mainImage?: string;
  stock: number;
  threshold?: number;
  sku?: string;
  barcode?: string;
  productType: string;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  ownerType?: "PLATFORM" | "VENDOR";
  ownerLabel?: string;
  seller?: { _id?: string; storeName?: string; sellerName?: string; email?: string } | null;
  category?: { _id: string; name: string };
}

export const getInventoryTransactions = async (params?: {
  productId?: string;
  type?: string;
  page?: number;
  limit?: number;
  sellerId?: string;
  ownerType?: string;
  search?: string;
}) => {
  const response = await api.get(`/admin/inventory/transactions`, {
    params,
  });
  return response.data;
};

export const getLowStockProducts = async (params?: {
  page?: number;
  limit?: number;
  ownerType?: string;
  sellerId?: string;
  status?: string;
  search?: string;
}) => {
  const response = await api.get(`/admin/inventory/low-stock`, {
    params,
  });
  return response.data;
};

export const lookupBarcode = async (barcode: string) => {
  const response = await api.get(
    `/admin/inventory/barcode/${encodeURIComponent(barcode)}`
  );
  return response.data.data;
};

export const adjustStock = async (data: {
  productId: string;
  variationId?: string;
  delta: number;
  note?: string;
}) => {
  const response = await api.post(`/admin/inventory/adjust`, data);
  return response.data.data;
};

export const recordDamage = async (data: {
  productId: string;
  variationId?: string;
  quantity: number;
  note?: string;
}) => {
  const response = await api.post(`/admin/inventory/damage`, data);
  return response.data.data;
};

export const addStock = async (data: {
  productId: string;
  variationId?: string;
  quantity: number;
  note?: string;
}) => {
  const response = await api.post(`/admin/inventory/stock-in`, data);
  return response.data.data;
};

export const sendLowStockAlertToVendor = async (data: {
  productId: string;
  variationId?: string;
}) => {
  const response = await api.post(`/admin/inventory/notify-vendor`, data);
  return response.data;
};

