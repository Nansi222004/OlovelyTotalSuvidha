import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import { notifyDeliveryBoysOfNewOrder } from "./orderNotificationService";

type FulfillmentOutcome =
  | "waiting_for_sellers"
  | "all_rejected"
  | "ready_for_delivery"
  | "self_delivery";

interface FulfillmentComputation {
  uniqueSellerIds: string[];
  acceptedSellerIds: string[];
  rejectedSellerIds: string[];
  pendingSellerIds: string[];
  fulfillableItemIds: mongoose.Types.ObjectId[];
  allHaveResponded: boolean;
  anyAccepted: boolean;
  allRejected: boolean;
  outcome: FulfillmentOutcome;
}

function computeFulfillment(order: any, items: any[]): FulfillmentComputation {
  const uniqueSellerIds = [
    ...new Set(items.map((item: any) => item.seller?.toString()).filter(Boolean)),
  ];

  const acceptedSellerIds = [
    ...new Set(
      items
        .filter((item: any) => item.sellerStatus === "Accepted")
        .map((item: any) => item.seller.toString()),
    ),
  ];

  const rejectedSellerIds = [
    ...new Set(
      items
        .filter((item: any) => item.sellerStatus === "Rejected")
        .map((item: any) => item.seller.toString()),
    ),
  ];

  const pendingSellerIds = uniqueSellerIds.filter(
    (sellerId) =>
      !acceptedSellerIds.includes(sellerId) && !rejectedSellerIds.includes(sellerId),
  );

  const fulfillableItemIds = items
    .filter((item: any) => item.sellerStatus === "Accepted" && item.status !== "Cancelled")
    .map((item: any) => item._id as mongoose.Types.ObjectId);

  const allHaveResponded = pendingSellerIds.length === 0;
  const anyAccepted = acceptedSellerIds.length > 0;
  const allRejected = allHaveResponded && rejectedSellerIds.length === uniqueSellerIds.length;

  let outcome: FulfillmentOutcome = "waiting_for_sellers";
  if (allRejected) {
    outcome = "all_rejected";
  } else if (allHaveResponded && anyAccepted) {
    outcome = order.deliveryPreference === "Self" ? "self_delivery" : "ready_for_delivery";
  }

  return {
    uniqueSellerIds,
    acceptedSellerIds,
    rejectedSellerIds,
    pendingSellerIds,
    fulfillableItemIds,
    allHaveResponded,
    anyAccepted,
    allRejected,
    outcome,
  };
}

async function tryStartDeliveryAssignment(orderId: mongoose.Types.ObjectId): Promise<boolean> {
  const lockResult = await Order.findOneAndUpdate(
    {
      _id: orderId,
      deliveryPreference: { $ne: "Self" },
      deliveryBoy: { $exists: false },
      deliveryAssignmentStatus: { $in: ["NotStarted", "Failed"] },
    },
    {
      $set: {
        deliveryAssignmentStatus: "Queued",
        deliveryAssignmentTriggeredAt: new Date(),
      },
    },
    { new: true },
  ).select("_id");

  return Boolean(lockResult);
}

