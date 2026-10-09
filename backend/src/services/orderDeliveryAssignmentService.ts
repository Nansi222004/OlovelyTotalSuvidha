import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Delivery from "../models/Delivery";
import DeliveryAssignment from "../models/DeliveryAssignment";
import Seller from "../models/Seller";
import AppSettings from "../models/AppSettings";
import { calculateDistance } from "../utils/locationHelper";
import { notifyDeliveryBoyOfAssignment } from "./orderNotificationService";

export interface DeliveryActorContext {
  role: "Seller" | "Admin";
  userId: string;
}

export interface FormattedDeliveryPartner {
  _id: any;
  name: string;
  mobile: string;
  email?: string;
  vehicleNumber: string;
  vehicleType: string;
  profileImage: string;
  isOnline: boolean;
  available: string;
  status: string;
  distanceKm: number | null;
  isBusy: boolean;
  activeOrdersCount: number;
}

export async function findOrderForDelivery(orderIdOrNumber: string) {
  if (mongoose.Types.ObjectId.isValid(orderIdOrNumber)) {
    const byId = await Order.findById(orderIdOrNumber);
    if (byId) return byId;
  }
  return await Order.findOne({ orderNumber: orderIdOrNumber });
}

/**
 * Shared available delivery partners retrieval for Seller or Admin.
 * Calculates proximity using Seller store coordinates or canonical Platform Quick Commerce warehouse origin.
 */
