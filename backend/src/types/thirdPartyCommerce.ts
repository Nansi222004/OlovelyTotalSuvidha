/**
 * Type Foundation for Third-Party Commerce & Shipping Providers
 *
 * Provides a provider-agnostic abstraction for Ecommerce shipping operations
 * (Shiprocket, Delhivery, Mock provider, etc.).
 */

export interface ExternalProductData {
  externalSku: string;
  title: string;
  description?: string;
  images?: string[];
  mrp?: number;
  price: number;
  stock: number;
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
}

export interface PincodeCheckResult {
  pincode: string;
  isServiceable: boolean;
  estimatedDeliveryDays?: number;
  shippingFee?: number;
  courierName?: string;
}

export interface ShipmentItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  weightKg?: number;
}

export interface ShipmentRequest {
  idempotencyKey: string;
  orderId: string;
  fulfillmentGroupId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod?: string;
  shippingAddress: {
    address: string;
    city: string;
    state?: string;
    pincode: string;
    landmark?: string;
  };
  pickupDetails?: {
    sellerId: string;
    sellerName: string;
    pickupAddress: string;
    pickupPincode: string;
    pickupLocationName?: string;
  };
  items: ShipmentItem[];
  subtotal: number;
  totalWeightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
}

export interface ExternalOrderResult {
  externalOrderId: string;
  shipmentId?: string;
  awbNumber?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: string;
  labelUrl?: string;
  rawResponse?: any;
}

export interface TrackingMilestone {
  status: string;
  description?: string;
  location?: string;
  timestamp: Date;
}

export interface ExternalTrackingResult {
  carrier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  status: string;
  milestones: TrackingMilestone[];
}

export interface ReturnRequest {
  orderId: string;
  fulfillmentGroupId?: string;
  returnId: string;
  item: {
    productId: string;
    productName: string;
    quantity: number;
  };
  pickupAddress: {
    address: string;
    city: string;
    state?: string;
    pincode: string;
  };
  destinationAddress?: {
    address: string;
    pincode: string;
  };
  reason: string;
}

export interface ExternalReturnResult {
  returnId: string;
  returnAwbNumber: string;
  carrier: string;
  status: string;
  estimatedPickupDate?: Date;
}

export interface WebhookProcessResult {
  handled: boolean;
  orderId?: string;
  fulfillmentGroupId?: string;
  awbNumber?: string;
  statusUpdate?: string;
  milestone?: TrackingMilestone;
  ignoredReason?: string;
}

export interface IThirdPartyCommerceProvider {
  readonly providerId: string;
  readonly providerName: string;

  // Catalog & Inventory Verification
  fetchProductDetails?(externalSku: string): Promise<ExternalProductData>;
  checkRealtimeStock?(skus: string[]): Promise<Map<string, number>>;
  checkPincodeServiceability(pincode: string, options?: { weightKg?: number }): Promise<PincodeCheckResult>;

  // Shipment Execution & Tracking
  createShipment(request: ShipmentRequest): Promise<ExternalOrderResult>;
  getTrackingDetails(trackingNumberOrAwb: string): Promise<ExternalTrackingResult>;
  cancelShipment(shipmentIdOrAwb: string, reason?: string): Promise<{ success: boolean; message: string }>;
  getLabel?(shipmentIdOrAwb: string): Promise<{ labelUrl: string }>;

  // Returns
  createReturn?(request: ReturnRequest): Promise<ExternalReturnResult>;

  // Webhook Verification & Processing
  verifyWebhookSignature?(headers: Record<string, string>, rawBody: string | Buffer): boolean;
  processWebhook(payload: any, signature?: string): Promise<WebhookProcessResult>;
}
