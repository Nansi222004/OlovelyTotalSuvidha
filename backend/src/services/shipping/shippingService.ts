/**
 * shippingService.ts
 *
 * Pluggable registry and execution manager for Ecommerce shipping providers.
 * Coordinates shipment creation, tracking updates, and webhook processing
 * across Orders and Fulfillment Groups.
 */

import Order, { IOrder, IFulfillmentGroup } from '../../models/Order';
import OrderItem from '../../models/OrderItem';
import Seller from '../../models/Seller';
import ProcessedWebhookEvent from '../../models/ProcessedWebhookEvent';
import { IThirdPartyCommerceProvider, ShipmentRequest, ShipmentItem } from '../../types/thirdPartyCommerce';
import { mockCommerceProvider } from './mockCommerceProvider';
import { shiprocketProvider } from './shiprocketProvider';

/**
 * Provider Registry
 */
const providers = new Map<string, IThirdPartyCommerceProvider>();
providers.set(mockCommerceProvider.providerId, mockCommerceProvider);
providers.set(shiprocketProvider.providerId, shiprocketProvider);

/**
 * Get active shipping provider
 */
export function getShippingProvider(providerId?: string): IThirdPartyCommerceProvider {
  if (providerId && providers.has(providerId)) {
    return providers.get(providerId)!;
  }
  const envProvider = process.env.SHIPPING_PROVIDER?.toLowerCase();
  if (envProvider === 'shiprocket') {
    return shiprocketProvider;
  }
  if (envProvider === 'mock') {
    return mockCommerceProvider;
  }
  // Default to Shiprocket if credentials configured, else fallback to mock for tests
  if (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD) {
    return shiprocketProvider;
  }
  return mockCommerceProvider;
}

/**
 * Check Pincode Serviceability
 */
export async function checkPincode(pincode: string, providerId?: string) {
  const provider = getShippingProvider(providerId);
  return provider.checkPincodeServiceability(pincode);
}

/**
 * Dispatch / Create Ecommerce Shipment for a Fulfillment Group
 *
 * Uses Idempotency Key: OLOVELY_<ORDER_ID>_<GROUP_ID>
 */
export async function createEcommerceShipment(
  orderId: string,
  groupId: string,
  providerId?: string
) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const group = order.fulfillmentGroups?.find((g) => g.groupId === groupId);
  if (!group) {
    throw new Error(`Fulfillment group '${groupId}' not found in order ${orderId}`);
  }

  if (group.fulfillmentType === 'LOCAL_DELIVERY') {
    throw new Error(`Shiprocket shipment rejected: Group '${groupId}' has fulfillmentType LOCAL_DELIVERY (not an Ecommerce courier shipping group)`);
  }

  if (group.fulfillmentType !== 'COURIER_SHIPPING' && group.fulfillmentType !== 'THIRD_PARTY_API') {
    throw new Error(`Group '${groupId}' is not an Ecommerce courier shipping group`);
  }

  // Idempotency Check 1: Return existing shipment if AWB/externalOrderId already assigned
  if (group.shippingDetails?.awbNumber && group.thirdPartyOrderDetails?.externalOrderId) {
    console.log(`ℹ️ [Shipment Idempotency] Group ${groupId} already has active shipment (AWB: ${group.shippingDetails.awbNumber}). Returning existing.`);
    return {
      order,
      group,
      shipmentResult: {
        externalOrderId: group.thirdPartyOrderDetails.externalOrderId,
        shipmentId: group.thirdPartyOrderDetails.shipmentId,
        awbNumber: group.shippingDetails.awbNumber,
        carrier: group.shippingDetails.carrier,
        trackingNumber: group.shippingDetails.trackingNumber,
        trackingUrl: group.shippingDetails.trackingUrl,
        status: group.status,
      },
    };
  }

  // Idempotency Check 2: Reject if already in dispatched status
  if (['Shipped', 'OutForDelivery', 'Delivered'].includes(group.status)) {
    throw new Error(`Cannot create shipment: group '${groupId}' is already in status '${group.status}'`);
  }

  const provider = getShippingProvider(providerId || group.thirdPartyOrderDetails?.providerId);
  const idempotencyKey = `OLOVELY_${order._id.toString()}_${group.groupId}`;

  // Fetch items for shipment payload
  const orderItems = await OrderItem.find({ _id: { $in: group.items } }).populate('product');
  const shipmentItems: ShipmentItem[] = orderItems.map((item: any) => ({
    productId: item.product?._id?.toString() || item._id.toString(),
    productName: item.productName || item.product?.productName || 'Ecommerce Product',
    sku: item.sku || item.product?.sku || `SKU-${item._id.toString().slice(-6)}`,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    weightKg: item.product?.packageDetails?.weightKg || 0.5,
  }));

  // Fetch seller pickup details if available
  let pickupDetails;
  if (group.seller) {
    const seller = await Seller.findById(group.seller).select('storeName address shippingConfig');
    if (seller) {
      pickupDetails = {
        sellerId: seller._id.toString(),
        sellerName: seller.storeName,
        pickupAddress: seller.shippingConfig?.pickupAddress || seller.address,
        pickupPincode: seller.shippingConfig?.pickupPincode || '110001',
      };
    }
  }

  // Strict pre-dispatch validation (Section 9)
  if (!order.deliveryAddress?.pincode || !/^[1-9][0-9]{5}$/.test(order.deliveryAddress.pincode.trim())) {
    throw new Error(`Package validation failed: Valid 6-digit delivery pincode is required (got '${order.deliveryAddress?.pincode}')`);
  }
  if (!order.deliveryAddress?.address || order.deliveryAddress.address.trim() === '') {
    throw new Error('Package validation failed: Delivery address is required');
  }
  if (shipmentItems.length === 0) {
    throw new Error('Package validation failed: Shipment group has no valid items');
  }

  const totalWeightKg = shipmentItems.reduce((sum, item) => sum + ((item.weightKg || 0.5) * item.quantity), 0);
  let maxLen = 0;
  let maxWid = 0;
  let maxHgt = 0;
  for (const item of orderItems as any[]) {
    const d = item.product?.packageDetails?.dimensionsCm;
    if (d?.length && d.length > maxLen) maxLen = d.length;
    if (d?.width && d.width > maxWid) maxWid = d.width;
    if (d?.height && d.height > maxHgt) maxHgt = d.height;
  }
  const dimensionsCm = maxLen > 0 && maxWid > 0 && maxHgt > 0 ? { length: maxLen, width: maxWid, height: maxHgt } : undefined;

  const shipmentRequest: ShipmentRequest = {
    idempotencyKey,
    orderId: order._id.toString(),
    fulfillmentGroupId: group.groupId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    shippingAddress: {
      address: order.deliveryAddress.address,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      pincode: order.deliveryAddress.pincode,
      landmark: order.deliveryAddress.landmark,
    },
    pickupDetails,
    items: shipmentItems,
    subtotal: group.subtotal,
    totalWeightKg,
    dimensionsCm,
  };

  const shipmentResult = await provider.createShipment(shipmentRequest);

  if (!shipmentResult || !shipmentResult.awbNumber || !shipmentResult.externalOrderId) {
    throw new Error('Provider returned malformed shipment response: missing awbNumber or externalOrderId');
  }

  // Update fulfillment group state
  group.shippingDetails = {
    carrier: shipmentResult.carrier || 'Shiprocket Courier',
    awbNumber: shipmentResult.awbNumber,
    trackingNumber: shipmentResult.trackingNumber || shipmentResult.awbNumber,
    trackingUrl: shipmentResult.trackingUrl,
    shippedAt: new Date(),
  };

  group.thirdPartyOrderDetails = {
    providerId: provider.providerId,
    externalOrderId: shipmentResult.externalOrderId,
    shipmentId: shipmentResult.shipmentId,
    status: shipmentResult.status,
    idempotencyKey,
  };

  group.status = 'Shipped';
  await order.save();

  return {
    order,
    group,
    shipmentResult,
  };
}

