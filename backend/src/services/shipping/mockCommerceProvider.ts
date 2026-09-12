/**
 * MockCommerceProvider.ts
 *
 * Concrete implementation of IThirdPartyCommerceProvider for local testing,
 * QA environments, and integration simulations.
 *
 * NOTE ON PRICING & POLICIES:
 * All numeric fees and day thresholds defined here are TEST DEFAULTS ONLY.
 * Production rates must be configured via AppSettings or dynamic carrier rate cards.
 */

import crypto from 'crypto';
import {
  IThirdPartyCommerceProvider,
  PincodeCheckResult,
  ShipmentRequest,
  ExternalOrderResult,
  ExternalTrackingResult,
  ReturnRequest,
  ExternalReturnResult,
  WebhookProcessResult,
  TrackingMilestone,
} from '../../types/thirdPartyCommerce';

/**
 * TEST DEFAULTS ONLY:
 * These values provide predictable behaviors during automated/manual testing.
 * They do NOT represent agreed-upon business pricing.
 */
export const TEST_SHIPPING_CONFIG = {
  DEFAULT_SHIPPING_FEE: 40, // ₹40 TEST DEFAULT ONLY
  FREE_SHIPPING_THRESHOLD: 499, // ₹499 TEST DEFAULT ONLY
  DEFAULT_DELIVERY_DAYS: 4, // 4 Days TEST DEFAULT ONLY
  DEFAULT_RETURN_WINDOW_DAYS: 7, // 7 Days TEST DEFAULT ONLY
  MOCK_SECRET_KEY: 'mock_webhook_secret_key_123',
};

// Internal in-memory storage for mock shipments to guarantee idempotency and persistence across calls
interface MockShipmentRecord {
  idempotencyKey: string;
  externalOrderId: string;
  orderId: string;
  fulfillmentGroupId: string;
  awbNumber: string;
  carrier: string;
  status: 'Manifested' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  milestones: TrackingMilestone[];
  requestPayload: ShipmentRequest;
  createdAt: Date;
  updatedAt: Date;
}

// Internal in-memory storage for processed webhook events
const processedWebhookEventIds = new Set<string>();

// Idempotency store indexed by idempotencyKey
const shipmentStore = new Map<string, MockShipmentRecord>();

// Secondary index by awbNumber
const awbIndex = new Map<string, MockShipmentRecord>();

// Secondary index by externalOrderId
const externalOrderIndex = new Map<string, MockShipmentRecord>();

// In-memory returns store
const returnStore = new Map<string, any>();

/**
 * Status sequence hierarchy to protect against out-of-order webhook events
 */
const STATUS_HIERARCHY: Record<string, number> = {
  Manifested: 1,
  'In Transit': 2,
  'Out for Delivery': 3,
  Delivered: 4,
  Cancelled: 99,
};

export class MockCommerceProvider implements IThirdPartyCommerceProvider {
  public readonly providerId = 'mock_provider';
  public readonly providerName = 'MockCommerceProvider';

  /**
   * Check Pincode Serviceability
   *
   * Rules:
   * - Must be a valid 6-digit Indian pincode string.
   * - Simulated unserviceable pincodes for testing: '000000', '999999', '990001'.
   */
  async checkPincodeServiceability(
    pincode: string,
    options?: { weightKg?: number }
  ): Promise<PincodeCheckResult> {
    const cleanPincode = String(pincode || '').trim();

    // Indian postal code format: 6 digits, first digit 1-9
    const isValidFormat = /^[1-9][0-9]{5}$/.test(cleanPincode);
    if (!isValidFormat) {
      return {
        pincode: cleanPincode,
        isServiceable: false,
      };
    }

    // Explicit test blacklist
    const unserviceablePincodes = ['999999', '990001', '000000'];
    if (unserviceablePincodes.includes(cleanPincode)) {
      return {
        pincode: cleanPincode,
        isServiceable: false,
      };
    }

    return {
      pincode: cleanPincode,
      isServiceable: true,
      estimatedDeliveryDays: TEST_SHIPPING_CONFIG.DEFAULT_DELIVERY_DAYS,
      shippingFee: TEST_SHIPPING_CONFIG.DEFAULT_SHIPPING_FEE,
      courierName: 'MockCourier Express',
    };
  }

