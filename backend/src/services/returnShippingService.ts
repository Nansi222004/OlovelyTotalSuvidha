import Return from '../models/Return';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import Seller from '../models/Seller';
import { IThirdPartyCommerceProvider, ShipmentRequest } from '../types/thirdPartyCommerce';
import {
  dispatchForwardEcommerceShipment,
  ForwardShipmentValidationError,
  getActiveSellerShiprocketPickupName,
  getShippingProvider,
} from './shipping/shippingService';
import { mutateStock, recordReturn } from './inventoryService';
import { triggerReturnFinancialSettlement } from './returnLifecycleService';

export class ReturnLogisticsError extends Error {
  constructor(public readonly apiCode: string, message: string, public readonly statusCode = 409) {
    super(message);
    this.name = 'ReturnLogisticsError';
  }
}

const safeLogisticsMessage = 'Reverse logistics could not be created. The request is preserved for a safe retry.';

export async function buildExchangeReplacement(
  orderItem: any,
  quantity: number,
  replacementProductId?: string,
  replacementVariationId?: string
) {
  const productId = replacementProductId || String(orderItem.product?._id || orderItem.product);
  const product: any = await Product.findById(productId);
  if (!product || String(product.seller) !== String(orderItem.seller)) {
    throw new ReturnLogisticsError('EXCHANGE_REPLACEMENT_INVALID', 'Replacement must be a valid product from the original seller.');
  }
  if (product.productType !== orderItem.productType) {
    throw new ReturnLogisticsError('EXCHANGE_CHANNEL_MISMATCH', 'Replacement must use the same fulfillment channel as the original item.');
  }

  const requestedVariationId = replacementVariationId || orderItem.variationId?.toString();
  let variation: any;
  if (product.variations?.length) {
    if (!requestedVariationId) {
      throw new ReturnLogisticsError('EXCHANGE_VARIATION_REQUIRED', 'A specific replacement variation is required.');
    }
    variation = product.variations.find((item: any) => item._id?.toString() === requestedVariationId);
    if (!variation) {
      throw new ReturnLogisticsError('EXCHANGE_VARIATION_INVALID', 'The selected replacement variation is invalid.');
    }
    if ((variation.stock || 0) < quantity) {
      throw new ReturnLogisticsError('EXCHANGE_STOCK_UNAVAILABLE', 'The selected replacement variation is out of stock.');
    }
  } else if ((product.stock || 0) < quantity) {
    throw new ReturnLogisticsError('EXCHANGE_STOCK_UNAVAILABLE', 'The replacement product is out of stock.');
  }

  const replacementPrice = Number(variation?.discPrice || variation?.price || product.discPrice || product.price || 0);
  const originalPrice = Number(orderItem.unitPrice || 0);
  if (Math.abs(replacementPrice - originalPrice) > 0.009) {
    throw new ReturnLogisticsError(
      'EXCHANGE_PRICE_DIFFERENCE_UNSUPPORTED',
      'Exchanges with a price difference are not supported yet. Select an equal-price replacement.'
    );
  }

  return {
    product: product._id,
    variationId: variation?._id,
    seller: orderItem.seller,
    productName: product.productName,
    variantTitle: variation?.title || variation?.value || orderItem.variantTitle,
    sku: variation?.sku || product.sku || orderItem.sku || `SKU-${product._id.toString().slice(-6)}`,
    hsnCode: product.hsnCode || orderItem.hsnCode,
    taxRate: Number(orderItem.taxRate || 0),
    unitPrice: replacementPrice,
    quantity,
    status: 'PENDING_QC' as const,
  };
}