export async function recomputeOrderFulfillment(
  orderId: string,
  io?: SocketIOServer,
): Promise<{
  outcome: FulfillmentOutcome;
  allHaveResponded: boolean;
  anyAccepted: boolean;
  allRejected: boolean;
}> {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const items = await OrderItem.find({ order: order._id }).select(
    "_id seller sellerStatus status",
  );

  const state = computeFulfillment(order, items);

  order.acceptedSellerIds = state.acceptedSellerIds.map(
    (sellerId) => new mongoose.Types.ObjectId(sellerId),
  );
  order.rejectedSellerIds = state.rejectedSellerIds.map(
    (sellerId) => new mongoose.Types.ObjectId(sellerId),
  );
  order.fulfillableItems = state.fulfillableItemIds;

  if (state.allRejected) {
    order.status = "Cancelled";
    order.cancellationReason = order.cancellationReason || "All sellers rejected the order.";
    order.cancelledAt = order.cancelledAt || new Date();
    order.sellerConfirmationStatus = "Rejected";
    order.deliveryAssignmentStatus = "Cancelled";
    order.deliveryAssignmentResolvedAt = new Date();
    await order.save();

    if (io) {
      io.to(`order-${orderId}`).emit("order-status-update", {
        orderId,
        status: "Cancelled",
        message: "Unfortunately, all sellers rejected your order. It has been cancelled.",
      });
    }

    return {
      outcome: "all_rejected",
      allHaveResponded: true,
      anyAccepted: false,
      allRejected: true,
    };
  }

  if (!state.allHaveResponded) {
    order.sellerConfirmationStatus = state.anyAccepted ? "Partial" : "Pending";
    if (state.anyAccepted && order.status !== "Accepted") {
      order.status = "Accepted";
    }
    if (order.deliveryAssignmentStatus === "Queued" || order.deliveryAssignmentStatus === "Searching") {
      order.deliveryAssignmentStatus = "NotStarted";
    }
    await order.save();

    return {
      outcome: "waiting_for_sellers",
      allHaveResponded: false,
      anyAccepted: state.anyAccepted,
      allRejected: false,
    };
  }

  order.status = "Accepted";
  order.sellerConfirmationStatus = "Resolved";
  order.deliveryAssignmentResolvedAt = undefined;
  await order.save();

  if (order.deliveryPreference === "Self") {
    order.deliveryAssignmentStatus = "Cancelled";
    order.deliveryAssignmentResolvedAt = new Date();
    await order.save();

    return {
      outcome: "self_delivery",
      allHaveResponded: true,
      anyAccepted: true,
      allRejected: false,
    };
  }

  // Only trigger delivery boy assignment if deliveryOption is Instant.
  // For Standard delivery, the admin manually assigns a delivery partner.
  const shouldTriggerAssignment = order.deliveryOption === "Instant"
    ? await tryStartDeliveryAssignment(order._id as mongoose.Types.ObjectId)
    : false;

  if (io && state.rejectedSellerIds.length > 0) {
    io.to(`order-${orderId}`).emit("order-partial-rejection", {
      orderId,
      message:
        "Some items in your order were rejected by a seller and have been cancelled. The remaining items will be delivered.",
    });
  }

  if (!shouldTriggerAssignment) {
    if (!["Assigned", "Queued", "Searching"].includes(order.deliveryAssignmentStatus || "")) {
      order.deliveryAssignmentStatus = order.deliveryBoy ? "Assigned" : "NotStarted";
    }
    order.deliveryAssignmentResolvedAt = order.deliveryBoy ? new Date() : order.deliveryAssignmentResolvedAt;
    await order.save();

    return {
      outcome: "ready_for_delivery",
      allHaveResponded: true,
      anyAccepted: true,
      allRejected: false,
    };
  }

  const deliveryOrder = await Order.findById(order._id)
    .populate({
      path: "items",
      match: { sellerStatus: "Accepted", status: { $ne: "Cancelled" } },
      populate: { path: "seller" },
    })
    .lean();

  if (!deliveryOrder || !Array.isArray(deliveryOrder.items) || deliveryOrder.items.length === 0) {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        deliveryAssignmentStatus: "Failed",
      },
    });

    return {
      outcome: "ready_for_delivery",
      allHaveResponded: true,
      anyAccepted: true,
      allRejected: false,
    };
  }

  await Order.findByIdAndUpdate(order._id, {
    $set: {
      deliveryAssignmentStatus: "Searching",
    },
  });

  try {
    if (io) {
      await notifyDeliveryBoysOfNewOrder(io, deliveryOrder);
    }
  } catch (error) {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        deliveryAssignmentStatus: "Failed",
      },
    });
    throw error;
  }

  return {
    outcome: "ready_for_delivery",
    allHaveResponded: true,
    anyAccepted: true,
    allRejected: false,
  };
}
