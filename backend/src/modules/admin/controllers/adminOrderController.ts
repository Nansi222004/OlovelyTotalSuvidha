import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Delivery from "../../../models/Delivery";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Return from "../../../models/Return";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { Server as SocketIOServer } from "socket.io";
import { notifyDeliveryBoyOfAssignment } from "../../../services/orderNotificationService";
import {
  calculateCODOrderBreakdown,
  getOrderEarningBreakdown as getOrderEarningBreakdownService,
} from "../../../services/commissionService";
import Seller from "../../../models/Seller";
import { createApprovedReturnLogistics, ReturnLogisticsError } from "../../../services/returnShippingService";
import { recordReturn } from "../../../services/inventoryService";
import {
  canonicalizeOrderStatus,
  validateOrderStatusTransition,
} from "../../../services/orderStatusTransitionService";
import {
  assignDeliveryPartnerToOrder,
  getAvailableDeliveryPartnersForOrder,
} from "../../../services/orderDeliveryAssignmentService";

/**
 * Get all orders with filters
 */
export const getAllOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      seller,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const query: any = { status: { $ne: "Pending" } };

    if (status) {
      if (status === "Tracking") {
        query.deliveryBoy = { $exists: true, $ne: null };
        query.status = {
          $nin: ["Delivered", "Cancelled", "Rejected", "Returned"],
        };
      } else {
        query.status = status;
      }
    }
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search as string, $options: "i" } },
        { customerName: { $regex: search as string, $options: "i" } },
        { customerEmail: { $regex: search as string, $options: "i" } },
        { customerPhone: { $regex: search as string, $options: "i" } },
      ];
    }

    // If seller filter, need to check order items
    if (seller) {
      const orderItems = await OrderItem.find({ seller }).distinct("order");
      query._id = { $in: orderItems };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customer", "name email phone")
        .populate("deliveryBoy", "name mobile")
        .populate({
          path: "items",
          populate: {
            path: "seller",
            select: "sellerName storeName",
          },
        })
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  },
);

/**
 * Settlement page: list delivered orders with COD breakdown (admin view).
 * Recent COD Self-assign delivery orders appear at top; then by orderDate desc.
 */
export const getSettlementOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 20 } = req.query;
    const match: any = { status: "Delivered", paymentMethod: "COD" };
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitNum = parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $addFields: {
            sortCodSelf: {
              $cond: [
                { $and: [{ $eq: ["$paymentMethod", "COD"] }, { $eq: ["$deliveryPreference", "Self"] }] },
                1,
                0,
              ],
            },
          },
        },
        { $sort: { sortCodSelf: -1, orderDate: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        { $lookup: { from: "deliveries", localField: "deliveryBoy", foreignField: "_id", as: "deliveryBoyDoc" } },
        { $unwind: { path: "$deliveryBoyDoc", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            orderNumber: 1,
            orderDate: 1,
            paymentMethod: 1,
            total: 1,
            shipping: 1,
            deliveryPreference: 1,
            status: 1,
            deliveryBoy: { $ifNull: ["$deliveryBoyDoc", null] },
          },
        },
      ]),
      Order.countDocuments(match),
    ]);

    const ordersWithBreakdown = await Promise.all(
      orders.map(async (order: any) => {
        let codBreakdown = null;
        if (order.paymentMethod === "COD") {
          try {
            codBreakdown = await calculateCODOrderBreakdown(order._id.toString());
            codBreakdown = {
              ...codBreakdown,
              sellerEarningsList: Array.from(codBreakdown.sellerEarnings.entries()).map(
                ([sellerId, amount]) => ({ sellerId, amount }),
              ),
              note: codBreakdown.isSelfAssign
                ? "Self Assign: Delivery boy has no share. Delivery charge goes to seller(s)."
                : undefined,
            };
          } catch {
            // ignore
          }
        }
        return { order, codBreakdown };
      }),
    );

    return res.status(200).json({
      success: true,
      data: { orders: ordersWithBreakdown, total, page: parseInt(page as string), limit: parseInt(limit as string), pages: Math.ceil(total / parseInt(limit as string)) },
    });
  },
);