export async function getAvailableDeliveryPartnersForOrder(
  orderId: string,
  actor: DeliveryActorContext
): Promise<{ success: boolean; message?: string; statusCode?: number; data?: FormattedDeliveryPartner[] }> {
  const order = await findOrderForDelivery(orderId);
  if (!order) {
    return { success: false, message: "Order not found", statusCode: 404 };
  }

  // Channel guard: Local delivery assignment is only applicable for Quick Commerce orders or orders with QC items
  if (order.orderType === "ECOMMERCE") {
    return {
      success: false,
      message:
        "Local delivery assignment is only applicable for Quick Commerce orders. Ecommerce orders are fulfilled via courier shipping.",
      statusCode: 400,
    };
  }

  let originLat: number | null = null;
  let originLng: number | null = null;

  if (actor.role === "Seller") {
    const sellerItems = await OrderItem.findOne({ order: order._id, seller: actor.userId });
    if (!sellerItems) {
      return {
        success: false,
        message: "You are not authorized to view delivery partners for this order",
        statusCode: 403,
      };
    }

    const seller = await Seller.findById(actor.userId).select("latitude longitude vendorType");
    if (seller?.vendorType === "ECOMMERCE") {
      return {
        success: false,
        message: "ECOMMERCE-only vendors cannot assign local delivery partners. Use courier shipping.",
        statusCode: 400,
      };
    }

    if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
      const qcGroup = order.fulfillmentGroups.find(
        (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
      );
      if (!qcGroup) {
        return {
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
          statusCode: 400,
        };
      }

      const sellerHasQcItem = await OrderItem.exists({
        order: order._id,
        seller: actor.userId,
        _id: { $in: qcGroup.items },
      });
      if (!sellerHasQcItem) {
        return {
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
          statusCode: 400,
        };
      }
    }

    if (seller?.latitude && seller?.longitude) {
      originLat = parseFloat(seller.latitude);
      originLng = parseFloat(seller.longitude);
    }
  } else {
    // Admin context: Platform-owned Quick Commerce
    const hasPlatformQcItems = await OrderItem.exists({
      order: order._id,
      ownerType: "PLATFORM",
      productType: "QUICK_COMMERCE",
      status: { $ne: "Cancelled" },
    });

    const hasQcGroup = (order.fulfillmentGroups || []).some(
      (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
    );

    if (!hasPlatformQcItems && !hasQcGroup && order.orderType !== "QUICK_COMMERCE") {
      return {
        success: false,
        message: "This order does not contain Quick Commerce items requiring local delivery assignment.",
        statusCode: 400,
      };
    }

    // Canonical platform Quick Commerce warehouse origin
    const settings = await AppSettings.findOne().select("platformQuickCommerceFulfillment").lean();
    const platLoc = settings?.platformQuickCommerceFulfillment;
    if (platLoc?.latitude && platLoc?.longitude) {
      originLat = Number(platLoc.latitude);
      originLng = Number(platLoc.longitude);
    }
  }

  // Fetch active & online delivery partners
  const deliveryBoys = await Delivery.find({
    status: "Active",
    isOnline: true,
    available: "Available",
  }).select(
    "name mobile email vehicleNumber vehicleType isOnline available status location profileImage"
  );

  // Count active in-progress orders for each delivery boy
  const busyOrders = await Order.find({
    deliveryBoy: { $in: deliveryBoys.map((d) => d._id) },
    deliveryBoyStatus: { $in: ["Assigned", "Picked Up", "In Transit"] },
    status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
  }).select("deliveryBoy");

  const riderOrderCounts: Record<string, number> = {};
  busyOrders.forEach((o) => {
    const id = o.deliveryBoy?.toString();
    if (id) {
      riderOrderCounts[id] = (riderOrderCounts[id] || 0) + 1;
    }
  });

  const formattedRiders: FormattedDeliveryPartner[] = deliveryBoys.map((rider) => {
    let distanceKm: number | null = null;
    if (
      originLat !== null &&
      originLng !== null &&
      rider.location?.coordinates &&
      rider.location.coordinates.length === 2
    ) {
      const [riderLng, riderLat] = rider.location.coordinates;
      distanceKm = Math.round(calculateDistance(originLat, originLng, riderLat, riderLng) * 10) / 10;
    }

    const activeOrdersCount = riderOrderCounts[rider._id.toString()] || 0;
    const isBusy = activeOrdersCount > 0;

    return {
      _id: rider._id,
      name: rider.name,
      mobile: rider.mobile,
      email: rider.email,
      vehicleNumber: rider.vehicleNumber || "",
      vehicleType: rider.vehicleType || "Bike",
      profileImage: rider.profileImage || "",
      isOnline: rider.isOnline,
      available: rider.available,
      status: rider.status,
      distanceKm,
      isBusy,
      activeOrdersCount,
    };
  });

  // Sort: Available non-busy riders first, then by distance ascending
  formattedRiders.sort((a, b) => {
    if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    success: true,
    data: formattedRiders,
  };
}

/**
 * Shared delivery partner assignment for Seller or Admin.
 * Atomically updates Order, updates LOCAL_DELIVERY fulfillment group, logs assignment, and notifies driver.
 */
export async function assignDeliveryPartnerToOrder(
  orderId: string,
  deliveryBoyId: string,
  actor: DeliveryActorContext,
  io?: SocketIOServer
): Promise<{ success: boolean; message: string; statusCode?: number; data?: any }> {
  if (!deliveryBoyId) {
    return { success: false, message: "Delivery partner ID is required", statusCode: 400 };
  }

  const order = await findOrderForDelivery(orderId);
  if (!order) {
    return { success: false, message: "Order not found", statusCode: 404 };
  }

  // Channel guard
  if (order.orderType === "ECOMMERCE") {
    return {
      success: false,
      message:
        "Local delivery assignment is only applicable for Quick Commerce orders. Ecommerce orders are fulfilled via courier shipping.",
      statusCode: 400,
    };
  }

  // Authorization check
  if (actor.role === "Seller") {
    const sellerItems = await OrderItem.findOne({ order: order._id, seller: actor.userId });
    if (!sellerItems) {
      return {
        success: false,
        message: "You are not authorized to assign delivery for this order",
        statusCode: 403,
      };
    }

    const seller = await Seller.findById(actor.userId).select("vendorType");
    if (seller?.vendorType === "ECOMMERCE") {
      return {
        success: false,
        message: "ECOMMERCE-only vendors cannot assign local delivery partners. Use courier shipping.",
        statusCode: 400,
      };
    }

    if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
      const qcGroup = order.fulfillmentGroups.find(
        (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
      );
      if (!qcGroup) {
        return {
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
          statusCode: 400,
        };
      }

      const sellerHasQcItem = await OrderItem.exists({
        order: order._id,
        seller: actor.userId,
        _id: { $in: qcGroup.items },
      });
      if (!sellerHasQcItem) {
        return {
          success: false,
          message: "Your items in this order are fulfilled via Courier Shipping. Local delivery partners cannot be assigned.",
          statusCode: 400,
        };
      }
    }
  } else {
    // Admin context: Must have QC items
    const hasPlatformQcItems = await OrderItem.exists({
      order: order._id,
      ownerType: "PLATFORM",
      productType: "QUICK_COMMERCE",
      status: { $ne: "Cancelled" },
    });

    const hasQcGroup = (order.fulfillmentGroups || []).some(
      (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
    );

    if (!hasPlatformQcItems && !hasQcGroup && order.orderType !== "QUICK_COMMERCE") {
      return {
        success: false,
        message: "This order does not contain Quick Commerce items requiring local delivery assignment.",
        statusCode: 400,
      };
    }
  }

  if (["Delivered", "Cancelled", "Rejected", "Returned"].includes(order.status)) {
    return {
      success: false,
      message: `Cannot assign delivery partner to order with status ${order.status}`,
      statusCode: 400,
    };
  }

  // Verify delivery boy exists and is active
  const deliveryBoy = await Delivery.findById(deliveryBoyId);
  if (!deliveryBoy) {
    return { success: false, message: "Delivery partner not found", statusCode: 404 };
  }

  if (deliveryBoy.status !== "Active") {
    return { success: false, message: "Delivery partner is not active", statusCode: 400 };
  }

  // Check if order is already assigned to a different rider
  if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryBoyId.toString()) {
    return {
      success: false,
      message: "Order is already assigned to another delivery partner",
      statusCode: 409,
    };
  }

  const nextStatus =
    order.status === "Pending" || order.status === "Received" || order.status === "Accepted"
      ? "Processed"
      : order.status;

  // Update LOCAL_DELIVERY group with assigned rider while keeping COURIER_SHIPPING groups untouched
  const updatedFulfillmentGroups = (order.fulfillmentGroups || []).map((fg: any) => {
    const fgObj = fg.toObject ? fg.toObject() : { ...fg };
    if (fgObj.fulfillmentType === "LOCAL_DELIVERY") {
      return {
        ...fgObj,
        deliveryBoy: deliveryBoyId,
        status: fgObj.status === "Pending" ? "Processing" : fgObj.status,
      };
    }
    return fgObj;
  });

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        { deliveryBoy: null },
        { deliveryBoy: { $exists: false } },
        { deliveryBoy: deliveryBoyId },
      ],
      status: { $nin: ["Delivered", "Cancelled", "Rejected", "Returned"] },
    },
    {
      $set: {
        deliveryBoy: deliveryBoyId,
        deliveryBoyStatus: "Assigned",
        assignedAt: new Date(),
        deliveryPreference: actor.role === "Seller" ? "Self" : "Admin",
        deliveryAssignmentStatus: "Assigned",
        deliveryAssignmentResolvedAt: new Date(),
        status: nextStatus,
        fulfillmentGroups: updatedFulfillmentGroups,
      },
    },
    { new: true }
  )
    .populate("customer", "name email phone")
    .populate("deliveryBoy", "name mobile email vehicleNumber vehicleType")
    .populate("fulfillmentGroups.deliveryBoy", "name mobile email vehicleNumber vehicleType")
    .populate("items");

  if (!updatedOrder) {
    const currentOrder = await Order.findById(order._id);
    if (currentOrder?.deliveryBoy && currentOrder.deliveryBoy.toString() !== deliveryBoyId.toString()) {
      return {
        success: false,
        message: "Order was already assigned to another delivery partner",
        statusCode: 409,
      };
    }
    return { success: false, message: "Failed to assign delivery partner", statusCode: 400 };
  }

  // Create or update delivery assignment record
  await DeliveryAssignment.findOneAndUpdate(
    { order: order._id },
    {
      order: order._id,
      deliveryBoy: deliveryBoyId,
      assignedAt: new Date(),
      assignedBy: actor.userId,
      status: "Assigned",
    },
    { upsert: true, new: true }
  );

  // Trigger notification to delivery boy & broadcast order update
  if (io) {
    notifyDeliveryBoyOfAssignment(io, updatedOrder, deliveryBoyId);

    io.to(`order-${order._id}`).emit("order-updated", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      deliveryBoy: deliveryBoyId,
      deliveryBoyName: deliveryBoy.name,
      deliveryBoyPhone: deliveryBoy.mobile,
      status: updatedOrder.status,
      deliveryBoyStatus: "Assigned",
      deliveryAssignmentStatus: "Assigned",
    });
  }

  return {
    success: true,
    message: "Delivery partner assigned successfully",
    data: updatedOrder,
  };
}
