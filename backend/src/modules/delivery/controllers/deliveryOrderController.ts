import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import {
  generateDeliveryOtp,
  verifyDeliveryOtp,
} from "../../../services/deliveryOtpService";
import { processOrderStatusTransition } from "../../../services/orderService";
import { getDeliveryPendingOrderAlerts } from "../../../services/orderAlertService";
import { formatDeliveryAddress } from "../../../utils/addressUtils";
import { getDeliveryPartnerQcContext } from "../utils/deliveryOrderScopingHelper";

/**
 * Get pending delivery order alerts (survives page refresh).
 */
export const getPendingOrderAlerts = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    if (!deliveryId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const alerts = await getDeliveryPendingOrderAlerts(deliveryId);

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  },
);

/**
 * Helper to map order items for response
 */
const mapOrderItems = (items: any[]) => {
  if (!items || !Array.isArray(items)) return [];
  return items.map((item: any) => {
    const qty = item.quantity || 0;
    const itemTotal = typeof item.total === "number" && !isNaN(item.total) ? item.total : 0;
    const unitPrice = item.unitPrice != null
      ? item.unitPrice
      : (qty > 0 && itemTotal > 0 ? itemTotal / qty : itemTotal);

    return {
      id: item._id,
      name: item.productName || "Unknown Item",
      quantity: qty,
      price: unitPrice,
      unitPrice: unitPrice,
      total: itemTotal,
      image: item.productImage,
      variation: item.variation,
      variantTitle: item.variantTitle,
      sku: item.sku,
    };
  });
};

/**
 * Get All Orders History
 * Returns all past orders with pagination
 */
export const getAllOrdersHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const orders = await Order.find({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
    })
      .populate("items") // Populate OrderItems
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
    });

    // Batched Commission Fetch for Efficiency
    const { default: Commission } = await import("../../../models/Commission");
    const orderIds = orders.map((o) => o._id);
    const commissions = await Commission.find({
      order: { $in: orderIds },
      type: "DELIVERY_BOY",
    });

    const commissionMap = new Map();
    commissions.forEach((c) => {
      commissionMap.set(c.order.toString(), c.commissionAmount);
    });

    // Format orders for frontend - only showing assigned QC items and QC subtotal
    const formattedOrders = orders.reduce((acc: any[], order) => {
      const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
      if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
        return acc;
      }

      acc.push({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: qcCtx.displayStatus,

        address: formatDeliveryAddress(order.deliveryAddress).formatted,
        deliveryAddress: order.deliveryAddress,
        totalAmount: qcCtx.assignedQcSubtotal,
        subtotal: qcCtx.assignedQcSubtotal,
        assignedSubtotal: qcCtx.assignedQcSubtotal,
        deliveryEarning: commissionMap.get(order._id.toString()) || 0, // Add Earning
        items: mapOrderItems(qcCtx.assignedQcItems),
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryDate
          ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "N/A",
      });
      return acc;
    }, []);

    res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  },
);

/**
 * Get Today's Assigned Orders
 */
export const getTodayOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
      $or: [
        { createdAt: { $gte: todayStart, $lte: todayEnd } }, // Created today
        { updatedAt: { $gte: todayStart, $lte: todayEnd } }, // OR Updated today
      ],
    })
      .populate("items")
      .sort({ updatedAt: -1 });

    const formattedOrders = orders.reduce((acc: any[], order) => {
      const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
      if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
        return acc;
      }

      acc.push({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: qcCtx.displayStatus,

        address: formatDeliveryAddress(order.deliveryAddress).formatted,
        deliveryAddress: order.deliveryAddress,
        items: mapOrderItems(qcCtx.assignedQcItems), // Real assigned QC items only
        totalAmount: qcCtx.assignedQcSubtotal,
        subtotal: qcCtx.assignedQcSubtotal,
        assignedSubtotal: qcCtx.assignedQcSubtotal,
        estimatedDeliveryTime: order.estimatedDeliveryDate
          ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "N/A",
        createdAt: order.createdAt,
        // Distance calculation to be implemented. sending null/undefined for now to avoid fake data
        distance: null,
      });
      return acc;
    }, []);

    return res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  },
);