export async function createApprovedReturnLogistics(
  returnId: string,
  provider: IThirdPartyCommerceProvider = getShippingProvider(),
  processedBy?: string
) {
  const returnDoc: any = await Return.findById(returnId);
  if (!returnDoc) throw new ReturnLogisticsError('RETURN_NOT_FOUND', 'Return request not found.', 404);
  if (returnDoc.reverseLogisticsStatus === 'CREATED') return returnDoc;

  const orderItem: any = await OrderItem.findById(returnDoc.orderItem);
  const order: any = await Order.findById(returnDoc.order);
  if (!orderItem || !order) throw new ReturnLogisticsError('RETURN_RELATION_MISSING', 'Return order data is incomplete.');

  if (orderItem.productType !== 'ECOMMERCE') {
    return Return.findByIdAndUpdate(returnId, {
      $set: {
        status: 'Pickup Pending',
        reverseLogisticsStatus: 'NOT_REQUIRED',
        approvedAt: new Date(),
        ...(processedBy ? { processedBy, processedAt: new Date() } : {}),
      },
    }, { new: true });
  }

  const leaseExpiry = new Date(Date.now() - 5 * 60 * 1000);
  const leased: any = await Return.findOneAndUpdate({
    _id: returnId,
    $or: [
      { reverseLogisticsStatus: { $ne: 'CREATING' } },
      { updatedAt: { $lt: leaseExpiry } },
    ],
  }, {
    $set: {
      status: 'Approved',
      approvedAt: new Date(),
      ...(processedBy ? { processedBy, processedAt: new Date() } : {}),
      reverseLogisticsStatus: 'CREATING',
      reverseIdempotencyKey: `return:${returnId}:shiprocket:create`,
    },
    $unset: { reverseLastError: 1 },
  }, { new: true });
  if (!leased) throw new ReturnLogisticsError('RETURN_LOGISTICS_IN_PROGRESS', 'Reverse logistics creation is already in progress.');

  try {
    if (!provider.createReturn) throw new Error('Active shipping provider does not support reverse logistics');
    const product: any = await Product.findById(orderItem.product);
    const seller: any = await Seller.findById(orderItem.seller);
    if (!product || !seller) throw new ReturnLogisticsError('RETURN_SELLER_UNAVAILABLE', 'The original seller is unavailable for reverse logistics.');
    getActiveSellerShiprocketPickupName(seller);

    const config = seller.shippingConfig || {};
    const result = await provider.createReturn({
      orderId: order._id.toString(),
      fulfillmentGroupId: order.fulfillmentGroups?.find((g: any) =>
        g.items?.some((id: any) => id.toString() === orderItem._id.toString()))?.groupId,
      returnId,
      idempotencyKey: `return:${returnId}:shiprocket:create`,
      item: {
        productId: product._id.toString(),
        productName: orderItem.productName,
        sku: orderItem.sku || `SKU-${product._id.toString().slice(-6)}`,
        quantity: returnDoc.quantity,
        unitPrice: orderItem.unitPrice,
        hsnCode: orderItem.hsnCode,
        weightKg: product.packageDetails?.weightKg,
        dimensionsCm: product.packageDetails?.dimensionsCm,
      },
      pickupAddress: {
        customerName: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        address: order.deliveryAddress.address,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        country: 'India',
        pincode: order.deliveryAddress.pincode,
      },
      destinationAddress: {
        name: seller.storeName || seller.sellerName,
        email: seller.email,
        phone: seller.mobile,
        address: config.returnAddress || config.pickupAddress,
        city: config.pickupCity || seller.city,
        state: config.pickupState,
        country: 'India',
        pincode: config.pickupPincode,
      },
      paymentMethod: order.paymentMethod === 'COD' ? 'COD' : 'PREPAID',
      subtotal: Number((orderItem.unitPrice * returnDoc.quantity).toFixed(2)),
      reason: returnDoc.reason,
    });

    return Return.findByIdAndUpdate(returnId, {
      $set: {
        status: 'Reverse Shipment Created',
        reverseLogisticsStatus: 'CREATED',
        reverseProvider: provider.providerId,
        reverseExternalOrderId: result.externalOrderId,
        reverseShipmentId: result.shipmentId,
        returnAwbNumber: result.returnAwbNumber,
        courierName: result.carrier,
      },
      $unset: { reverseLastError: 1 },
    }, { new: true });
  } catch (error) {
    const message = error instanceof ReturnLogisticsError ? error.message : safeLogisticsMessage;
    await Return.updateOne({ _id: returnId }, {
      $set: { status: 'Approved', reverseLogisticsStatus: 'FAILED', reverseLastError: message },
    });
    if (error instanceof ReturnLogisticsError) throw error;
    throw new ReturnLogisticsError('RETURN_LOGISTICS_RETRY_PENDING', message, 503);
  }
}