/**
 * Get COD order breakdown (admin view: seller earnings, admin commission, delivery boy / Self Assign note)
 */
export const getOrderCODBreakdown = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await Order.findById(id).select("paymentMethod deliveryPreference");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "COD breakdown is only available for COD orders",
      });
    }
    const breakdown = await calculateCODOrderBreakdown(id);
    const sellerEarningsList = Array.from(breakdown.sellerEarnings.entries()).map(
      ([sellerId, amount]) => ({ sellerId, amount }),
    );
    return res.status(200).json({
      success: true,
      data: {
        ...breakdown,
        sellerEarningsList,
        note: breakdown.isSelfAssign
          ? "Self Assign: Delivery boy has no share. Delivery charge goes to seller(s)."
          : undefined,
      },
    });
  },
);

/**
 * Get earning breakdown for any order (COD or Online): admin commission, seller earnings, delivery split
 */
export const getOrderEarningBreakdown = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await Order.findById(id).select("paymentMethod deliveryPreference");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const breakdown = await getOrderEarningBreakdownService(id);
    const sellerEarningsList = await Promise.all(
      Array.from(breakdown.sellerEarnings.entries()).map(
        async ([sellerId, amount]) => {
          const seller = await Seller.findById(sellerId).select("sellerName storeName").lean();
          const name = seller?.storeName || seller?.sellerName || sellerId;
          return { sellerId, amount, sellerName: name };
        },
      ),
    );
    const { sellerEarnings: _m, ...rest } = breakdown as any;
    const payload = {
      ...rest,
      sellerEarningsList,
      note: breakdown.isSelfAssign
        ? "Self Assign: Delivery charge goes to seller(s). Delivery boy has no share."
        : "Delivery partner gets delivery share; rest is admin.",
    };
    return res.status(200).json({ success: true, data: payload });
  },
);

/**
 * Get order by ID
 */
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const orderQuery = isObjectId ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id };

    const order = await Order.findOne(orderQuery)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email")
      .populate({
        path: "items",
        populate: [
          {
            path: "product",
            select: "productName mainImage",
          },
          {
            path: "seller",
            select: "sellerName storeName",
          },
        ],
      })
      .populate("cancelledBy", "firstName lastName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  },
);

/**
 * Mark COD order as paid to admin (seller/delivery boy paid; order will leave seller settlement pending list)
 */
export const markOrderCODPaid = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await Order.findById(id).select("paymentMethod status codPaidToAdminAt");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentMethod !== "COD") {
      return res.status(400).json({ success: false, message: "Only COD orders can be marked as paid" });
    }
    if (order.codPaidToAdminAt) {
      return res.status(400).json({ success: false, message: "COD for this order is already marked as paid" });
    }
    order.codPaidToAdminAt = new Date();
    await order.save();
    return res.status(200).json({
      success: true,
      message: "COD marked as received. Order will no longer appear in seller pending settlement.",
      data: { orderId: order._id, codPaidToAdminAt: order.codPaidToAdminAt },
    });
  },
);

