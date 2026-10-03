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

export interface PosSearchResult {
  _id: string;
  productId?: string;
  productName: string;
  mainImage?: string;
  price?: number;
  stock?: number;
  sku?: string;
  barcode?: string;
  hsnCode?: string;
  taxRate: number;
  ownerType: "PLATFORM";
  isPlatform: true;
  hasVariations?: boolean;
  variationId?: string;
  variationTitle?: string;
  variation?: {
    _id: string;
    title?: string;
    name: string;
    value: string;
    price: number;
    stock: number;
    sku?: string;
    barcode?: string;
  };
}

export const searchPosProducts = async (query: string, limit = 12): Promise<PosSearchResult[]> => {
  const response = await api.get(`/admin/inventory/pos-search`, {
    params: { q: query, limit },
  });
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

export interface PosCheckoutItemInput {
  productId: string;
  variationId?: string;
  quantity: number;
}

export interface PosCheckoutPayload {
  items: PosCheckoutItemInput[];
  customer?: {
    customerId?: string;
    name?: string;
    phone?: string;
    email?: string;
    state?: string;
    stateCode?: string;
    isWalkIn?: boolean;
  };
  payment?: {
    method: "Cash" | "Card" | "UPI" | "Wallet" | "Other";
    amountPaid?: number;
    changeReturned?: number;
  };
  discount?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface PosCheckoutResponse {
  success: boolean;
  message: string;
  data: {
    order: any;
    items: Array<{
      id: string;
      productName: string;
      variantTitle?: string;
      sku?: string;
      hsnCode?: string;
      quantity: number;
      unitPrice: number;
      total: number;
      taxRate: number;
      taxAmount: number;
    }>;
    business: {
      businessName: string;
      businessAddress: string;
      companyCity: string;
      companyState: string;
      companyPincode: string;
      gstin: string;
      stateCode: string;
      contactPhone: string;
      contactEmail: string;
      gstEnabled: boolean;
      gstInvoiceReady: boolean;
    };
    taxSummary: {
      subtotal: number;
      taxableAmount: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
      discount: number;
      grandTotal: number;
      taxModel: "INTRA_STATE" | "INTER_STATE" | "NONE";
      businessState: string;
      businessStateCode: string;
      customerState: string;
      customerStateCode: string;
    };
    paymentSummary: {
      method: string;
      amountPaid: number;
      changeReturned: number;
    };
    customer: {
      id: string;
      name: string;
      phone: string;
      isWalkIn: boolean;
      state: string;
      stateCode: string;
    };
  };
}

export const posCheckout = async (data: PosCheckoutPayload): Promise<PosCheckoutResponse> => {
  const response = await api.post(`/admin/inventory/pos-checkout`, data);
  return response.data;
};
