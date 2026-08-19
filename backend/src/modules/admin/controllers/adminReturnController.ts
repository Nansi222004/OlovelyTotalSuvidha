/**
 * adminReturnController.ts
 *
 * Admin return management: view returns, assign delivery partner for pickup.
 * Financial settlement is NOT triggered here — only after physical completion
 * (seller confirms receipt in seller/returnController.ts → confirmSellerReceipt).
 */

import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Return from "../../../models/Return";
import Delivery from "../../../models/Delivery";
import OrderItem from "../../../models/OrderItem";
import { sendNotification } from "../../../services/notificationService";
import { Server as SocketIOServer } from "socket.io";

/**
 * List returns awaiting delivery partner assignment (status = "Pickup Pending")
 * Also supports listing by any status for admin visibility.
 */
export const getAdminReturns = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    status,
    search = "",
    dateFrom,
    dateTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query: any = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
    if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
  }

  if (search) {
    const matchingOrders = await (await import("../../../models/Order")).default
      .find({ orderNumber: { $regex: search as string, $options: "i" } })
      .select("_id");
    query.$or = [
      { order: { $in: matchingOrders.map((o) => o._id) } },
      { reason: { $regex: search as string, $options: "i" } },
    ];
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const [returns, total] = await Promise.all([
    Return.find(query)
      .populate("order", "orderNumber")
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .populate({
        path: "orderItem",
        populate: { path: "product", select: "productName mainImage" },
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit as string)),
    Return.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    data: returns,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

/**
 * Get a single return with full lifecycle detail
 */
export const getAdminReturnById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const returnReq = await Return.findById(id)
    .populate("order")
    .populate("customer", "name email phone")
    .populate("deliveryBoy", "name mobile email city")
    .populate({
      path: "orderItem",
      populate: [
        { path: "product", select: "productName mainImage" },
        { path: "seller", select: "sellerName storeName" },
      ],
    })
    .populate("processedBy", "firstName lastName");

  if (!returnReq) {
    return res.status(404).json({ success: false, message: "Return request not found" });
  }

  const { getReturnLifecycleSummary } = await import("../../../services/returnLifecycleService");
  const lifecycle = getReturnLifecycleSummary(returnReq.status as any);

  return res.status(200).json({
    success: true,
    data: { ...returnReq.toObject(), lifecycle },
  });
});

/**
 * List available delivery partners for admin to assign for return pickup
 */
export const getAvailableDeliveryPartnersForReturn = asyncHandler(
  async (req: Request, res: Response) => {
    const { city } = req.query;

    const query: any = { status: "Active" };
    if (city) {
      const escaped = (city as string).trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      query.city = { $regex: new RegExp(`^\\s*${escaped}\\s*$`, "i") };
    }

    const deliveryPartners = await Delivery.find(query)
      .select("name mobile email city isOnline balance")
      .sort({ isOnline: -1, name: 1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: deliveryPartners,
    });
  }
);

/**
 * Assign a delivery partner to a return pickup.
 *
 * Allowed transition: "Pickup Pending" → "Delivery Partner Assigned"
 * Financial settlement: NOT triggered here.
 */
export const assignDeliveryPartnerToReturn = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({ success: false, message: "deliveryBoyId is required" });
    }

    const returnReq = await Return.findById(id)
      .populate("order", "orderNumber")
      .populate("customer", "name")
      .populate({ path: "orderItem", populate: { path: "product", select: "productName" } });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    // Validate state transition
    try {
      const { validateAdminReturnTransition } = await import("../../../services/returnLifecycleService");
      validateAdminReturnTransition(returnReq.status as any, "Delivery Partner Assigned");
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }

    // Verify delivery partner exists and is active
    const deliveryPartner = await Delivery.findById(deliveryBoyId).select("name mobile status");
    if (!deliveryPartner) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }
    if (deliveryPartner.status !== "Active") {
      return res.status(400).json({ success: false, message: "Delivery partner is not active" });
    }

    // Idempotency: if already assigned to same DP, return success
    if (
      returnReq.deliveryBoy &&
      returnReq.deliveryBoy.toString() === deliveryBoyId &&
      returnReq.status === "Delivery Partner Assigned"
    ) {
      return res.status(200).json({
        success: true,
        message: "Return already assigned to this delivery partner (idempotent)",
        data: returnReq,
      });
    }

    // Apply assignment
    returnReq.deliveryBoy = deliveryBoyId as any;
    returnReq.assignedAt = new Date();
    returnReq.status = "Delivery Partner Assigned";
    returnReq.processedBy = req.user?.userId as any;
    returnReq.processedAt = new Date();
    await returnReq.save();

    const orderDoc = returnReq.order as any;
    const productDoc = (returnReq.orderItem as any)?.product;

    // Emit socket notification to delivery partner
    const io: SocketIOServer = req.app.get("io");
    if (io) {
      const returnData = {
        returnId: returnReq._id.toString(),
        orderNumber: orderDoc?.orderNumber || "N/A",
        productName: productDoc?.productName || "Product",
        customerName: (returnReq.customer as any)?.name || "Customer",
        quantity: returnReq.quantity,
        reason: returnReq.reason,
        type: "RETURN_PICKUP",
      };
      io.to(`delivery-${deliveryBoyId}`).emit("return-pickup-assigned", returnData);
    }

    // Send DB + FCM push notification to delivery partner
    const orderNumber = orderDoc?.orderNumber || "N/A";
    await sendNotification(
      "Delivery",
      deliveryBoyId,
      "Return Pickup Assigned",
      `You have been assigned to pick up a return for Order #${orderNumber}. Please collect the item from the customer.`,
      {
        type: "Order",
        link: `/delivery/returns/${returnReq._id}`,
        priority: "High",
        data: {
          returnId: returnReq._id.toString(),
          type: "RETURN_PICKUP",
          panel: "delivery",
        },
      }
    ).catch((err) =>
      console.error(`[Return Assignment Notif Error] DP ${deliveryBoyId}:`, err.message)
    );

    const updated = await Return.findById(id)
      .populate("order", "orderNumber")
      .populate("customer", "name phone")
      .populate("deliveryBoy", "name mobile");

    return res.status(200).json({
      success: true,
      message: `Delivery partner ${deliveryPartner.name} assigned to return pickup successfully`,
      data: updated,
    });
  }
);

/**
 * Get order item details for a specific return (helper for admin UI)
 */
export const getReturnOrderItemDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const returnReq = await Return.findById(id).populate({
      path: "orderItem",
      populate: [
        { path: "product", select: "productName mainImage" },
        { path: "seller", select: "sellerName storeName address city" },
      ],
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: "Return not found" });
    }

    return res.status(200).json({ success: true, data: returnReq.orderItem });
  }
);
