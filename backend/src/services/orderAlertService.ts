import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import DeliveryOrderOffer from "../models/DeliveryOrderOffer";
import Notification from "../models/Notification";
import { calculateEstimatedDeliveryBoyEarning } from "./orderNotificationHelpers";

export interface SellerOrderAlert {
  type: "NEW_ORDER";
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      address: string;
      city: string;
      state?: string;
      pincode: string;
      landmark?: string;
    };
  };
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    total: number;
    variation?: string;
  }>;
  totalAmount: number;
  deliveryOption?: string;
  timestamp: Date;
}

export interface DeliveryOrderAlert {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: {
    address: string;
    city: string;
    state?: string;
    pincode: string;
    landmark?: string;
  };
  total: number;
  subtotal: number;
  shipping: number;
  deliveryBoyEarning: number;
  createdAt: string;
  type?: string;
  isManualAssignment?: boolean;
}

function isSellerNotifiableOrder(order: any): boolean {
  if (!order) return false;
  if (["Cancelled", "Rejected", "Returned"].includes(order.status)) return false;

  const isOnlinePayment =
    order.paymentMethod === "Online" || order.paymentMethod === "razorpay";
  if (isOnlinePayment && order.paymentStatus !== "Paid") return false;

  return true;
}

/** Only rehydrate NEW_ORDER popups for recent pending orders (not historical backlog). */
const SELLER_PENDING_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function getSellerPendingOrderAlerts(
  sellerId: string,
): Promise<SellerOrderAlert[]> {
  const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
  const alertCutoff = new Date(Date.now() - SELLER_PENDING_ALERT_MAX_AGE_MS);

  const pendingItems = await OrderItem.find({
    seller: sellerObjectId,
    sellerStatus: "Pending",
  }).select("order");

  const orderIds = [...new Set(pendingItems.map((item) => item.order.toString()))];
  if (orderIds.length === 0) return [];

  const orders = await Order.find({
    _id: { $in: orderIds },
    status: { $nin: ["Cancelled", "Rejected", "Returned", "Pending"] },
    createdAt: { $gte: alertCutoff },
  })
    .sort({ createdAt: -1 })
    .lean();

  const alerts: SellerOrderAlert[] = [];

  for (const order of orders) {
    if (!isSellerNotifiableOrder(order)) continue;

    const sellerItems = await OrderItem.find({
      order: order._id,
      seller: sellerObjectId,
      sellerStatus: "Pending",
    }).lean();

    if (sellerItems.length === 0) continue;

    alerts.push({
      type: "NEW_ORDER",
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        address: order.deliveryAddress,
      },
      deliveryOption: order.deliveryOption || "Standard",
      items: sellerItems.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.total,
        variation: item.variation,
      })),
      totalAmount: sellerItems.reduce((acc, item) => acc + item.total, 0),
      timestamp: order.createdAt,
    });
  }

  return alerts;
}

