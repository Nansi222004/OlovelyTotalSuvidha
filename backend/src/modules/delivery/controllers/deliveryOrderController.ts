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
  return items.map((item: any) => ({
    name: item.productName || "Unknown Item",
    quantity: item.quantity || 0,
    price: item.total || 0, // Using total price for the line item
    image: item.productImage,
  }));
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

    const orders = await Order.find({ deliveryBoy: deliveryId })
      .populate("items") // Populate OrderItems
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ deliveryBoy: deliveryId });

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

    // Format orders for frontend
    const formattedOrders = orders.map((order) => ({
      id: order._id,
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,

      address: `${order.deliveryAddress.address}, ${order.deliveryAddress.city}`,
      deliveryAddress: order.deliveryAddress,
      totalAmount: order.total,
      deliveryEarning: commissionMap.get(order._id.toString()) || 0, // Add Earning
      items: mapOrderItems(order.items),
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryDate
        ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        : "N/A",
    }));

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
      $or: [
        { createdAt: { $gte: todayStart, $lte: todayEnd } }, // Created today
        { updatedAt: { $gte: todayStart, $lte: todayEnd } }, // OR Updated today
      ],
    })
      .populate("items")
      .sort({ updatedAt: -1 });

    const formattedOrders = orders.map((order) => ({
      id: order._id,
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,

      address: `${order.deliveryAddress?.address || ""}, ${order.deliveryAddress?.city || ""}`,
      deliveryAddress: order.deliveryAddress,
      items: mapOrderItems(order.items), // Real items
      totalAmount: order.total,
      estimatedDeliveryTime: order.estimatedDeliveryDate
        ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        : "N/A",
      createdAt: order.createdAt,
      // Distance calculation to be implemented. sending null/undefined for now to avoid fake data
      distance: null,
    }));

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

    const formattedOrders = orders.map((order) => ({
      id: order._id,
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      address: `${order.deliveryAddress?.address || ""}, ${order.deliveryAddress?.city || ""}`,
      items: mapOrderItems(order.items), // Real items
      totalAmount: order.total,
      estimatedDeliveryTime: order.estimatedDeliveryDate
        ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        : "N/A",
      createdAt: order.createdAt,
      distance: null,
    }));

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

    const order = await Order.findById(id).populate("items");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
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
      address: `${order.deliveryAddress?.address || ""}, ${order.deliveryAddress?.city || ""}`,
      deliveryAddress: order.deliveryAddress,
      status: order.status,
      items: mapOrderItems(order.items), // Real populated items
      totalAmount: order.total,
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

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() != deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    // Save previous status before updating
    const previousStatus = order.status;

    // Status transition logic
    if (status) order.status = status;

    if (status === "Picked up" || status === "Out for Delivery") {
      order.deliveryBoyStatus = "Picked Up";
    } else if (status === "Delivered") {
      order.deliveryBoyStatus = "Delivered";
      order.deliveredAt = new Date();
      order.paymentStatus = "Paid"; // Assume paid on delivery (or already paid)

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
      status: { $in: ["Returned", "Cancelled", "Rejected"] },
    })
      .populate("items")
      .sort({ updatedAt: -1 });

    const formattedOrders = orders.map((order) => ({
      id: order._id,
      orderId: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      address: `${order.deliveryAddress?.address || ""}, ${order.deliveryAddress?.city || ""}`,
      items: mapOrderItems(order.items),
      totalAmount: order.total,
      createdAt: order.createdAt,
      distance: null,
    }));

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

    // Verify order exists and is assigned to this delivery boy
    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    // Get all unique seller IDs from order items
    const orderItems = await OrderItem.find({ order: id });
    const sellerIds = [
      ...new Set(orderItems.map((item) => item.seller.toString())),
    ];

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
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
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

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
    }

    try {
      const previousStatus = order.status;
      const result = await verifyDeliveryOtp(id, otp);
      // Note: verifyDeliveryOtp is from service, not this controller

      // Reload order to get updated status
      const updatedOrder = await Order.findById(id);

      // Process order status transition for financial transactions
      if (
        updatedOrder &&
        updatedOrder.status === "Delivered" &&
        previousStatus !== "Delivered"
      ) {
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

      // Update delivery boy balance and cash collected (if COD)
      if (updatedOrder && updatedOrder.status === "Delivered") {
        if (updatedOrder.paymentMethod === "COD") {
          // Use new COD processing function
          const { processCODOrderDelivery } =
            await import("../../../services/commissionService");
          try {
            await processCODOrderDelivery(id);
            console.log(`[COD] Order ${updatedOrder.orderNumber} delivery processed via OTP verification`);
          } catch (codError: any) {
            console.error("Error processing COD order delivery:", codError);
            // Continue - order is already marked as delivered
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

        // Emit socket events for real-time status update
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

    if (!sellerId || latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Seller ID, latitude, and longitude are required",
        });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
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

    if (order.deliveryBoy?.toString() !== deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
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

    // Get all unique seller IDs from order items
    const orderItems = await OrderItem.find({ order: id });
    const allSellerIds = [
      ...new Set(orderItems.map((item) => item.seller.toString())),
    ];

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

    // Check if all sellers have been picked up
    const pickedUpSellerIds = order.sellerPickups
      .filter((pickup: any) => pickup.pickedUpAt)
      .map((pickup: any) => pickup.seller.toString());

    const allPickedUp = allSellerIds.every((sellerId) =>
      pickedUpSellerIds.includes(sellerId),
    );

    // If all sellers picked up, automatically change status to "Out for Delivery"
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

    return res.status(200).json({
      success: true,
      message: allPickedUp
        ? "All sellers picked up! Order status changed to Out for Delivery."
        : `Pickup confirmed from ${seller.storeName}`,
      data: {
        order,
        allPickedUp,
        pickedUpSellers: pickedUpSellerIds.length,
        totalSellers: allSellerIds.length,
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

    if (latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Latitude and longitude are required",
        });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
      return res
        .status(403)
        .json({ success: false, message: "This order is not assigned to you" });
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
