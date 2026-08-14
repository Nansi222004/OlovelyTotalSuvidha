import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import DeliveryTracking from "../../../models/DeliveryTracking";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import Delivery from "../../../models/Delivery";

/**
 * Get tracking information for an order
 * GET /api/v1/customer/orders/:orderId/tracking
 */
export const getOrderTracking = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const customerId = (req as any).user.userId;

    // Verify order belongs to customer
    const order = await Order.findOne({ _id: orderId, customer: customerId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get latest tracking information
    const tracking = await DeliveryTracking.findOne({ order: orderId })
      .sort({ updatedAt: -1 })
      .populate("deliveryBoy", "name phone profileImage")
      .lean();

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Tracking information not available yet",
      });
    }

    // Get delivery address from order
    const deliveryAddress = order.deliveryAddress;

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        tracking: {
          deliveryBoy: tracking.deliveryBoy,
          currentLocation: tracking.currentLocation,
          route: tracking.route,
          eta: tracking.eta,
          distance: tracking.distance,
          status: tracking.status,
          lastUpdated: tracking.updatedAt,
        },
        deliveryAddress: deliveryAddress,
      },
    });
  }
);

/**
 * Update delivery partner location (called by delivery app)
 * POST /api/v1/delivery/location
 */
export const updateDeliveryLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId, latitude, longitude } = req.body;
    const deliveryBoyId = req.user?.userId;

    // Validate inputs
    if (!orderId || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Order ID, latitude, and longitude are required",
      });
    }

    // Verify order is assigned to this delivery partner
    const order = await Order.findOne({
      _id: orderId,
      deliveryBoy: deliveryBoyId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or not assigned to you",
      });
    }

    // Calculate distance to delivery address
    const deliveryLat = order.deliveryAddress?.latitude || 0;
    const deliveryLng = order.deliveryAddress?.longitude || 0;

    // Find or create tracking record
    let tracking = await DeliveryTracking.findOne({ order: orderId });

    if (!tracking) {
      // Determine initial status based on order status
      let initialStatus: 'idle' | 'picked_up' | 'in_transit' | 'nearby' = 'idle';
      if (order.status === 'Picked up' || order.status === 'Out for Delivery') {
        initialStatus = 'picked_up';
      } else {
        initialStatus = 'idle';
      }

      tracking = new DeliveryTracking({
        order: orderId,
        deliveryBoy: deliveryBoyId,
        latitude, // Legacy field
        longitude, // Legacy field
        currentLocation: {
          latitude,
          longitude,
          timestamp: new Date(),
        },
        route: [{ lat: latitude, lng: longitude }],
        status: initialStatus,
      });
    } else {
      tracking.currentLocation = {
        latitude,
        longitude,
        timestamp: new Date(),
      };
      // Update legacy fields
      tracking.latitude = latitude;
      tracking.longitude = longitude;
      // Add to route history (keep last 50 points)
      tracking.route.push({ lat: latitude, lng: longitude });
      if (tracking.route.length > 50) {
        tracking.route = tracking.route.slice(-50);
      }
    }

    // Calculate distance and ETA
    const distance = tracking.calculateDistance(deliveryLat, deliveryLng);
    const eta = tracking.calculateETA(distance);

    tracking.distance = distance;
    tracking.eta = eta;

    // Update status based on order status and distance
    if (order.status === 'Delivered') {
      tracking.status = "delivered";
    } else if (order.status === 'Picked up' || order.status === 'Out for Delivery') {
      if (distance < 100) {
        tracking.status = "nearby";
      } else if (distance < 5000) {
        tracking.status = "in_transit";
      } else {
        tracking.status = "picked_up";
      }
    } else {
      // Order is still assigned but not picked up yet
      tracking.status = "idle";
    }

    await tracking.save();

    // Also update the delivery partner's general location
    await Delivery.findByIdAndUpdate(deliveryBoyId, {
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    });

    // Emit update via Socket.io (will be handled in socket service)
    const io = (req.app as any).get("io");
    if (io) {
      io.to(`order-${orderId}`).emit("location-update", {
        orderId,
        location: tracking.currentLocation,
        eta: tracking.eta,
        distance: tracking.distance,
        status: tracking.status,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        distance,
        eta,
        status: tracking.status,
      },
    });
  }
);

/**
 * Update general delivery partner location (when not on a specific order)
 * POST /api/v1/delivery/location/general
 */
export const updateGeneralLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const { latitude, longitude } = req.body;
    const deliveryBoyId = req.user?.userId;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const deliveryBoy = await Delivery.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    // Update delivery partner's current location
    deliveryBoy.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };

    await deliveryBoy.save();

    return res.status(200).json({
      success: true,
      message: "General location updated successfully",
      data: {
        location: deliveryBoy.location,
      },
    });
  }
);

/**
 * Get delivery partner's active orders with tracking
 * GET /api/v1/delivery/active-orders
 */
export const getActiveOrdersTracking = asyncHandler(
  async (req: Request, res: Response) => {
    const deliveryBoyId = (req as any).user.userId;

    const trackings = await DeliveryTracking.find({
      deliveryBoy: deliveryBoyId,
      status: { $in: ["picked_up", "in_transit", "nearby"] },
    })
      .populate("order", "orderNumber status deliveryAddress")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: trackings,
    });
  }
);

/**
 * Get Seller Locations for Order (Customer endpoint)
 * Returns all unique seller shop locations for items in this order
 * GET /api/v1/customer/orders/:orderId/seller-locations
 */
export const getSellerLocationsForOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const customerId = (req as any).user.userId;

    // Verify order exists and belongs to this customer
    const order = await Order.findOne({ _id: orderId, customer: customerId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get all unique seller IDs from order items
    const orderItems = await OrderItem.find({ order: orderId });
    const sellerIds = [...new Set(orderItems.map((item) => item.seller.toString()))];

    // Get seller details including locations
    const sellers = await Seller.find({ _id: { $in: sellerIds } }).select(
      "storeName address city latitude longitude"
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
  }
);

/**
 * Get count of sellers whose service radius includes the delivery boy's location
 * GET /api/v1/delivery/location/sellers-in-radius
 */
export const getSellersInRadius = asyncHandler(
  async (req: Request, res: Response) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude",
      });
    }

    // Use aggregation to find sellers whose radius covers the current point
    // 1. Get all sellers with locations
    // 2. Filter by distance <= serviceRadiusKm
    const sellersInRange = await Seller.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceFromDeliveryBoy", // in meters
          spherical: true,
          key: "location",
          // We can't filter by a field's value in $geoNear directly for maxDistance
          // so we'll filter in the next stage
        },
      },
      {
        $addFields: {
          // serviceRadiusKm is in kilometers, distanceFromDeliveryBoy is in meters
          radiusInMeters: { $multiply: ["$serviceRadiusKm", 1000] },
        },
      },
      {
        $match: {
          $expr: {
            $lte: ["$distanceFromDeliveryBoy", "$radiusInMeters"],
          },
        },
      },
      {
        $project: {
          _id: 1,
          storeName: 1,
          address: 1,
          serviceRadiusKm: 1,
          distanceFromDeliveryBoy: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        count: sellersInRange.length,
        sellers: sellersInRange,
      },
    });
  }
);