/**
 * Get Pending Orders
 */
export const getPendingOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    // Pending statuses: Ready for pickup, Out for delivery, Picked Up, Assigned, In Transit
    const orders = await Order.find({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
      status: {
        $in: [
          "Ready for pickup",
          "Out for Delivery",
          "Picked Up",
          "Assigned",
          "In Transit",
        ],
      },
    })
      .populate("items")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.reduce((acc: any[], order) => {
      const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
      if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
        return acc;
      }

      acc.push({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: qcCtx.displayStatus,
        address: formatDeliveryAddress(order.deliveryAddress).formatted,
        items: mapOrderItems(qcCtx.assignedQcItems), // Real assigned QC items only
        totalAmount: qcCtx.assignedQcSubtotal,
        subtotal: qcCtx.assignedQcSubtotal,
        assignedSubtotal: qcCtx.assignedQcSubtotal,
        estimatedDeliveryTime: order.estimatedDeliveryDate
          ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "N/A",
        createdAt: order.createdAt,
        distance: null,
      });
      return acc;
    }, []);

    return res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  },
);

/**
 * Get Specific Order Details
 */
export const getOrderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const order = await Order.findById(id).populate("items");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check if delivery boy has an active pending offer if not directly assigned
    let hasActiveOffer = false;
    const isDirectlyAssigned =
      order.deliveryBoy &&
      order.deliveryBoy.toString() === deliveryId.toString();

    if (!isDirectlyAssigned) {
      const { default: DeliveryOrderOffer } = await import(
        "../../../models/DeliveryOrderOffer"
      );
      const activeOffer = await DeliveryOrderOffer.findOne({
        order: id,
        deliveryBoy: deliveryId,
        status: "pending",
      });
      if (activeOffer) {
        hasActiveOffer = true;
      }
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId, hasActiveOffer);

    // If order is purely Ecommerce courier shipping, local delivery partner cannot access it
    if (qcCtx.isEcommerceOnly) {
      return res.status(403).json({
        success: false,
        message:
          "This order is fulfilled via courier shipping and has no local delivery items assigned to you.",
      });
    }

    // If not authorized or has no assigned QC items, deny access under existing authorization conventions
    if (!qcCtx.isAuthorized || !qcCtx.hasQcItems) {
      return res.status(403).json({
        success: false,
        message: "This order is not assigned to you",
      });
    }

    // Fetch Delivery Earning for this order
    const { default: Commission } = await import("../../../models/Commission");
    const commission = await Commission.findOne({
      order: id,
      type: "DELIVERY_BOY",
    });

    const formattedOrder = {
      id: order._id,
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: formatDeliveryAddress(order.deliveryAddress).formatted,
      deliveryAddress: order.deliveryAddress,
      status: qcCtx.displayStatus,
      deliveryBoy: order.deliveryBoy,
      deliveryBoyStatus: order.deliveryBoyStatus,
      deliveryAssignmentStatus: (order as any).deliveryAssignmentStatus,
      sellerPickups: qcCtx.relevantSellerPickups,
      items: mapOrderItems(qcCtx.assignedQcItems), // ONLY assigned QC items
      totalAmount: qcCtx.assignedQcSubtotal, // QC-only subtotal!
      subtotal: qcCtx.assignedQcSubtotal,
      assignedSubtotal: qcCtx.assignedQcSubtotal,
      createdAt: order.createdAt,
      distance: null,
      deliveryEarning: commission ? commission.commissionAmount : 0,
    };

    return res.status(200).json({
      success: true,
      data: formattedOrder,
    });
  },
);