export async function processReturnQc(
  returnId: string,
  approved: boolean,
  processedBy?: string,
  provider: IThirdPartyCommerceProvider = getShippingProvider()
) {
  const returnDoc: any = await Return.findById(returnId);
  if (!returnDoc) throw new ReturnLogisticsError('RETURN_NOT_FOUND', 'Return request not found.', 404);
  if (!['Handed To Seller', 'QC Pending', 'Replacement Ready', 'Forward Shipment Created', 'Replacement Shipped'].includes(returnDoc.status)) {
    if (returnDoc.status === 'Completed') return returnDoc;
    throw new ReturnLogisticsError('RETURN_QC_NOT_READY', `Product verification is not available while the request is ${returnDoc.status}.`);
  }
  if (!approved) {
    return Return.findByIdAndUpdate(returnId, {
      $set: { status: 'QC Rejected', qcStatus: 'REJECTED', qcProcessedAt: new Date() },
    }, { new: true });
  }

  const orderItem: any = await OrderItem.findById(returnDoc.orderItem);
  const order: any = await Order.findById(returnDoc.order);
  if (!orderItem || !order) throw new ReturnLogisticsError('RETURN_RELATION_MISSING', 'Return order data is incomplete.');

  await recordReturn(
    orderItem.product.toString(),
    orderItem.variationId?.toString() || null,
    returnDoc.quantity,
    returnId,
    orderItem._id.toString(),
    processedBy
  );

  await Return.updateOne({ _id: returnId }, {
    $set: { status: 'QC Pending', qcStatus: 'APPROVED', qcProcessedAt: new Date() },
  });

  if (returnDoc.requestType !== 'EXCHANGE') {
    const settled = await triggerReturnFinancialSettlement(returnId, processedBy);
    if (!settled.success) throw new ReturnLogisticsError('RETURN_SETTLEMENT_FAILED', settled.message, 500);
    return Return.findById(returnId);
  }

  const replacement: any = returnDoc.replacement;
  if (!replacement?.product || !replacement?.seller) {
    throw new ReturnLogisticsError('EXCHANGE_REPLACEMENT_MISSING', 'Exchange replacement details are missing.');
  }
  if (['CREATED', 'SHIPPED', 'DELIVERED'].includes(replacement.status)) return Return.findById(returnId);

  await mutateStock({
    productId: replacement.product.toString(),
    variationId: replacement.variationId?.toString() || null,
    quantity: -returnDoc.quantity,
    type: 'SALE',
    referenceType: 'RETURN',
    referenceId: returnId,
    orderItemId: orderItem._id.toString(),
    idempotencyKey: `exchange:${returnId}:replacement:inventory`,
    performedBy: processedBy,
    performedByRole: 'SYSTEM',
    note: 'Exchange replacement reservation after QC approval',
  });

  if (orderItem.productType !== 'ECOMMERCE') {
    return Return.findByIdAndUpdate(returnId, {
      $set: { status: 'Replacement Ready', 'replacement.status': 'MANUAL_INTERVENTION' },
    }, { new: true });
  }

  const replacementLease: any = await Return.findOneAndUpdate({
    _id: returnId,
    $or: [
      { 'replacement.status': { $ne: 'CREATING' } },
      { updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    ],
  }, {
    $set: { status: 'Replacement Ready', 'replacement.status': 'CREATING' },
    $unset: { 'replacement.lastError': 1 },
  }, { new: true });
  if (!replacementLease) {
    throw new ReturnLogisticsError('EXCHANGE_REPLACEMENT_IN_PROGRESS', 'Replacement shipment creation is already in progress.');
  }

  try {
    const seller: any = await Seller.findById(replacement.seller);
    const product: any = await Product.findById(replacement.product);
    if (!seller || !product) throw new ReturnLogisticsError('EXCHANGE_SELLER_UNAVAILABLE', 'Replacement shipment requires manual intervention because the original seller is unavailable.');
    const request: Omit<ShipmentRequest, 'pickupDetails'> = {
      source: 'EXCHANGE_REPLACEMENT',
      idempotencyKey: `exchange:${returnId}:replacement:create`,
      orderId: order._id.toString(),
      fulfillmentGroupId: replacement.fulfillmentGroupId || `EXCHANGE_${returnId}`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      shippingAddress: order.deliveryAddress,
      items: [{
        productId: product._id.toString(),
        productName: replacement.productName,
        sku: replacement.sku,
        quantity: returnDoc.quantity,
        unitPrice: replacement.unitPrice,
        weightKg: product.packageDetails?.weightKg || 0.5,
        variationId: replacement.variationId?.toString(),
        hsnCode: replacement.hsnCode,
        taxRate: replacement.taxRate,
      }],
      subtotal: replacement.unitPrice * returnDoc.quantity,
      shippingCharges: 0,
      totalDiscount: 0,
      paymentMethod: 'PREPAID',
      totalWeightKg: (product.packageDetails?.weightKg || 0.5) * returnDoc.quantity,
      dimensionsCm: product.packageDetails?.dimensionsCm,
    };
    const { shipmentRequest, shipmentResult: shipment } = await dispatchForwardEcommerceShipment(request, seller, provider);
    return Return.findByIdAndUpdate(returnId, {
      $set: {
        status: 'Forward Shipment Created',
        financialSettlementStatus: 'Completed',
        refundAmount: 0,
        'replacement.status': 'CREATED',
        'replacement.idempotencyKey': shipmentRequest.idempotencyKey,
        'replacement.inventoryIdempotencyKey': `exchange:${returnId}:replacement:inventory`,
        'replacement.externalOrderId': shipment.externalOrderId,
        'replacement.shipmentId': shipment.shipmentId,
        'replacement.awbNumber': shipment.awbNumber,
        'replacement.carrier': shipment.carrier,
        'replacement.trackingUrl': shipment.trackingUrl,
      },
      $unset: { 'replacement.lastError': 1 },
    }, { new: true });
  } catch (error) {
    const message = error instanceof ReturnLogisticsError || error instanceof ForwardShipmentValidationError
      ? error.message
      : 'Replacement shipment could not be created. Reserved stock and request state were preserved for retry.';
    await Return.updateOne({ _id: returnId }, {
      $set: { status: 'Replacement Ready', 'replacement.status': 'FAILED', 'replacement.lastError': message },
    });
    if (error instanceof ReturnLogisticsError) throw error;
    if (error instanceof ForwardShipmentValidationError) {
      throw new ReturnLogisticsError(`EXCHANGE_${error.code}`, error.message, 409);
    }
    throw new ReturnLogisticsError('EXCHANGE_REPLACEMENT_RETRY_PENDING', message, 503);
  }
}
