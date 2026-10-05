/**
 * shippingService.ts
 *
 * Pluggable registry and execution manager for Ecommerce shipping providers.
 * Coordinates shipment creation, tracking updates, and webhook processing
 * across Orders and Fulfillment Groups.
 */

import Order, { IOrder, IFulfillmentGroup } from '../../models/Order';
import OrderItem from '../../models/OrderItem';
import Seller, { ISeller } from '../../models/Seller';
import ProcessedWebhookEvent from '../../models/ProcessedWebhookEvent';
import Return from '../../models/Return';
import { IThirdPartyCommerceProvider, ShipmentRequest, ShipmentItem } from '../../types/thirdPartyCommerce';
import { mockCommerceProvider } from './mockCommerceProvider';
import { shiprocketProvider } from './shiprocketProvider';
import { areAllFulfillmentGroupsDelivered } from '../../utils/fulfillmentStatus';
import { buildShiprocketPickupLocationName, isShiprocketPickupRequired } from './shiprocketPickupService';

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

export class ForwardShipmentValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ForwardShipmentValidationError';
  }
}

/** Reject every Shiprocket fallback path unless this exact seller owns an active pickup. */
export function getActiveSellerShiprocketPickupName(
  seller: Pick<ISeller, '_id' | 'vendorType' | 'shippingConfig'> | null
): string {
  if (!seller) {
    throw new ForwardShipmentValidationError(
      'SELLER_UNAVAILABLE',
      'Courier shipment cannot be created because the vendor no longer exists'
    );
  }
  const expectedPickupName = buildShiprocketPickupLocationName(seller._id.toString());
  if (!isShiprocketPickupRequired(seller.vendorType)) {
    throw new ForwardShipmentValidationError(
      'SELLER_CHANNEL_INVALID',
      'Courier shipment requires an Ecommerce or Hybrid vendor'
    );
  }
  if (seller.shippingConfig?.shiprocketPickupStatus !== 'ACTIVE') {
    throw new ForwardShipmentValidationError(
      'SELLER_PICKUP_NOT_ACTIVE',
      'Courier shipment cannot be created until the vendor Shiprocket pickup location is ACTIVE and verified'
    );
  }
  if (!seller.shippingConfig?.shiprocketPickupLocationId) {
    throw new ForwardShipmentValidationError(
      'SELLER_PICKUP_ID_MISSING',
      'Courier shipment cannot be created because the vendor Shiprocket pickup ID is missing'
    );
  }
  if (seller.shippingConfig?.shiprocketPickupLocationName !== expectedPickupName) {
    throw new ForwardShipmentValidationError(
      'SELLER_PICKUP_NAME_MISMATCH',
      'Courier shipment cannot be created because the vendor Shiprocket pickup identity is invalid'
    );
  }
  return expectedPickupName;
}

/**
 * Single provider-agnostic boundary for every forward Ecommerce shipment.
 * Normal orders and post-QC exchange replacements both pass through here.
 */