/**
 * Update Order Status
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
    if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    // Save previous status before updating
    const previousStatus = order.status;

    // Scope status transition to QC fulfillment group
    if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
      order.fulfillmentGroups.forEach((g: any) => {
        if (g.fulfillmentType === "LOCAL_DELIVERY") {
          if (status === "Picked up") g.status = "Shipped";
          else if (status === "Out for Delivery") g.status = "OutForDelivery";
          else if (status === "Delivered") g.status = "Delivered";
          else if (status === "Cancelled") g.status = "Cancelled";
        }
      });
    }

    // Status transition logic
    if (status === "Picked up" || status === "Out for Delivery") {
      order.deliveryBoyStatus = "Picked Up";
      order.status = status;
    } else if (status === "Delivered") {
      order.deliveryBoyStatus = "Delivered";

      // In a mixed order, set order.status to Delivered only if all groups are delivered
      if (order.fulfillmentGroups && order.fulfillmentGroups.length > 0) {
        const allGroupsDelivered = order.fulfillmentGroups.every(
          (g: any) => g.status === "Delivered"
        );
        if (allGroupsDelivered || order.orderType !== "MIXED") {
          order.status = "Delivered";
          order.deliveredAt = new Date();
          order.paymentStatus = "Paid"; // Assume paid on delivery (or already paid)
        }
      } else {
        order.status = "Delivered";
        order.deliveredAt = new Date();
        order.paymentStatus = "Paid"; // Assume paid on delivery (or already paid)
      }

      // CASH COLLECTION AND COMMISSION LOGIC
      if (order.paymentMethod === "COD") {
        // Use new COD processing function
        const { processCODOrderDelivery } =
          await import("../../../services/commissionService");
        try {
          await processCODOrderDelivery(id);
          console.log(`[COD] Order ${order.orderNumber} delivery processed successfully`);
        } catch (codError: any) {
          console.error("Error processing COD order delivery:", codError);
          // Rollback order status if COD processing fails
          return res.status(500).json({
            success: false,
            message: `Failed to process COD delivery: ${codError.message}`,
          });
        }
      } else {
        // For non-COD orders, use existing distribution logic
        const { distributeCommissions } =
          await import("../../../services/commissionService");
        try {
          await distributeCommissions(id);
        } catch (commError: any) {
          console.error("Error distributing commissions:", commError);
          // Continue even if commission distribution fails
        }
      }
    } else if (status) {
      order.status = status;
    }

    await order.save();

    // Emit socket events for status changes
    const io = (req.app as any).get("io");
    if (io) {
      if (status === "Picked up" && previousStatus !== "Picked up") {
        // Emit order-taken event
        io.to(`order-${id}`).emit("order-taken", {
          orderId: id,
          message: "Order has been picked up from seller",
        });
      }

      if (status === "Delivered" && previousStatus !== "Delivered") {
        // Emit order-delivered event to all relevant parties
        io.to(`order-${id}`).emit("order-delivered", {
          orderId: id,
          orderNumber: order.orderNumber,
          message: "Order has been delivered successfully",
        });

        // Also emit to delivery boy room
        io.to(`delivery-${deliveryId}`).emit("order-delivered", {
          orderId: id,
          orderNumber: order.orderNumber,
          message: "Order delivered successfully",
        });
      }

      // Trigger notification to sellers for payment status change or specific transitions
      if (order.paymentStatus === "Paid" || status === "Delivered") {
        notifySellersOfOrderUpdate(io, order, "STATUS_UPDATE");
      }

      // Notify customer of order status change
      if (order.customer && previousStatus !== order.status) {
        try {
          const { sendOrderStatusNotification } = await import(
            "../../../services/notificationService"
          );
          const customerId = (order.customer as any)._id?.toString() || order.customer.toString();
          sendOrderStatusNotification(order._id.toString(), customerId, order.status, io).catch((e) =>
            console.error("Error sending customer order status notification:", e)
          );
        } catch (notifErr) {
          console.error("Error importing notificationService:", notifErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  },
);

/**
 * Get Return Orders
 */