/**
 * Update order status with authoritative state transition validation
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, adminNotes, fulfillmentScope, deliveryPreference } = req.body;

    const canonicalStatus = canonicalizeOrderStatus(status);
    if (!canonicalStatus) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATUS",
        message: `Invalid status: "${status}"`,
      });
    }

    const existingOrder = await Order.findById(id).populate("items");
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const channel = existingOrder.orderType as any;

    // Check transition validity from existingOrder.status to canonicalStatus
    const transitionCheck = validateOrderStatusTransition(existingOrder.status, canonicalStatus, channel);
    if (!transitionCheck.valid) {
      return res.status(400).json({
        success: false,
        code: transitionCheck.code || "INVALID_STATUS_TRANSITION",
        message: transitionCheck.message,
      });
    }

    // Platform QC items acceptance/rejection
    const hasPlatformQcItems = (existingOrder.items as any[])?.some(
      (it: any) => it.ownerType === "PLATFORM" && it.productType === "QUICK_COMMERCE"
    );

    if (
      (fulfillmentScope === "PLATFORM_QC" || (hasPlatformQcItems && (existingOrder.status === "Received" || existingOrder.status === "Pending"))) &&
      (canonicalStatus === "Accepted" || canonicalStatus === "Rejected")
    ) {
      if (["Cancelled", "Rejected", "Delivered", "Returned"].includes(existingOrder.status)) {
        return res.status(409).json({
          success: false,
          code: "INVALID_STATUS_TRANSITION",
          message: `Order cannot be changed because it is already ${existingOrder.status}`,
        });
      }

      const platformQcFilter = {
        order: existingOrder._id,
        ownerType: "PLATFORM",
        productType: "QUICK_COMMERCE",
        sellerStatus: "Pending",
        status: { $ne: "Cancelled" },
      };

      if (canonicalStatus === "Accepted") {
        await OrderItem.updateMany(platformQcFilter, {
          $set: { sellerStatus: "Accepted" },
        });

        if (deliveryPreference) {
          existingOrder.deliveryPreference = deliveryPreference as "Self" | "Admin";
          if (deliveryPreference === "Self") {
            existingOrder.deliveryBoy = undefined;
          }
          await existingOrder.save();
        }
      } else {
        const pendingPlatformItems = await OrderItem.find(platformQcFilter);

        for (const pendingItem of pendingPlatformItems) {
          const claimedItem = await OrderItem.findOneAndUpdate(
            { _id: pendingItem._id, sellerStatus: "Pending", status: { $ne: "Cancelled" } },
            { $set: { sellerStatus: "Rejected", status: "Cancelled" } },
            { new: false },
          );
          if (!claimedItem) continue;

          try {
            await recordReturn(
              claimedItem.product.toString(),
              claimedItem.variationId?.toString() || null,
              claimedItem.quantity,
              existingOrder._id.toString(),
              claimedItem._id.toString(),
              (req as any).user?.userId,
            );
          } catch (inventoryError) {
            await OrderItem.updateOne(
              { _id: claimedItem._id, sellerStatus: "Rejected", status: "Cancelled" },
              { $set: { sellerStatus: "Pending", status: "Pending" } },
            );
            throw inventoryError;
          }
        }
      }

      const io: SocketIOServer = req.app.get("io");
      const { recomputeOrderFulfillment } = await import("../../../services/orderFulfillmentOrchestrator");
      await recomputeOrderFulfillment(existingOrder._id.toString(), io);

      const updatedOrder = await Order.findById(existingOrder._id)
        .populate("customer", "name email phone")
        .populate("deliveryBoy", "name mobile")
        .populate("items");

      return res.status(200).json({
        success: true,
        message: `Platform Quick Commerce items ${canonicalStatus.toLowerCase()} successfully`,
        data: updatedOrder,
      });
    }

    // Normal valid transitions (Processed, Shipped, Picked up, On the way, Out for Delivery, Delivered, Cancelled)
    const updateData: any = { status: canonicalStatus };
    if (adminNotes) updateData.adminNotes = adminNotes;

    if (canonicalStatus === "Delivered") {
      updateData.deliveredAt = new Date();
      updateData.deliveryBoyStatus = "Delivered";
    }

    if (canonicalStatus === "Cancelled") {
      if (["Delivered", "Cancelled", "Returned"].includes(existingOrder.status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_STATUS_TRANSITION",
          message: `Order cannot be cancelled as it is already ${existingOrder.status}`,
        });
      }

      const { handleOnlineOrderCancellation } = await import(
        "../../../services/refundSettlementService"
      );
      const refundRes = await handleOnlineOrderCancellation(
        existingOrder._id.toString(),
        adminNotes || "Order cancelled by Admin"
      );

      if (!refundRes.success) {
        return res.status(400).json({
          success: false,
          message: `Admin cancellation failed: ${refundRes.message}`,
        });
      }

      updateData.cancelledAt = new Date();
      updateData.cancelledBy = (req as any).user?.userId;
    }

    // Update LOCAL_DELIVERY fulfillment groups if any
    if (existingOrder.fulfillmentGroups && existingOrder.fulfillmentGroups.length > 0) {
      updateData.fulfillmentGroups = existingOrder.fulfillmentGroups.map((fg: any) => {
        const fgObj = fg.toObject ? fg.toObject() : { ...fg };
        if (fgObj.fulfillmentType === "LOCAL_DELIVERY") {
          if (canonicalStatus === "Processed" && fgObj.status === "Pending") {
            fgObj.status = "Processing";
          } else if (canonicalStatus === "Picked up" || canonicalStatus === "Shipped") {
            fgObj.status = "Shipped";
          } else if (canonicalStatus === "Out for Delivery" || canonicalStatus === "On the way") {
            fgObj.status = "OutForDelivery";
          } else if (canonicalStatus === "Delivered") {
            fgObj.status = "Delivered";
          } else if (canonicalStatus === "Cancelled") {
            fgObj.status = "Cancelled";
          }
        }
        return fgObj;
      });
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .populate("items");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Release first-order free shipping claim if order is Cancelled or Rejected
    if ((canonicalStatus === "Cancelled" || canonicalStatus === "Rejected") && order.firstOrderFreeShippingApplied) {
      try {
        const { releaseFirstOrderFreeShippingClaim } = await import("../../../services/shipping/shippingPromotionService");
        const custId = (order.customer as any)?._id || order.customer;
        await releaseFirstOrderFreeShippingClaim(custId);
      } catch (relErr) {
        console.error("Error releasing first order free shipping claim on admin cancel/reject:", relErr);
      }
    }

    const io: SocketIOServer = req.app.get("io");

    // Distribute commissions if order is delivered
    if (canonicalStatus === "Delivered" && existingOrder.status !== "Delivered") {
      try {
        if (order.paymentMethod && order.paymentMethod.toUpperCase() === "COD") {
          const { processCODOrderDelivery } = await import("../../../services/commissionService");
          await processCODOrderDelivery(id, undefined, order.deliveryBoy?.toString());
        } else {
          const { distributeCommissions } = await import("../../../services/commissionService");
          await distributeCommissions(id);
        }
      } catch (error) {
        console.error("Error distributing commissions:", error);
      }
    }

    // Real-time broadcast
    if (io) {
      io.to(`order-${order._id}`).emit("order-updated", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryBoyStatus: order.deliveryBoyStatus,
      });
    }

    // Notify customer of order status change (idempotently with eventId)
    if (order.customer && existingOrder.status !== canonicalStatus) {
      try {
        const { sendOrderStatusNotification } = await import(
          "../../../services/notificationService"
        );
        const customerId = (order.customer as any)._id?.toString() || order.customer.toString();
        sendOrderStatusNotification(order._id.toString(), customerId, canonicalStatus, io).catch((e) =>
          console.error("Error sending customer order status notification:", e)
        );
      } catch (notifErr) {
        console.error("Error importing notificationService:", notifErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  },
);

/**
 * Get available delivery partners for order (Admin manual assignment)
 */