export async function dispatchForwardEcommerceShipment(
  request: Omit<ShipmentRequest, 'pickupDetails'>,
  seller: Pick<ISeller, '_id' | 'vendorType' | 'storeName' | 'shippingConfig'> | null,
  provider: IThirdPartyCommerceProvider = getShippingProvider()
) {
  if (!seller) {
    throw new ForwardShipmentValidationError('SELLER_UNAVAILABLE', 'Forward shipment vendor is unavailable');
  }

  let pickupLocationName = seller.shippingConfig?.shiprocketPickupLocationName;
  if (provider.providerId === 'shiprocket') {
    pickupLocationName = getActiveSellerShiprocketPickupName(seller);
  }

  const shipmentRequest: ShipmentRequest = {
    ...request,
    pickupDetails: {
      sellerId: seller._id.toString(),
      sellerName: seller.storeName,
      pickupAddress: seller.shippingConfig?.pickupAddress || '',
      pickupPincode: seller.shippingConfig?.pickupPincode || '',
      pickupLocationId: seller.shippingConfig?.shiprocketPickupLocationId
        ? String(seller.shippingConfig.shiprocketPickupLocationId)
        : undefined,
      pickupLocationName,
    },
  };

  const result = await provider.createShipment(shipmentRequest);
  if (!result || !result.awbNumber || !result.externalOrderId) {
    throw new Error('Provider returned malformed shipment response: missing awbNumber or externalOrderId');
  }
  return { shipmentRequest, shipmentResult: result };
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
    variationId: item.variationId?.toString(),
    hsnCode: item.hsnCode,
    taxRate: item.taxRate,
  }));

  const seller = group.seller
    ? await Seller.findById(group.seller).select('storeName address vendorType shippingConfig')
    : null;

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
    source: 'CUSTOMER_ORDER',
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
    items: shipmentItems,
    subtotal: group.subtotal,
    shippingCharges: group.shippingFee,
    paymentMethod: order.paymentMethod,
    totalWeightKg,
    dimensionsCm,
  };

  const { shipmentResult } = await dispatchForwardEcommerceShipment(shipmentRequest, seller, provider);

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
export async function handleShippingWebhook(payload: any, signature?: string, providerId?: string) {
  const provider = getShippingProvider(providerId);
  const result = await provider.processWebhook(payload, signature);

  if (!result.handled || !result.awbNumber || !result.statusUpdate) {
    return result;
  }

  let eventClaimed = false;
  if (result.eventId) {
    const existing: any = await ProcessedWebhookEvent.findOne({ eventId: result.eventId }).lean();
    if (existing) {
      const staleBefore = Date.now() - 5 * 60 * 1000;
      const canReclaim =
        existing.processingState === 'PROCESSING' &&
        existing.lockedAt &&
        new Date(existing.lockedAt).getTime() < staleBefore;
      if (!canReclaim) {
        return { ...result, ignoredReason: 'Duplicate webhook event already processed' };
      }
      const reclaimed = await ProcessedWebhookEvent.updateOne(
        { _id: existing._id, processingState: 'PROCESSING', lockedAt: existing.lockedAt },
        { $set: { lockedAt: new Date() } }
      );
      if (reclaimed.modifiedCount !== 1) {
        return { ...result, ignoredReason: 'Duplicate webhook event is already being processed' };
      }
      eventClaimed = true;
    } else {
      try {
        await ProcessedWebhookEvent.create({
        eventId: result.eventId,
        provider: provider.providerId,
        awbNumber: result.awbNumber,
        orderId: result.orderId,
        statusUpdate: result.statusUpdate,
        rawPayload: payload,
          processingState: 'PROCESSING',
          lockedAt: new Date(),
        });
        eventClaimed = true;
      } catch (error: any) {
        if (error?.code === 11000) {
          return { ...result, ignoredReason: 'Duplicate webhook event is already being processed' };
        }
        throw error;
      }
    }
  }

  const completeEvent = async () => {
    if (!result.eventId || !eventClaimed) return;
    await ProcessedWebhookEvent.updateOne(
      { eventId: result.eventId, processingState: 'PROCESSING' },
      { $set: { processingState: 'COMPLETED', completedAt: new Date() }, $unset: { lockedAt: 1 } }
    );
  };

  try {

  // Reverse and exchange-replacement shipments are independent from the original
  // fulfillment group. Route their AWBs first so they can never mutate the forward leg.
  const returnRequest: any = await Return.findOne({
    $or: [
      { returnAwbNumber: result.awbNumber },
      { 'replacement.awbNumber': result.awbNumber },
    ],
  });
  if (returnRequest) {
    const isReplacement = returnRequest.replacement?.awbNumber === result.awbNumber;
    if (isReplacement) {
      if (result.statusUpdate === 'Delivered') {
        returnRequest.replacement.status = 'DELIVERED';
        returnRequest.status = 'Completed';
        returnRequest.completedAt = new Date();
      } else if (['Picked Up', 'In Transit', 'Out for Delivery'].includes(result.statusUpdate || '')) {
        returnRequest.replacement.status = 'SHIPPED';
        returnRequest.status = 'Replacement Shipped';
      }
      if (result.trackingUrl) returnRequest.replacement.trackingUrl = result.trackingUrl;
      if (result.courierName) returnRequest.replacement.carrier = result.courierName;
    } else {
      if (result.statusUpdate === 'Delivered' || result.statusUpdate === 'Returned') {
        returnRequest.reverseLogisticsStatus = 'RECEIVED';
        returnRequest.status = 'Handed To Seller';
        returnRequest.handedToSellerAt = new Date();
      } else if (result.statusUpdate === 'In Transit') {
        returnRequest.reverseLogisticsStatus = 'IN_TRANSIT';
        returnRequest.status = 'In Transit';
        returnRequest.inTransitAt = new Date();
      } else if (result.statusUpdate === 'Picked Up' || result.statusUpdate === 'Out for Delivery') {
        returnRequest.reverseLogisticsStatus = 'PICKED_UP';
        returnRequest.status = 'Picked Up';
        returnRequest.pickedUpAt = returnRequest.pickedUpAt || new Date();
      }
      if (result.trackingUrl) returnRequest.reverseTrackingUrl = result.trackingUrl;
      if (result.courierName) returnRequest.courierName = result.courierName;
    }
    await returnRequest.save();
    await completeEvent();
    return result;
  }

  // Match only courier fulfillment groups. A QC/local AWB-shaped value must never
  // allow a carrier callback to mutate local-delivery state.
  const order = await Order.findOne({
    fulfillmentGroups: {
      $elemMatch: {
        fulfillmentType: { $in: ['COURIER_SHIPPING', 'THIRD_PARTY_API'] },
        'shippingDetails.awbNumber': result.awbNumber,
      },
    },
  });

  if (!order || !order.fulfillmentGroups) {
    await completeEvent();
    return {
      ...result,
      ignoredReason: `No order found with AWB ${result.awbNumber}`,
    };
  }

  const group = order.fulfillmentGroups.find(
    (g) =>
      g.shippingDetails?.awbNumber === result.awbNumber &&
      (g.fulfillmentType === 'COURIER_SHIPPING' || g.fulfillmentType === 'THIRD_PARTY_API')
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
      'Action Required': 'ActionRequired',
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
      ActionRequired: 98,
      Cancelled: 99,
    };

    const currentWeight = HIERARCHY[group.status] || 0;
    const incomingWeight = HIERARCHY[targetGroupStatus] || 0;

    const terminalRegression =
      (group.status === 'Delivered' && targetGroupStatus !== 'Delivered') ||
      (group.status === 'Cancelled' && targetGroupStatus !== 'Cancelled');

    if (!terminalRegression && incomingWeight >= currentWeight) {
      group.status = targetGroupStatus;
      if (group.thirdPartyOrderDetails) {
        group.thirdPartyOrderDetails.status = result.statusUpdate;
      }
    } else {
      console.log(`ℹ️ [Webhook] Ignored out-of-order status downgrade on group ${group.groupId} from '${group.status}' to '${targetGroupStatus}'`);
    }

    group.shippingDetails = group.shippingDetails || {};
    if (result.courierName) group.shippingDetails.carrier = result.courierName;
    if (result.trackingUrl) group.shippingDetails.trackingUrl = result.trackingUrl;
    if (result.estimatedDelivery) group.shippingDetails.estimatedDelivery = result.estimatedDelivery;
    if (group.thirdPartyOrderDetails) {
      if (result.shipmentId) group.thirdPartyOrderDetails.shipmentId = result.shipmentId;
      group.thirdPartyOrderDetails.providerId = 'shiprocket';
    }

    // If all groups are delivered, update overall order status
    const allDelivered = areAllFulfillmentGroupsDelivered(order.fulfillmentGroups);
    if (allDelivered) {
      order.status = 'Delivered';
      order.deliveredAt = new Date();
    }

    await order.save();
  }

  await completeEvent();

  return result;
  } catch (error) {
    // Release only this in-flight claim. A provider retry can then safely process
    // the callback instead of losing it after a transient database failure.
    if (result.eventId && eventClaimed) {
      await ProcessedWebhookEvent.deleteOne({
        eventId: result.eventId,
        processingState: 'PROCESSING',
      }).catch(() => undefined);
    }
    throw error;
  }
}