export const getReturnOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const orders = await Order.find({
      deliveryBoy: deliveryId,
      orderType: { $ne: "ECOMMERCE" },
      status: { $in: ["Returned", "Cancelled", "Rejected"] },
    })
      .populate("items")
      .sort({ updatedAt: -1 });

    const formattedOrders = orders.reduce((acc: any[], order) => {
      const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
      if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
        return acc;
      }

      acc.push({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: qcCtx.displayStatus,
        address: formatDeliveryAddress(order.deliveryAddress).formatted,
        items: mapOrderItems(qcCtx.assignedQcItems),
        totalAmount: qcCtx.assignedQcSubtotal,
        subtotal: qcCtx.assignedQcSubtotal,
        assignedSubtotal: qcCtx.assignedQcSubtotal,
        createdAt: order.createdAt,
        distance: null,
      });
      return acc;
    }, []);

    return res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  },
);

/**
 * Get Seller Locations for Order
 * Returns all unique seller shop locations for items in this order
 */
export const getSellerLocationsForOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check active offer if not directly assigned
    let hasActiveOffer = false;
    const isDirectlyAssigned =
      order.deliveryBoy &&
      order.deliveryBoy.toString() === deliveryId.toString();

    if (!isDirectlyAssigned) {
      const { default: DeliveryOrderOffer } = await import(
        "../../../models/DeliveryOrderOffer"
      );
      const activeOffer = await DeliveryOrderOffer.findOne({
        order: id,
        deliveryBoy: deliveryId,
        status: "pending",
      });
      if (activeOffer) {
        hasActiveOffer = true;
      }
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId, hasActiveOffer);
    if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    // Get unique seller IDs from assigned QC items only
    const sellerIds = qcCtx.qcSellerIds;

    // Get seller details including locations
    const sellers = await Seller.find({ _id: { $in: sellerIds } }).select(
      "storeName address city latitude longitude",
    );

    // Format seller locations
    const sellerLocations = sellers
      .filter((seller) => seller.latitude && seller.longitude) // Only include sellers with location data
      .map((seller) => ({
        sellerId: seller._id.toString(),
        storeName: seller.storeName,
        address: seller.address,
        city: seller.city,
        latitude: parseFloat(seller.latitude || "0"),
        longitude: parseFloat(seller.longitude || "0"),
      }));

    return res.status(200).json({
      success: true,
      data: sellerLocations,
    });
  },
);

/**
 * Send Delivery OTP
 * Generates and sends OTP to customer
 */
export const sendDeliveryOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body || {};
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
    if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    if (order.status === "Delivered") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already delivered" });
    }

    if (order.status !== "Picked up" && order.status !== "Out for Delivery") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order must be picked up before sending delivery OTP",
        });
    }

    // Distance Security Check (>500m restriction)
    const testModeActive = process.env.NODE_ENV !== "production" && process.env.DELIVERY_TEST_MODE === "true";
    if (!testModeActive) {
      if (latitude !== undefined && longitude !== undefined && order.deliveryAddress?.latitude && order.deliveryAddress?.longitude) {
        const latNum = Number(latitude);
        const lngNum = Number(longitude);
        if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
          return res.status(400).json({
            success: false,
            message: "Invalid GPS coordinates format provided.",
          });
        }

        const { calculateDistance } = await import("../../../utils/locationHelper");
        const distance = calculateDistance(
          latNum,
          lngNum,
          Number(order.deliveryAddress.latitude),
          Number(order.deliveryAddress.longitude)
        );
        if (distance > 0.5) {
          return res.status(403).json({
            success: false,
            code: "DISTANCE_REQUIREMENT_NOT_SATISFIED",
            message: `Distance requirement not satisfied. You are ${(distance * 1000).toFixed(0)}m away. Move within 500m to request OTP.`,
          });
        }
      }
    } else {
      console.log(`[DELIVERY TEST MODE] GPS proximity check bypassed for order ${id}`);
    }

    try {
      const result = await generateDeliveryOtp(id);

      // Emit otp-sent event to delivery boy
      const io = (req.app as any).get("io");
      if (io) {
        io.to(`delivery-${deliveryId}`).emit("otp-sent", {
          orderId: id,
          orderNumber: order.orderNumber,
          message: "Delivery OTP sent to customer",
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to send delivery OTP",
      });
    }
  },
);