export async function getDeliveryPendingOrderAlerts(
  deliveryBoyId: string,
): Promise<DeliveryOrderAlert[]> {
  const deliveryObjectId = new mongoose.Types.ObjectId(deliveryBoyId);
  const orderIdSet = new Set<string>();

  const pendingOffers = await DeliveryOrderOffer.find({
    deliveryBoy: deliveryObjectId,
    status: "pending",
  })
    .sort({ notifiedAt: -1 })
    .lean();

  pendingOffers.forEach((offer) => orderIdSet.add(offer.order.toString()));

  const unreadOrderNotifications = await Notification.find({
    recipientType: "Delivery",
    recipientId: deliveryObjectId,
    type: "Order",
    isRead: false,
    link: { $regex: /^\/delivery\/orders\// },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  for (const notification of unreadOrderNotifications) {
    const match = notification.link?.match(/\/delivery\/orders\/([^/?#]+)/);
    if (match?.[1]) {
      orderIdSet.add(match[1]);
    }
  }

  if (orderIdSet.size === 0) return [];

  const orderIds = Array.from(orderIdSet).map((id) => new mongoose.Types.ObjectId(id));
  const orders = await Order.find({
    _id: { $in: orderIds },
    $or: [
      { deliveryBoy: { $exists: false } },
      { deliveryBoy: null },
      { deliveryBoy: deliveryObjectId },
    ],
    status: { $nin: ["Cancelled", "Rejected", "Returned", "Delivered"] },
  }).lean();

  const offerMap = new Map(
    pendingOffers.map((offer) => [offer.order.toString(), offer]),
  );
  const alerts: DeliveryOrderAlert[] = [];

  for (const order of orders) {
    const orderId = order._id.toString();

    const rejectedOffer = await DeliveryOrderOffer.findOne({
      order: order._id,
      deliveryBoy: deliveryObjectId,
      status: "rejected",
    }).lean();

    if (rejectedOffer) {
      continue;
    }

    const offer = offerMap.get(orderId);
    const deliveryBoyEarning =
      offer?.deliveryBoyEarning ??
      (await calculateEstimatedDeliveryBoyEarning(order));

    if (!offer) {
      await upsertDeliveryOrderOffers(orderId, [deliveryBoyId], deliveryBoyEarning);
    }

    alerts.push({
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: {
        address: order.deliveryAddress.address,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        pincode: order.deliveryAddress.pincode,
        landmark: order.deliveryAddress.landmark,
      },
      total: order.total,
      subtotal: order.subtotal,
      shipping: order.shipping,
      deliveryBoyEarning,
      createdAt: order.createdAt?.toISOString?.() || new Date().toISOString(),
      type: order.deliveryOption,
    });
  }

  return alerts;
}

export async function upsertDeliveryOrderOffers(
  orderId: string,
  deliveryBoyIds: string[],
  deliveryBoyEarning: number,
): Promise<void> {
  const orderObjectId = new mongoose.Types.ObjectId(orderId);
  const now = new Date();

  await Promise.all(
    deliveryBoyIds.map((deliveryBoyId) =>
      DeliveryOrderOffer.findOneAndUpdate(
        {
          order: orderObjectId,
          deliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
        },
        {
          $set: {
            status: "pending",
            deliveryBoyEarning,
            notifiedAt: now,
            respondedAt: undefined,
          },
          $setOnInsert: {
            order: orderObjectId,
            deliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
          },
        },
        { upsert: true, new: true },
      ),
    ),
  );
}

export async function markDeliveryOfferRejected(
  orderId: string,
  deliveryBoyId: string,
): Promise<void> {
  await DeliveryOrderOffer.findOneAndUpdate(
    {
      order: new mongoose.Types.ObjectId(orderId),
      deliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
    },
    { $set: { status: "rejected", respondedAt: new Date() } },
  );
}

export async function markDeliveryOfferAccepted(
  orderId: string,
  deliveryBoyId: string,
): Promise<void> {
  const orderObjectId = new mongoose.Types.ObjectId(orderId);

  await DeliveryOrderOffer.updateMany(
    { order: orderObjectId, status: "pending" },
    { $set: { status: "expired", respondedAt: new Date() } },
  );

  await DeliveryOrderOffer.findOneAndUpdate(
    {
      order: orderObjectId,
      deliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
    },
    { $set: { status: "accepted", respondedAt: new Date() } },
    { upsert: true },
  );
}

export async function expireDeliveryOffersForOrder(orderId: string): Promise<void> {
  await DeliveryOrderOffer.updateMany(
    { order: new mongoose.Types.ObjectId(orderId), status: "pending" },
    { $set: { status: "expired", respondedAt: new Date() } },
  );
}

export async function getPendingDeliveryOfferState(orderId: string) {
  const offers = await DeliveryOrderOffer.find({
    order: new mongoose.Types.ObjectId(orderId),
    status: { $in: ["pending", "rejected"] },
  }).lean();

  const allOffers = await DeliveryOrderOffer.find({
    order: new mongoose.Types.ObjectId(orderId),
    status: { $ne: "expired" },
  }).lean();

  if (allOffers.length === 0) return null;

  return {
    orderId,
    notifiedDeliveryBoys: new Set(
      allOffers.map((offer) => offer.deliveryBoy.toString()),
    ),
    rejectedDeliveryBoys: new Set(
      offers
        .filter((offer) => offer.status === "rejected")
        .map((offer) => offer.deliveryBoy.toString()),
    ),
    acceptedBy: null as string | null,
  };
}
