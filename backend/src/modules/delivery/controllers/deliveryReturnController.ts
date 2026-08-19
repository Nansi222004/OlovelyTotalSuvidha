/**
 * deliveryReturnController.ts
 *
 * Delivery partner return pickup workflow.
 * Authorization: each action verifies return.deliveryBoy === authenticated DP.
 *
 * Lifecycle (DP portion):
 *   Delivery Partner Assigned → Picked Up → In Transit → Handed To Seller
 *
 * Note: "Handed To Seller" then triggers seller confirmation → Completed → Settlement.
 */

import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Return from "../../../models/Return";
import OrderItem from "../../../models/OrderItem";
import { sendNotification } from "../../../services/notificationService";
import { Server as SocketIOServer } from "socket.io";

// ─────────────────────────────────────────────────────────────────────────────
// Authorization Helper
// ─────────────────────────────────────────────────────────────────────────────

async function assertReturnAssignedToDP(
  returnId: string,
  deliveryBoyId: string
): Promise<any> {
  const returnReq = await Return.findById(returnId);
  if (!returnReq) {
    throw Object.assign(new Error("Return request not found"), { statusCode: 404 });
  }
  if (!returnReq.deliveryBoy || returnReq.deliveryBoy.toString() !== deliveryBoyId) {
    throw Object.assign(
      new Error("This return pickup is not assigned to you."),
      { statusCode: 403 }
    );
  }
  return returnReq;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get Assigned Return Pickups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /delivery/returns
 * Returns list of return pickups assigned to this delivery partner.
 * Filtered by status to show active pickups by default.
 */
export const getAssignedReturns = asyncHandler(async (req: Request, res: Response) => {
  const deliveryBoyId = req.user?.userId;
  const { status = "active", page = 1, limit = 10 } = req.query;

  let statusFilter: any;
  if (status === "active") {
    statusFilter = {
      $in: ["Delivery Partner Assigned", "Picked Up", "In Transit", "Handed To Seller"],
    };
  } else if (status === "completed") {
    statusFilter = "Completed";
  } else if (status === "all") {
    statusFilter = undefined;
  } else {
    statusFilter = status;
  }

  const query: any = { deliveryBoy: deliveryBoyId };
  if (statusFilter !== undefined) query.status = statusFilter;

  const returns = await Return.find(query)
    .populate({
      path: "orderItem",
      populate: { path: "product", select: "productName mainImage" },
    })
    .populate("order", "orderNumber")
    .populate("customer", "name mobile phone")
    .sort({ assignedAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Return.countDocuments(query);

  const formatted = returns.map((r) => {
    const item = r.orderItem as any;
    const order = r.order as any;
    const customer = r.customer as any;
    return {
      _id: r._id.toString(),
      returnId: r._id.toString(),
      orderNumber: order?.orderNumber || "N/A",

      productName: item?.product?.productName || item?.productName || "Product",
      productImage: item?.product?.mainImage,
      customerName: customer?.name || "Customer",
      customerPhone: customer?.mobile || customer?.phone || "N/A",
      quantity: r.quantity,
      reason: r.reason,
      status: r.status,
      assignedAt: r.assignedAt,
      pickedUpAt: r.pickedUpAt,
      inTransitAt: r.inTransitAt,
      handedToSellerAt: r.handedToSellerAt,
      completedAt: r.completedAt,
      pickupOtpVerified: r.pickupOtpVerified,
    };
  });

  return res.status(200).json({
    success: true,
    data: formatted,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Return Detail
// ─────────────────────────────────────────────────────────────────────────────

export const getReturnDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deliveryBoyId = req.user?.userId;

  let returnReq: any;
  try {
    returnReq = await assertReturnAssignedToDP(id, deliveryBoyId!);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }

  const full = await Return.findById(id)
    .populate({ path: "orderItem", populate: [{ path: "product", select: "productName mainImage" }, { path: "seller", select: "sellerName storeName address city latitude longitude" }] })
    .populate("order", "orderNumber deliveryAddress")
    .populate("customer", "name mobile phone")
    .select("+pickupOtp"); // Include OTP for DP

  if (!full) return res.status(404).json({ success: false, message: "Return not found" });

  const { getReturnLifecycleSummary } = await import("../../../services/returnLifecycleService");
  const lifecycle = getReturnLifecycleSummary(full.status as any);

  const item = full.orderItem as any;
  const order = full.order as any;
  const customer = full.customer as any;

  return res.status(200).json({
    success: true,
    data: {
      returnId: full._id,
      status: full.status,
      lifecycle,
      orderNumber: order?.orderNumber,
      pickupAddress: order?.deliveryAddress, // Customer's address (where to pick up)
      vendorAddress: {  // Seller's address (where to deliver)
        name: item?.seller?.storeName || item?.seller?.sellerName,
        address: item?.seller?.address,
        city: item?.seller?.city,
        latitude: item?.seller?.latitude,
        longitude: item?.seller?.longitude,
      },
      customer: { name: customer?.name, phone: customer?.mobile || customer?.phone },
      product: { name: item?.product?.productName || item?.productName, image: item?.product?.mainImage, quantity: full.quantity },
      reason: full.reason,
      pickupOtpVerified: full.pickupOtpVerified,
      assignedAt: full.assignedAt,
      pickedUpAt: full.pickedUpAt,
      inTransitAt: full.inTransitAt,
      handedToSellerAt: full.handedToSellerAt,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Accept Return Assignment
// ─────────────────────────────────────────────────────────────────────────────

export const acceptReturnAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deliveryBoyId = req.user?.userId;

  let returnReq: any;
  try {
    returnReq = await assertReturnAssignedToDP(id, deliveryBoyId!);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }

  if (returnReq.status !== "Delivery Partner Assigned") {
    return res.status(200).json({
      success: true,
      message: `Return is in "${returnReq.status}" status — already beyond acceptance.`,
      data: returnReq,
    });
  }

  // Idempotency: just acknowledge
  return res.status(200).json({
    success: true,
    message: "Return pickup accepted. Please generate the pickup OTP to collect the item from the customer.",
    data: {
      returnId: returnReq._id,
      status: returnReq.status,
      nextStep: "Generate pickup OTP and verify with customer.",
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Generate Pickup OTP
// ─────────────────────────────────────────────────────────────────────────────

export const generateReturnPickupOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryBoyId = req.user?.userId;

    try {
      await assertReturnAssignedToDP(id, deliveryBoyId!);
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    const { generateReturnPickupOtp } = await import("../../../services/returnLifecycleService");
    const result = await generateReturnPickupOtp(id);

    return res.status(200).json(result);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Verify Pickup OTP → Marks "Picked Up"
// ─────────────────────────────────────────────────────────────────────────────

export const verifyReturnPickupOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;
    const deliveryBoyId = req.user?.userId;

    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP is required" });
    }

    try {
      await assertReturnAssignedToDP(id, deliveryBoyId!);
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    try {
      const { verifyReturnPickupOtp } = await import("../../../services/returnLifecycleService");
      const result = await verifyReturnPickupOtp(id, otp);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Emit to customer/admin that item has been picked up
      const io: SocketIOServer = req.app.get("io");
      const returnReq = await Return.findById(id).populate("order", "_id");
      if (io && returnReq) {
        const orderId = (returnReq.order as any)?._id?.toString();
        if (orderId) {
          io.to(`order-${orderId}`).emit("return-picked-up", {
            returnId: id,
            status: "Picked Up",
            message: "The delivery partner has collected your item.",
          });
        }
      }

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mark In Transit
// ─────────────────────────────────────────────────────────────────────────────

export const markReturnInTransit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deliveryBoyId = req.user?.userId;

  let returnReq: any;
  try {
    returnReq = await assertReturnAssignedToDP(id, deliveryBoyId!);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }

  // Idempotency
  if (returnReq.status === "In Transit") {
    return res.status(200).json({ success: true, message: "Return is already In Transit (idempotent).", data: returnReq });
  }

  try {
    const { validateDPReturnTransition } = await import("../../../services/returnLifecycleService");
    validateDPReturnTransition(returnReq.status, "In Transit");
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }

  returnReq.status = "In Transit";
  returnReq.inTransitAt = new Date();
  await returnReq.save();

  // Notify customer and admin
  const io: SocketIOServer = req.app.get("io");
  if (io) {
    const order = returnReq.order as any;
    const orderId = order?._id?.toString() || order?.toString();
    if (orderId) {
      io.to(`order-${orderId}`).emit("return-in-transit", {
        returnId: id,
        status: "In Transit",
        message: "Your returned item is on the way to the seller.",
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: "Return marked as In Transit. Proceed to seller location.",
    data: { returnId: id, status: returnReq.status, inTransitAt: returnReq.inTransitAt },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Mark Handed To Seller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delivery partner reaches the vendor and hands over the returned item.
 * This sets the status to "Handed To Seller" and notifies the seller to confirm receipt.
 * The seller then calls confirmSellerReceipt() → Completed → Financial Settlement.
 */
export const markHandedToSeller = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deliveryBoyId = req.user?.userId;

  let returnReq: any;
  try {
    returnReq = await assertReturnAssignedToDP(id, deliveryBoyId!);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }

  // Idempotency
  if (returnReq.status === "Handed To Seller") {
    return res.status(200).json({ success: true, message: "Return already marked as Handed To Seller (idempotent).", data: returnReq });
  }

  try {
    const { validateDPReturnTransition } = await import("../../../services/returnLifecycleService");
    validateDPReturnTransition(returnReq.status, "Handed To Seller");
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }

  returnReq.status = "Handed To Seller";
  returnReq.handedToSellerAt = new Date();
  await returnReq.save();

  // Get seller info to notify them
  const orderItem = await OrderItem.findById(returnReq.orderItem).select("seller").populate("seller", "_id");
  const sellerId = orderItem ? (orderItem.seller as any)?._id?.toString() || orderItem.seller?.toString() : null;

  // Emit to seller asking for confirmation
  const io: SocketIOServer = req.app.get("io");
  if (io && sellerId) {
    io.to(`seller-${sellerId}`).emit("return-handed-to-seller", {
      returnId: id,
      status: "Handed To Seller",
      message: "A returned item has been handed to your store. Please confirm receipt.",
    });
  }

  // Push notification to seller
  if (sellerId) {
    const orderDoc = await (await import("../../../models/Order")).default.findById(returnReq.order).select("orderNumber");
    await sendNotification(
      "Seller",
      sellerId,
      "Returned Item Received",
      `A returned item for Order #${orderDoc?.orderNumber || "N/A"} has been delivered to your store. Please confirm receipt to complete the return.`,
      {
        type: "Order",
        link: `/seller/returns/${id}`,
        priority: "High",
        data: { returnId: id, type: "CONFIRM_RECEIPT" },
      }
    ).catch((err) => console.error(`[Return Handoff Notif Error] Seller ${sellerId}:`, err.message));
  }

  // Also notify customer
  if (io) {
    const order = returnReq.order as any;
    const orderId = order?._id?.toString() || order?.toString();
    if (orderId) {
      io.to(`order-${orderId}`).emit("return-at-seller", {
        returnId: id,
        status: "Handed To Seller",
        message: "Your returned item has reached the seller. Awaiting seller confirmation.",
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: "Return marked as Handed To Seller. Seller has been notified to confirm receipt.",
    data: { returnId: id, status: returnReq.status, handedToSellerAt: returnReq.handedToSellerAt },
  });
});