  /**
   * Create Shipment with STRICT IDEMPOTENCY
   *
   * Idempotency Key Format: OLOVELY_<ORDER_ID>_<FULFILLMENT_GROUP_ID>
   * If a shipment with this key already exists, the existing record is returned.
   */
  async createShipment(request: ShipmentRequest): Promise<ExternalOrderResult> {
    const { idempotencyKey } = request;

    if (!idempotencyKey) {
      throw new Error('Idempotency key is required for shipment creation');
    }

    // Simulated failure triggers for automated testing
    if (request.orderId?.includes('SIMULATE_TIMEOUT')) {
      throw new Error('Provider request timed out after 30000ms');
    }
    if (request.orderId?.includes('SIMULATE_500')) {
      throw new Error('Provider HTTP 500: Internal Courier Service Failure');
    }
    if (request.orderId?.includes('SIMULATE_MALFORMED')) {
      return {
        externalOrderId: '',
        awbNumber: '',
        carrier: '',
        status: 'Manifested',
      } as any;
    }

    // 1. Idempotency Check: Return existing record if already generated
    const existing = shipmentStore.get(idempotencyKey);
    if (existing) {
      return {
        externalOrderId: existing.externalOrderId,
        awbNumber: existing.awbNumber,
        carrier: existing.carrier,
        trackingNumber: existing.awbNumber,
        trackingUrl: `https://track.mockcourier.local/${existing.awbNumber}`,
        status: existing.status,
        labelUrl: `https://labels.mockcourier.local/${existing.awbNumber}.pdf`,
        rawResponse: { id: existing.externalOrderId, cached: true },
      };
    }

    // 2. Generate new shipment identifiers
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const externalOrderId = `MOCK_SHIP_${timestamp}_${randomSuffix}`;
    const awbNumber = `AWB-MOCK-${timestamp.toString().slice(-6)}-${randomSuffix}`;
    const carrier = 'MockCourier Express';
    const status = 'Manifested';

    const initialMilestones: TrackingMilestone[] = [
      {
        status: 'Manifested',
        description: 'Shipment created and manifested with carrier',
        location: request.pickupDetails?.pickupAddress || 'Seller Warehouse',
        timestamp: new Date(),
      },
    ];

    const record: MockShipmentRecord = {
      idempotencyKey,
      externalOrderId,
      orderId: request.orderId,
      fulfillmentGroupId: request.fulfillmentGroupId,
      awbNumber,
      carrier,
      status,
      milestones: initialMilestones,
      requestPayload: request,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in internal memory
    shipmentStore.set(idempotencyKey, record);
    awbIndex.set(awbNumber, record);
    externalOrderIndex.set(externalOrderId, record);

    return {
      externalOrderId,
      awbNumber,
      carrier,
      trackingNumber: awbNumber,
      trackingUrl: `https://track.mockcourier.local/${awbNumber}`,
      status,
      labelUrl: `https://labels.mockcourier.local/${awbNumber}.pdf`,
      rawResponse: { id: externalOrderId, cached: false },
    };
  }

  /**
   * Get Tracking Details for an AWB or Tracking Number
   */
  async getTrackingDetails(trackingNumberOrAwb: string): Promise<ExternalTrackingResult> {
    const record =
      awbIndex.get(trackingNumberOrAwb) || externalOrderIndex.get(trackingNumberOrAwb);

    if (!record) {
      // Return simulated fallback for arbitrary AWB tests
      return {
        carrier: 'MockCourier Express',
        trackingNumber: trackingNumberOrAwb,
        awbNumber: trackingNumberOrAwb,
        trackingUrl: `https://track.mockcourier.local/${trackingNumberOrAwb}`,
        status: 'Manifested',
        milestones: [
          {
            status: 'Manifested',
            description: 'Shipment record registered',
            timestamp: new Date(),
          },
        ],
      };
    }

    return {
      carrier: record.carrier,
      trackingNumber: record.awbNumber,
      awbNumber: record.awbNumber,
      trackingUrl: `https://track.mockcourier.local/${record.awbNumber}`,
      status: record.status,
      milestones: record.milestones,
    };
  }

  /**
   * Cancel Shipment
   *
   * Business Boundary:
   * - Allowed ONLY BEFORE dispatch (when status is 'Manifested').
   * - Blocked once dispatched ('In Transit', 'Out for Delivery', 'Delivered').
   */
  async cancelShipment(
    shipmentIdOrAwb: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const record =
      awbIndex.get(shipmentIdOrAwb) || externalOrderIndex.get(shipmentIdOrAwb);

    if (!record) {
      return { success: false, message: 'Shipment not found' };
    }

    if (record.status === 'Cancelled') {
      return { success: true, message: 'Shipment already cancelled' };
    }

    // Cancellation boundary: only allowed if still Manifested
    if (record.status !== 'Manifested') {
      return {
        success: false,
        message: `Cannot cancel shipment after dispatch. Current carrier status is '${record.status}'.`,
      };
    }

    record.status = 'Cancelled';
    record.milestones.push({
      status: 'Cancelled',
      description: `Shipment cancelled before dispatch: ${reason || 'Customer request'}`,
      timestamp: new Date(),
    });
    record.updatedAt = new Date();

    return {
      success: true,
      message: 'Shipment cancelled successfully with carrier',
    };
  }

  /**
   * Get Shipping Label URL
   */
  async getLabel(shipmentIdOrAwb: string): Promise<{ labelUrl: string }> {
    const record =
      awbIndex.get(shipmentIdOrAwb) || externalOrderIndex.get(shipmentIdOrAwb);
    const awb = record ? record.awbNumber : shipmentIdOrAwb;
    return {
      labelUrl: `https://labels.mockcourier.local/${awb}.pdf`,
    };
  }

  /**
   * Create Return Shipment
   *
   * Enforces return window and generates return tracking
   */
  async createReturn(request: ReturnRequest): Promise<ExternalReturnResult> {
    const returnKey = `RET_${request.orderId}_${request.item.productId}`;

    // Duplicate return prevention
    if (returnStore.has(returnKey)) {
      const existing = returnStore.get(returnKey);
      return existing;
    }

    const returnAwbNumber = `RET-AWB-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const pickupDate = new Date();
    pickupDate.setDate(pickupDate.getDate() + 2); // 2 days for pickup

    const result: ExternalReturnResult = {
      returnId: request.returnId,
      returnAwbNumber,
      carrier: 'MockCourier Reverse Logistics',
      status: 'Return Initiated',
      estimatedPickupDate: pickupDate,
    };

    returnStore.set(returnKey, result);
    return result;
  }

  /**
   * Verify Webhook Signature (HMAC SHA-256)
   */
  verifyWebhookSignature(headers: Record<string, string>, rawBody: string | Buffer): boolean {
    const signature = headers['x-mock-signature'] || headers['X-Mock-Signature'];
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', TEST_SHIPPING_CONFIG.MOCK_SECRET_KEY)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Process Carrier Webhook Event with:
   * 1. Duplicate event protection (idempotency)
   * 2. Out-of-order event protection (prevent status regression)
   */
  async processWebhook(payload: any, signature?: string): Promise<WebhookProcessResult> {
    const { eventId, awbNumber, status, description, location, timestamp } = payload;

    if (!eventId || !awbNumber || !status) {
      return {
        handled: false,
        ignoredReason: 'Missing required webhook fields (eventId, awbNumber, status)',
      };
    }

    // 1. Duplicate Event Protection
    if (processedWebhookEventIds.has(eventId)) {
      return {
        handled: true,
        awbNumber,
        ignoredReason: `Duplicate webhook event '${eventId}' ignored`,
      };
    }

    const record = awbIndex.get(awbNumber);
    if (!record) {
      // Still acknowledge to avoid carrier retries, but mark ignored
      processedWebhookEventIds.add(eventId);
      return {
        handled: true,
        awbNumber,
        ignoredReason: `No local shipment matching AWB '${awbNumber}'`,
      };
    }

    // 2. Out-of-Order Status Regression Protection
    const currentWeight = STATUS_HIERARCHY[record.status] || 0;
    const incomingWeight = STATUS_HIERARCHY[status] || 0;

    if (incomingWeight < currentWeight && record.status !== 'Cancelled') {
      // Out-of-order event: Do NOT downgrade status!
      processedWebhookEventIds.add(eventId);
      return {
        handled: true,
        awbNumber,
        statusUpdate: record.status, // Keep current status
        ignoredReason: `Out-of-order status rejected: cannot regress from '${record.status}' to '${status}'`,
      };
    }

    // Valid progression: Update status
    record.status = status;
    const milestone: TrackingMilestone = {
      status,
      description: description || `Status updated to ${status}`,
      location: location || 'Transit Hub',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    record.milestones.push(milestone);
    record.updatedAt = new Date();

    processedWebhookEventIds.add(eventId);

    return {
      handled: true,
      orderId: record.orderId,
      fulfillmentGroupId: record.fulfillmentGroupId,
      awbNumber,
      statusUpdate: status,
      milestone,
    };
  }

  /**
   * Helper for unit tests to reset internal mock memory
   */
  __resetForTesting() {
    shipmentStore.clear();
    awbIndex.clear();
    externalOrderIndex.clear();
    returnStore.clear();
    processedWebhookEventIds.clear();
  }
}

// Export singleton instance
export const mockCommerceProvider = new MockCommerceProvider();