export const getAvailableDeliveryPartners = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await getAvailableDeliveryPartnersForOrder(id, {
      role: "Admin",
      userId: (req as any).user?.userId || "admin",
    });
    return res.status(result.statusCode || 200).json(result);
  },
);

/**
 * Assign delivery boy to order (Admin manual assignment)
 */
export const assignDeliveryBoy = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { deliveryBoyId } = req.body;
    const io: SocketIOServer = req.app.get("io");
    const result = await assignDeliveryPartnerToOrder(
      id,
      deliveryBoyId,
      { role: "Admin", userId: (req as any).user?.userId || "admin" },
      io
    );
    return res.status(result.statusCode || 200).json(result);
  },
);

/**
 * Get orders by status
 */
export const getOrdersByStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const validStatuses = [
      "Received",
      "Accepted",
      "Pending",
      "Processed",
      "Shipped",
      "Picked up",
      "On the way",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Rejected",
      "Returned",
    ];

    const matchedStatus = validStatuses.find(
      (s) => s.toLowerCase() === status.toLowerCase()
    );

    if (!matchedStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Support both 'Out for Delivery' and 'Out For Delivery' in query
    const statusQuery = matchedStatus === "Out for Delivery"
      ? { $in: ["Out for Delivery", "Out For Delivery"] }
      : matchedStatus;

    const [orders, total] = await Promise.all([
      Order.find({ status: statusQuery })
        .populate("customer", "name email phone")
        .populate("deliveryBoy", "name mobile")
        .populate("items")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments({ status: statusQuery }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Orders with status ${status} fetched successfully`,
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  },
);

/**
 * Get all return requests
 */
export const getReturnRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      seller,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Date filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo as string);
      }
    }

    // Search filter (complex because we need to search populated fields)
    // For now, simpler implementation - search by order ID or return reason or customer
    if (search) {
      // Find orders matching search first
      const orders = await Order.find({
        orderNumber: { $regex: search as string, $options: "i" },
      }).select("_id");
      const orderIds = orders.map((o) => o._id);

      query.$or = [
        { order: { $in: orderIds } },
        { reason: { $regex: search as string, $options: "i" } },
        { description: { $regex: search as string, $options: "i" } },
      ];
    }

    // Seller filter requires looking up order items
    if (seller && seller !== "all") {
      // Find order items for this seller
      const orderItems = await OrderItem.find({ seller }).select("_id");
      const orderItemIds = orderItems.map((oi) => oi._id);
      query.orderItem = { $in: orderItemIds };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const [requests, total] = await Promise.all([
      Return.find(query)
        .populate("order", "orderNumber")
        .populate("customer", "name email phone")
        .populate({
          path: "orderItem",
          populate: {
            path: "product",
            select: "productName mainImage",
          },
        })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Return.countDocuments(query),
    ]);

    // Transform logic to match frontend expectations if necessary
    // AdminReturnRequest.tsx expects: _id, orderItemId, userName, productName, variant, price, quantity, total, status, requestedAt
    // It seems flattened. Let's send structured data and let frontend handle it, or flatten it here.
    // The frontend uses "request.orderItemId", "request.userName", "request.productName" etc.
    // This implies a flattened structure.

    const transformedRequests = requests.map((req: any) => ({
      _id: req._id,
      orderId: req.order?._id,
      orderNumber: req.order?.orderNumber,
      orderItemId: req.orderItem?._id, // Frontend displays this
      userId: req.customer?._id,
      userName: req.customer?.name || "Unknown",
      // product info from orderItem
      productId: req.orderItem?.product?._id,
      productName: req.orderItem?.productName || "Unknown Product",
      variant: req.orderItem?.variation,
      price: req.orderItem?.unitPrice || 0,
      quantity: req.quantity,
      total: req.quantity * (req.orderItem?.unitPrice || 0),
      reason: req.reason,
      status: req.status,
      requestedAt: req.createdAt,
      processedAt: req.processedAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Return requests fetched successfully",
      data: transformedRequests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  },
);

/**
 * Get return request by ID
 */
export const getReturnRequestById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const returnRequest = await Return.findById(id)
      .populate("order")
      .populate("customer", "name email phone")
      .populate({
        path: "orderItem",
        populate: [
          { path: "product", select: "productName mainImage" },
          { path: "seller", select: "sellerName storeName" },
        ],
      })
      .populate("processedBy", "firstName lastName");

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Return request details fetched successfully",
      data: returnRequest,
    });
  },
);

/**
 * Process return request (Update)
 */
export const processReturnRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, rejectionReason, refundAmount, adminNotes } = req.body;

    // Admin can only set: Approved, Rejected (from Pending), or Pickup Pending (from Approved)
    // Full state machine is enforced in returnLifecycleService.
    // Direct admin-editable statuses (subset of full lifecycle):
    const validStatuses = ["Approved", "Rejected", "Pickup Pending"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Admin can only set return status to: ${validStatuses.join(", ")}. Other transitions are performed by delivery partner or seller.`,
      });
    }

    const returnRequest = await Return.findById(id);
    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    // Validate state machine transition
    if (status && !(status === "Approved" && ["Approved", "Reverse Shipment Created", "Pickup Pending"].includes(returnRequest.status))) {
      try {
        const { validateAdminReturnTransition } = await import("../../../services/returnLifecycleService");
        validateAdminReturnTransition(returnRequest.status as any, status as any);
      } catch (transErr: any) {
        return res.status(400).json({ success: false, message: transErr.message });
      }
    }

    const updateData: any = {
      processedBy: (req as any).user?.userId,
      processedAt: new Date(),
    };

    if (status) updateData.status = status;

    // Handle rejection reason
    if (status === "Rejected") {
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
      else if (adminNotes) updateData.rejectionReason = adminNotes;
    }

    // When Admin approves, atomically advance to Pickup Pending
    // so the return never sits stuck in "Approved" without becoming "Pickup Pending"
    if (status === "Approved") {
      updateData.approvedAt = new Date();
      updateData.status = "Pickup Pending"; // Atomic: Approved → Pickup Pending
    }

    let updatedReturn: any;
    if (status === "Approved") {
      try {
        updatedReturn = await createApprovedReturnLogistics(id, undefined, (req as any).user?.userId);
      } catch (error) {
        if (error instanceof ReturnLogisticsError) {
          return res.status(error.statusCode).json({ success: false, code: error.apiCode, message: error.message });
        }
        throw error;
      }
    } else {
      updatedReturn = await Return.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("order")
        .populate("orderItem")
        .populate("customer", "name email phone");
    }

    // ⚠️ FINANCIAL SETTLEMENT: NEVER fires here.
    // Settlement ONLY occurs after seller confirms physical receipt (Handed To Seller → Completed)
    // which is handled by seller/returnController.ts → confirmSellerReceipt()
    // DO NOT add executeReturnRefundAndReversal() here.

    return res.status(200).json({
      success: true,
      message: `Return request ${status ? status.toLowerCase() : "updated"} successfully`,
      data: updatedReturn,
    });
  },
);

/**
 * Export orders to CSV
 */
export const exportOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, dateFrom, dateTo } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }

    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort({ orderDate: -1 })
      .lean();

    // Convert to CSV format
    const csvHeaders = [
      "Order Number",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Order Date",
      "Status",
      "Payment Status",
      "Total Amount",
      "Delivery Address",
      "Delivery Boy",
    ];

    const csvRows = orders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.orderDate.toISOString(),
      order.status,
      order.paymentStatus,
      order.total.toString(),
      `${order.deliveryAddress.address}, ${order.deliveryAddress.city} - ${order.deliveryAddress.pincode}`,
      order.deliveryPreference === 'Self' ? 'Self Assigned' : (order.deliveryBoy ? (order.deliveryBoy as any).name : "Not Assigned"),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders_${Date.now()}.csv`,
    );
    res.send(csvContent);
  },
);

/**
 * Get pending order alerts for Admin (Platform QC orders)
 */
export const getPendingOrderAlerts = asyncHandler(
  async (_req: Request, res: Response) => {
    const { getAdminPendingOrderAlerts } = await import("../../../services/orderAlertService");
    const alerts = await getAdminPendingOrderAlerts();
    return res.status(200).json({
      success: true,
      data: alerts,
    });
  }
);