/**
 * Verify Delivery OTP and mark order as delivered
 */
export const verifyDeliveryOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;
    const deliveryId = req.user?.userId;

    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId!);
    if (!qcCtx.isAuthorized || !qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    try {
      const previousStatus = order.status;
      const result = await verifyDeliveryOtp(id, otp);
      // Note: verifyDeliveryOtp is from service, not this controller

      // Reload order to get updated status
      const updatedOrder = await Order.findById(id).populate("items");

      if (updatedOrder) {
        // Update QC fulfillment group status to Delivered
        if (updatedOrder.fulfillmentGroups && updatedOrder.fulfillmentGroups.length > 0) {
          updatedOrder.fulfillmentGroups.forEach((g: any) => {
            if (g.fulfillmentType === "LOCAL_DELIVERY") {
              g.status = "Delivered";
            }
          });

          const allGroupsDelivered = updatedOrder.fulfillmentGroups.every(
            (g: any) => g.status === "Delivered"
          );

          // In a MIXED order, if courier groups are NOT delivered yet, parent order is not fully Delivered
          if (!allGroupsDelivered && updatedOrder.orderType === "MIXED") {
            updatedOrder.status = previousStatus === "Delivered" ? "Processed" : previousStatus;
          } else {
            updatedOrder.status = "Delivered";
            updatedOrder.deliveredAt = new Date();
          }
        } else {
          updatedOrder.status = "Delivered";
          updatedOrder.deliveredAt = new Date();
        }

        updatedOrder.deliveryBoyStatus = "Delivered";
        await updatedOrder.save();

        // Process order status transition for financial transactions
        try {
          await processOrderStatusTransition(id, "Delivered", previousStatus);
        } catch (transitionError: any) {
          console.error(
            "Error processing order status transition:",
            transitionError,
          );
          // Continue even if transition fails - order is already marked as delivered
        }
      }

      // Emit socket events for real-time status update
      if (updatedOrder && (updatedOrder.status === "Delivered" || updatedOrder.deliveryBoyStatus === "Delivered")) {
        const io = (req.app as any).get("io");
        if (io && previousStatus !== "Delivered") {
          // Emit order-delivered event to customer
          io.to(`order-${id}`).emit("order-delivered", {
            orderId: id,
            orderNumber: updatedOrder.orderNumber,
            message: "Order has been delivered successfully",
          });

          // Also emit to delivery boy room
          io.to(`delivery-${deliveryId}`).emit("order-delivered", {
            orderId: id,
            orderNumber: updatedOrder.orderNumber,
            message: "Order delivered successfully",
          });

          // Notify sellers of status update
          notifySellersOfOrderUpdate(io, updatedOrder, "STATUS_UPDATE");
        }
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: updatedOrder,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to verify delivery OTP",
      });
    }
  },
);

/**
 * Check Proximity to Seller
 * Checks if delivery boy is within 500m of a specific seller
 */
export const checkSellerProximity = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sellerId, latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!sellerId || latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Seller ID, latitude, and longitude are required",
        });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId);
    if (!qcCtx.isAuthorized) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    if (!qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res.status(403).json({
        success: false,
        message: "This order has no Quick Commerce items assigned to you",
      });
    }

    if (!qcCtx.qcSellerIds.includes(sellerId.toString())) {
      return res.status(400).json({
        success: false,
        message: "Seller does not belong to your assigned Quick Commerce delivery",
      });
    }

    // Get seller location
    const seller = await Seller.findById(sellerId).select(
      "latitude longitude storeName",
    );
    if (!seller || !seller.latitude || !seller.longitude) {
      return res
        .status(404)
        .json({ success: false, message: "Seller location not found" });
    }

    // Calculate distance using locationHelper
    const { calculateDistance } = await import("../../../utils/locationHelper");
    const distance = calculateDistance(
      latitude,
      longitude,
      parseFloat(seller.latitude),
      parseFloat(seller.longitude),
    );

    const withinRange = distance <= 0.5; // 500m = 0.5km

    return res.status(200).json({
      success: true,
      data: {
        withinRange,
        distance: distance.toFixed(3), // in km
        distanceMeters: Math.round(distance * 1000), // in meters
        sellerName: seller.storeName,
      },
    });
  },
);