/**
 * Get Tracking Information for an AWB
 */
export async function getShipmentTracking(awb: string, providerId?: string) {
  const provider = getShippingProvider(providerId);
  return provider.getTrackingDetails(awb);
}

/**
 * Cancel an Ecommerce Shipment
 */
export async function cancelEcommerceShipment(
  orderId: string,
  groupId: string,
  reason?: string
) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const group = order.fulfillmentGroups?.find((g) => g.groupId === groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }

  const awb = group.shippingDetails?.awbNumber;
  if (!awb) {
    // Hasn't been shipped with carrier yet, cancel locally
    group.status = 'Cancelled';
    await order.save();
    return { success: true, message: 'Fulfillment group cancelled locally' };
  }

  const provider = getShippingProvider(group.thirdPartyOrderDetails?.providerId);
  const cancelResult = await provider.cancelShipment(awb, reason);

  if (cancelResult.success) {
    group.status = 'Cancelled';
    await order.save();
  }

  return cancelResult;
}

/**
 * Handle incoming carrier webhook
 */
export async function handleShippingWebhook(payload: any, signature?: string) {
  const provider = getShippingProvider();
  const result = await provider.processWebhook(payload, signature);

  if (!result.handled || !result.awbNumber || !result.statusUpdate) {
    return result;
  }

  // Find order containing this AWB
  const order = await Order.findOne({
    'fulfillmentGroups.shippingDetails.awbNumber': result.awbNumber,
  });

  if (!order || !order.fulfillmentGroups) {
    return {
      ...result,
      ignoredReason: `No order found with AWB ${result.awbNumber}`,
    };
  }

  const group = order.fulfillmentGroups.find(
    (g) => g.shippingDetails?.awbNumber === result.awbNumber
  );

  if (group) {
    // Map carrier status to IFulfillmentGroup status
    const statusMap: Record<string, IFulfillmentGroup['status']> = {
      Manifested: 'Processing',
      'In Transit': 'Shipped',
      'Out for Delivery': 'OutForDelivery',
      Delivered: 'Delivered',
      Cancelled: 'Cancelled',
      Returned: 'Cancelled',
    };

    const targetGroupStatus = statusMap[result.statusUpdate] || 'Processing';

    // Status hierarchy protection: Do not downgrade from Delivered to lower status
    const HIERARCHY: Record<string, number> = {
      Pending: 0,
      Processing: 1,
      ReadyForPickup: 2,
      Shipped: 3,
      OutForDelivery: 4,
      Delivered: 5,
      Cancelled: 99,
    };

    const currentWeight = HIERARCHY[group.status] || 0;
    const incomingWeight = HIERARCHY[targetGroupStatus] || 0;

    if (incomingWeight >= currentWeight || group.status === 'Cancelled') {
      group.status = targetGroupStatus;
      if (group.thirdPartyOrderDetails) {
        group.thirdPartyOrderDetails.status = result.statusUpdate;
      }
    } else {
      console.log(`ℹ️ [Webhook] Ignored out-of-order status downgrade on group ${group.groupId} from '${group.status}' to '${targetGroupStatus}'`);
    }

    // If all groups are delivered, update overall order status
    const allDelivered = order.fulfillmentGroups.every((g) => g.status === 'Delivered');
    if (allDelivered) {
      order.status = 'Delivered';
      order.deliveredAt = new Date();
    }

    await order.save();
  }

  return result;
}
