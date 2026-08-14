import api from "../config";


import { ApiResponse } from "./types";

export interface PaymentMethod {
  _id: string;
  name: string;
  type: "COD" | "Online" | "Wallet" | "UPI" | "Card" | "Net Banking";
  isActive: boolean;
  icon?: string;
  description?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SMSGatewaySettings {
  provider: string;
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  enabled: boolean;
}

export interface PaymentMethods {
  cod: boolean;
  online: boolean;
  wallet: boolean;
  upi: boolean;
}

export interface PaymentGateways {
  razorpay?: {
    enabled: boolean;
    keyId?: string;
    keySecret?: string;
  };
  stripe?: {
    enabled: boolean;
    publishableKey?: string;
    secretKey?: string;
  };
}

export interface HomeSection {
  title: string;
  category?: string;
  subcategory?: string;
  city?: string;
  deliverableArea?: string;
  status: string;
  productSortBy?: string;
  productLimit?: number;
  order: number;
}

export interface AppSettings {
  _id: string;
  appName: string;
  appLogo?: string;
  appFavicon?: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyPincode?: string;
  companyCountry?: string;
  paymentMethods: PaymentMethods;
  paymentGateways?: PaymentGateways;
  smsGateway?: SMSGatewaySettings;
  defaultCommission: number;
  deliveryCharges: number;
  platformFee?: number;
  freeDeliveryThreshold?: number;
  minimumOrderValue?: number;
  deliveryConfig?: {
    isDistanceBased: boolean;
    googleMapsKey?: string;
    baseCharge: number;
    baseDistance: number;
    kmRate: number;
    deliveryBoyKmRate?: number;
  };
  gstEnabled: boolean;
  gstRate?: number;
  privacyPolicy?: string;
  termsOfService?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  customerAppPolicy?: string;
  deliveryAppPolicy?: string;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  homeSections?: HomeSection[];
  features: {
    sellerRegistration: boolean;
    productApproval: boolean;
    orderTracking: boolean;
    wallet: boolean;
    coupons: boolean;
    showSellerDetails: boolean;
  };
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateAppSettingsData extends Partial<AppSettings> { }

export interface UpdatePaymentMethodsData {
  paymentMethods: PaymentMethod[];
}

export interface UpdateSMSGatewaySettingsData {
  smsGateway: SMSGatewaySettings;
}

/**
 * Get app settings
 */
export const getAppSettings = async (): Promise<ApiResponse<AppSettings>> => {
  const response = await api.get<ApiResponse<AppSettings>>("/admin/settings");
  return response.data;
};

/**
 * Update app settings
 */
export const updateAppSettings = async (
  data: UpdateAppSettingsData
): Promise<ApiResponse<AppSettings>> => {
  const response = await api.put<ApiResponse<AppSettings>>(
    "/admin/settings",
    data
  );
  return response.data;
};

/**
 * Get payment methods
 */
export const getPaymentMethods = async (): Promise<
  ApiResponse<PaymentMethod[]>
> => {
  const response = await api.get<ApiResponse<PaymentMethod[]>>(
    "/admin/settings/payment-methods"
  );
  return response.data;
};

/**
 * Update payment methods
 */
export const updatePaymentMethods = async (
  data: UpdatePaymentMethodsData
): Promise<ApiResponse<PaymentMethod[]>> => {
  const response = await api.put<ApiResponse<PaymentMethod[]>>(
    "/admin/settings/payment-methods",
    data
  );
  return response.data;
};

/**
 * Get SMS gateway settings
 */
export const getSMSGatewaySettings = async (): Promise<
  ApiResponse<SMSGatewaySettings | null>
> => {
  const response = await api.get<ApiResponse<SMSGatewaySettings | null>>(
    "/admin/settings/sms-gateway"
  );
  return response.data;
};

/**
 * Update SMS gateway settings
 */
export const updateSMSGatewaySettings = async (
  data: UpdateSMSGatewaySettingsData
): Promise<ApiResponse<SMSGatewaySettings>> => {
  const response = await api.put<ApiResponse<SMSGatewaySettings>>(
    "/admin/settings/sms-gateway",
    data
  );
  return response.data;
};