/**
 * Confirm Seller Pickup
 * Confirms pickup from a specific seller and updates order status
 */
export const confirmSellerPickup = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sellerId, latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!sellerId || latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Seller ID, latitude, and longitude are required",
        });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId);
    if (!qcCtx.isAuthorized) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    if (!qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res.status(403).json({
        success: false,
        message: "This order has no Quick Commerce items assigned to you",
      });
    }

    // Ensure the seller belongs to the assigned QC delivery
    if (!qcCtx.qcSellerIds.includes(sellerId.toString())) {
      return res.status(400).json({
        success: false,
        message: "Seller does not belong to your assigned Quick Commerce delivery",
      });
    }

    // Verify proximity to seller
    const seller = await Seller.findById(sellerId).select(
      "latitude longitude storeName",
    );
    if (!seller || !seller.latitude || !seller.longitude) {
      return res
        .status(404)
        .json({ success: false, message: "Seller location not found" });
    }

    const { calculateDistance } = await import("../../../utils/locationHelper");
    const distance = calculateDistance(
      latitude,
      longitude,
      parseFloat(seller.latitude),
      parseFloat(seller.longitude),
    );

    if (distance > 0.5) {
      // 500m = 0.5km
      return res.status(400).json({
        success: false,
        message: `You must be within 500 meters of the seller to confirm pickup. Current distance: ${Math.round(distance * 1000)}m`,
      });
    }

    // Check if this seller is already picked up
    const existingPickup = order.sellerPickups?.find(
      (pickup: any) => pickup.seller.toString() === sellerId,
    );

    if (existingPickup && existingPickup.pickedUpAt) {
      return res.status(400).json({
        success: false,
        message: "This seller has already been picked up",
      });
    }

    // Initialize sellerPickups array if it doesn't exist
    if (!order.sellerPickups) {
      order.sellerPickups = [];
    }

    // Add or update pickup confirmation for this seller
    const pickupIndex = order.sellerPickups.findIndex(
      (pickup: any) => pickup.seller.toString() === sellerId,
    );

    const pickupData = {
      seller: sellerId,
      pickedUpAt: new Date(),
      pickedUpBy: deliveryId,
      latitude,
      longitude,
    };

    if (pickupIndex >= 0) {
      order.sellerPickups[pickupIndex] = pickupData as any;
    } else {
      order.sellerPickups.push(pickupData as any);
    }

    // Calculate pickup completion using ONLY the relevant assigned QC sellers!
    const pickedUpQcSellerIds = order.sellerPickups
      .filter(
        (pickup: any) =>
          pickup.pickedUpAt &&
          qcCtx.qcSellerIds.includes(pickup.seller.toString()),
      )
      .map((pickup: any) => pickup.seller.toString());

    const allPickedUp = qcCtx.qcSellerIds.every((sId) =>
      pickedUpQcSellerIds.includes(sId),
    );

    // Update assigned QC fulfillment group if present
    if (qcCtx.assignedFulfillmentGroup) {
      const fg = (order.fulfillmentGroups as any[])?.find(
        (g) => g.groupId === qcCtx.assignedFulfillmentGroup?.groupId,
      );
      if (fg) {
        fg.status = allPickedUp ? "OutForDelivery" : "ReadyForPickup";
      }
    }

    // If all QC sellers picked up, automatically change status to "Out for Delivery"
    if (
      allPickedUp &&
      order.status !== "Out for Delivery" &&
      order.status !== "Delivered"
    ) {
      order.status = "Out for Delivery";
      order.deliveryBoyStatus = "In Transit";
    }

    await order.save();

    // Emit socket event
    const io = (req.app as any).get("io");
    if (io) {
      io.to(`order-${id}`).emit("seller-pickup-confirmed", {
        orderId: id,
        orderNumber: order.orderNumber,
        sellerId,
        sellerName: seller.storeName,
        allPickedUp,
        newStatus: order.status,
      });

      if (allPickedUp) {
        io.to(`delivery-${deliveryId}`).emit("all-sellers-picked-up", {
          orderId: id,
          orderNumber: order.orderNumber,
          message: "All items picked up. Order is now Out for Delivery.",
        });
      }
    }

    // Return sanitized order representation for response
    const orderObj = order.toObject ? order.toObject() : { ...order };
    const safeOrder = {
      ...orderObj,
      items: mapOrderItems(qcCtx.assignedQcItems),
      assignedSubtotal: qcCtx.assignedQcSubtotal,
      subtotal: qcCtx.assignedQcSubtotal,
      fulfillmentGroups: qcCtx.assignedFulfillmentGroup
        ? [qcCtx.assignedFulfillmentGroup]
        : [],
      shipmentDetails: undefined,
    };

    return res.status(200).json({
      success: true,
      message: allPickedUp
        ? "All sellers picked up! Order status changed to Out for Delivery."
        : `Pickup confirmed from ${seller.storeName}`,
      data: {
        order: safeOrder,
        allPickedUp,
        pickedUpSellers: pickedUpQcSellerIds.length,
        totalSellers: qcCtx.qcSellerIds.length,
      },
    });
  },
);

/**
 * Check Proximity to Customer
 * Checks if delivery boy is within 500m of customer delivery address
 */
export const checkCustomerProximity = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (latitude === undefined || longitude === undefined || isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid latitude (-90 to 90) and longitude (-180 to 180) are required",
        });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const qcCtx = getDeliveryPartnerQcContext(order, deliveryId);
    if (!qcCtx.isAuthorized) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    if (!qcCtx.hasQcItems || qcCtx.isEcommerceOnly) {
      return res.status(403).json({
        success: false,
        message: "This order has no Quick Commerce items assigned to you",
      });
    }

    const testModeActive = process.env.NODE_ENV !== "production" && process.env.DELIVERY_TEST_MODE === "true";
    if (testModeActive) {
      return res.status(200).json({
        success: true,
        data: {
          withinRange: true,
          distance: "0.000",
          distanceMeters: 0,
          customerName: order.customerName,
          testMode: true,
          message: "Development Test Mode — GPS proximity check bypassed",
        },
      });
    }

    // Get customer location from delivery address
    const customerLat = order.deliveryAddress?.latitude;
    const customerLng = order.deliveryAddress?.longitude;

    if (!customerLat || !customerLng) {
      return res.status(400).json({
        success: false,
        message: "Customer delivery address coordinates not available",
      });
    }

    // Calculate distance
    const { calculateDistance } = await import("../../../utils/locationHelper");
    const distance = calculateDistance(
      latitude,
      longitude,
      customerLat,
      customerLng,
    );

    const withinRange = distance <= 0.5; // 500m = 0.5km

    return res.status(200).json({
      success: true,
      data: {
        withinRange,
        distance: distance.toFixed(3), // in km
        distanceMeters: Math.round(distance * 1000), // in meters
        customerName: order.customerName,
      },
    });
  },
);

/**
 * Accept Order (REST Endpoint Fallback)
 */
export const acceptOrderController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { handleOrderAcceptance } = await import(
      "../../../services/orderNotificationService"
    );
    const io = (req.app as any).get("io");
    const result = await handleOrderAcceptance(io, id, deliveryId);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  }
);

/**
 * Reject Order (REST Endpoint Fallback)
 */
export const rejectOrderController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { handleOrderRejection } = await import(
      "../../../services/orderNotificationService"
    );
    const io = (req.app as any).get("io");
    const result = await handleOrderRejection(io, id, deliveryId);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  }
);

