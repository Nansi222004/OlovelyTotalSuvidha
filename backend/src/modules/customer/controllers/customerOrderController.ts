import { Request, Response } from "express";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import OrderItem from "../../../models/OrderItem";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import mongoose from "mongoose";
import { calculateDistance } from "../../../utils/locationHelper";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { generateDeliveryOtp } from "../../../services/deliveryOtpService";
import AppSettings from "../../../models/AppSettings";
import { getRoadDistances } from "../../../services/mapService";
import { Server as SocketIOServer } from "socket.io";
import { getOrderItemCommissionRate } from "../../../services/commissionService";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Coupon from "../../../models/Coupon";

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
  let session: mongoose.ClientSession | null = null;
  try {
    // Only start session if we are on a replica set (required for transactions)
    // For simplicity in local dev, we check and fallback if it fails
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionError) {
      console.warn(
        "MongoDB Transactions not supported or failed to start. Proceeding without transaction.",
      );
      session = null;
    }

    const { items, address, paymentMethod, fees, deliveryOption, couponCode, tipAmount, giftPackaging } = req.body;
    const userId = req.user!.userId;

    // Log incoming request for debugging
    console.log("DEBUG: Order creation request:", {
      userId,
      itemsCount: items?.length,
      hasAddress: !!address,
      addressLat: address?.latitude,
      addressLng: address?.longitude,
      paymentMethod,
      deliveryOption,
    });

    if (!items || items.length === 0) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Order must have at least one item",
      });
    }

    if (!address) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // Validate required address fields
    if (
      !address.city ||
      (typeof address.city === "string" && address.city.trim() === "")
    ) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "City is required in delivery address",
        details: {
          receivedCity: address.city,
          addressObject: address,
        },
      });
    }

    if (
      !address.pincode ||
      (typeof address.pincode === "string" && address.pincode.trim() === "")
    ) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Pincode is required in delivery address",
        details: {
          receivedPincode: address.pincode,
          addressObject: address,
        },
      });
    }

    // Fetch customer details
    const customer = await Customer.findById(userId);
    if (!customer) {
      if (session) await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Validate delivery address location
    // Handle both string and number types, and check for null/undefined (not truthy, since 0 is valid)
    const deliveryLat =
      address.latitude != null
        ? typeof address.latitude === "number"
          ? address.latitude
          : parseFloat(address.latitude)
        : null;
    const deliveryLng =
      address.longitude != null
        ? typeof address.longitude === "number"
          ? address.longitude
          : parseFloat(address.longitude)
        : null;

    if (
      deliveryLat == null ||
      deliveryLng == null ||
      isNaN(deliveryLat) ||
      isNaN(deliveryLng)
    ) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Delivery address location (latitude/longitude) is required",
        details: {
          receivedLatitude: address.latitude,
          receivedLongitude: address.longitude,
          parsedLatitude: deliveryLat,
          parsedLongitude: deliveryLng,
        },
      });
    }

    // Validate coordinates
    if (
      deliveryLat < -90 ||
      deliveryLat > 90 ||
      deliveryLng < -180 ||
      deliveryLng > 180
    ) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid delivery address coordinates",
      });
    }

    // Initialize Order first to get an ID
    const newOrder = new Order({
      customer: new mongoose.Types.ObjectId(userId),
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      deliveryAddress: {
        address: address.address || address.street || "N/A",
        city: address.city || "N/A",
        state: address.state || "",
        pincode: address.pincode || "000000",
        landmark: address.landmark || "",
        latitude: deliveryLat,
        longitude: deliveryLng,
      },
      paymentMethod: paymentMethod || "COD",
      paymentStatus: "Pending",
      status: (paymentMethod === "Online" || paymentMethod === "razorpay") ? "Pending" : "Received",
      deliveryOption: deliveryOption || "Standard",
      subtotal: 0,
      tax: 0,
      shipping: fees?.deliveryFee || 0,
      platformFee: fees?.platformFee || 0,
      discount: 0,
      total: 0,
      items: [],
      tipAmount: Number(tipAmount) || 0,
      giftPackaging: !!giftPackaging,
      sellerConfirmationStatus: "Pending",
      deliveryAssignmentStatus: "NotStarted",
    });

    // Pre-fetch settings for various calculations
    const settings = await AppSettings.getSettings();

    let calculatedSubtotal = 0;
    const orderItemIds: mongoose.Types.ObjectId[] = [];
    const sellerIds = new Set<string>(); // Track unique sellers

    for (const item of items) {
      if (!item.product || !item.product.id) {
        throw new Error("Invalid item structure: product.id is missing");
      }

      const qty = Number(item.quantity) || 0;
      if (qty <= 0) {
        throw new Error("Invalid item quantity");
      }

      // Atomically check stock and decrement to prevent race conditions
      let product;
      // The frontend sends variation info as 'variant' or 'variation'
      // In the product model, it's stored in 'variations' array
      const variationValue = item.variant || item.variation;

      if (variationValue) {
        // Try to decrement stock for the specific variation first
        // We check variations._id, variations.value, variations.title, or variations.pack
        product = session
          ? await Product.findOneAndUpdate(
            {
              _id: item.product.id,
              $or: [
                {
                  "variations._id": mongoose.isValidObjectId(variationValue)
                    ? variationValue
                    : new mongoose.Types.ObjectId(),
                },
                { "variations.value": variationValue },
                { "variations.title": variationValue },
                { "variations.pack": variationValue },
              ],
              "variations.stock": { $gte: qty },
            },
            { $inc: { "variations.$.stock": -qty, stock: -qty } },
            { session, new: true },
          ).populate("category subcategory subSubCategory")
          : await Product.findOneAndUpdate(
            {
              _id: item.product.id,
              $or: [
                {
                  "variations._id": mongoose.isValidObjectId(variationValue)
                    ? variationValue
                    : new mongoose.Types.ObjectId(),
                },
                { "variations.value": variationValue },
                { "variations.title": variationValue },
                { "variations.pack": variationValue },
              ],
              "variations.stock": { $gte: qty },
            },
            { $inc: { "variations.$.stock": -qty, stock: -qty } },
            { new: true },
          ).populate("category subcategory subSubCategory");
      }

      if (!product) {
        // If we are here, either variationValue wasn't provided, or it didn't match any variation with enough stock.
        // We'll try to find the product first to see if it has variations.
        const checkProduct = await Product.findById(item.product.id).populate(
          "category subcategory subSubCategory",
        );

        if (
          checkProduct &&
          checkProduct.variations &&
          checkProduct.variations.length > 0
        ) {
          // Product has variations, but we didn't match one.
          // If a variation was provided, it means that specific variation is out of stock.
          if (variationValue) {
            throw new Error(
              `Insufficient stock for variation: ${variationValue}`,
            );
          }

          // No variation was provided, but the product has them.
          // To maintain data consistency, we'll try to decrement from the first variation.
          product = session
            ? await Product.findOneAndUpdate(
              {
                _id: item.product.id,
                "variations.0.stock": { $gte: qty },
              },
              { $inc: { "variations.0.stock": -qty, stock: -qty } },
              { session, new: true },
            ).populate("category subcategory subSubCategory")
            : await Product.findOneAndUpdate(
              {
                _id: item.product.id,
                "variations.0.stock": { $gte: qty },
              },
              { $inc: { "variations.0.stock": -qty, stock: -qty } },
              { new: true },
            ).populate("category subcategory subSubCategory");
        } else {
          // No variations, just decrement top-level stock
          product = session
            ? await Product.findOneAndUpdate(
              { _id: item.product.id, stock: { $gte: qty } },
              { $inc: { stock: -qty } },
              { session, new: true },
            ).populate("category subcategory subSubCategory")
            : await Product.findOneAndUpdate(
              { _id: item.product.id, stock: { $gte: qty } },
              { $inc: { stock: -qty } },
              { new: true },
            ).populate("category subcategory subSubCategory");
        }
      }

      if (!product) {
        throw new Error(
          `Insufficient stock or product not found: ${item.product.name || "ID: " + item.product.id}${variationValue ? " (" + variationValue + ")" : ""}`,
        );
      }

      // Track seller IDs to validate location
      if (product.seller) {
        sellerIds.add(product.seller.toString());
      }

      // Determine the price based on variation and discounts
      let selectedVariation;
      if (variationValue && product.variations) {
        selectedVariation = product.variations.find(
          (v: any) =>
            (v._id && v._id.toString() === variationValue) ||
            v.value === variationValue ||
            v.title === variationValue ||
            v.pack === variationValue,
        );
      }
      if (
        !selectedVariation &&
        product.variations &&
        product.variations.length > 0
      ) {
        // Fallback to first if no variation spec or not found (consistent with stock fallback)
        selectedVariation = product.variations[0];
      }

      const itemPrice =
        selectedVariation?.discPrice && selectedVariation.discPrice > 0
          ? selectedVariation.discPrice
          : product.discPrice && product.discPrice > 0
            ? product.discPrice
            : selectedVariation?.price || product.price || 0;
      const itemTotal = itemPrice * qty;
      calculatedSubtotal += itemTotal;

      // Calculate commission rate snapshot
      const commRate = await getOrderItemCommissionRate(
        product,
        product.seller.toString(),
        settings,
      );
      const commAmount = (itemTotal * commRate) / 100;

      // Create OrderItem
      const newOrderItemData = {
        order: newOrder._id,
        product: product._id,
        seller: product.seller,
        productName: product.productName,
        productImage: product.mainImage,
        sku: product.sku,
        unitPrice: itemPrice,
        quantity: qty,
        total: itemTotal,
        commissionRate: commRate,
        commissionAmount: commAmount,
        variation: variationValue,
        status: "Pending",
      };

      const newOrderItem = new OrderItem(newOrderItemData);
      if (session) {
        await newOrderItem.save({ session });
      } else {
        await newOrderItem.save();
      }
      orderItemIds.push(newOrderItem._id as mongoose.Types.ObjectId);
    }

    // Enforce minimum order value (cart subtotal of products)
    const minimumOrderValue = Number(settings?.minimumOrderValue) || 0;
    if (minimumOrderValue > 0 && calculatedSubtotal < minimumOrderValue) {
      if (session) await session.abortTransaction();
      const shortfall = Number((minimumOrderValue - calculatedSubtotal).toFixed(2));
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${minimumOrderValue}. Please add ₹${shortfall} more to place your order.`,
        data: {
          minimumOrderValue,
          currentSubtotal: Number(calculatedSubtotal.toFixed(2)),
          shortfall,
        },
      });
    }

    // Validate all sellers can deliver to user's location
    if (sellerIds.size > 0) {
      const uniqueSellerIds = Array.from(sellerIds).map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      // Find sellers and check if user is within their service radius
      const sellers = await Seller.find({
        _id: { $in: uniqueSellerIds },
        status: "Approved",
        location: { $exists: true, $ne: null },
      });

      // Check each seller can deliver to user's location
      for (const seller of sellers) {
        if (!seller.location || !seller.location.coordinates) {
          if (session) await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: `Seller ${seller.storeName} does not have a valid location. Order cannot be placed.`,
          });
        }

        const sellerLng = seller.location.coordinates[0];
        const sellerLat = seller.location.coordinates[1];
        const distance = calculateDistance(
          deliveryLat,
          deliveryLng,
          sellerLat,
          sellerLng,
        );
        const serviceRadius = seller.serviceRadiusKm || 10;

        if (distance > serviceRadius) {
          if (session) await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: `Your delivery address is ${distance.toFixed(2)} km away from ${seller.storeName}. They only deliver within ${serviceRadius} km. Please select products from sellers in your area.`,
          });
        }
      }
    }

    // Apply fees
    let platformFee = Number(fees?.platformFee) || 0;
    let deliveryFee = Number(fees?.deliveryFee) || 0;
    let deliveryDistanceKm = 0;

    // --- Delivery Charge Calculation (Standard vs Instant) ---
    try {
      const freeDeliveryThreshold = settings?.freeDeliveryThreshold || 0;

      // Check for Free Delivery eligibility first
      if (
        freeDeliveryThreshold > 0 &&
        calculatedSubtotal >= freeDeliveryThreshold
      ) {
        deliveryFee = 0;
      }
      // Standard Delivery flow: Always Fixed Price
      else if (deliveryOption === "Standard") {
        deliveryFee = settings.deliveryCharges ?? 0;
      }
      // Instant Delivery flow: Distance Based calculation
      else if (deliveryOption === "Instant" && settings.deliveryConfig) {
        const config = settings.deliveryConfig;

        // Collect seller locations
        const sellerLocations: { lat: number; lng: number }[] = [];
        const uniqueSellerIds = Array.from(sellerIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        );
        const sellers = await Seller.find({
          _id: { $in: uniqueSellerIds },
        }).select("location latitude longitude storeName");

        sellers.forEach((seller) => {
          let lat, lng;
          if (seller.location?.coordinates?.length === 2) {
            lng = seller.location.coordinates[0];
            lat = seller.location.coordinates[1];
          } else if (seller.latitude && seller.longitude) {
            lat = parseFloat(seller.latitude);
            lng = parseFloat(seller.longitude);
          }

          if (lat && lng) {
            sellerLocations.push({ lat, lng });
          }
        });

        if (sellerLocations.length > 0 && deliveryLat && deliveryLng) {
          // Get distances (Road or Air based on API Key presence)
          const distances = await getRoadDistances(
            sellerLocations,
            { lat: deliveryLat, lng: deliveryLng },
            config.googleMapsKey,
          );

          // Take the maximum distance (furthest seller)
          deliveryDistanceKm = Math.max(...distances);

          // Calculate Fee
          // Formula: BaseCharge + (Max(0, Distance - BaseDistance) * KmRate)
          const extraKm = Math.max(0, deliveryDistanceKm - config.baseDistance);
          const calculatedDeliveryFee =
            config.baseCharge + extraKm * config.kmRate;

          // Override the delivery fee
          deliveryFee = Math.ceil(calculatedDeliveryFee);

          console.log(
            `DEBUG: Instant Delivery (Distance-based): MaxDistance=${deliveryDistanceKm}km, Fee=${deliveryFee} (Base: ${config.baseCharge}, Rate: ${config.kmRate}/km)`,
          );
        }
      } else {
        // Fallback: If no settings or unhandled option, use provided fee or default
        const providedDeliveryFee = Number(fees?.deliveryFee);
        deliveryFee = Number.isFinite(providedDeliveryFee)
          ? providedDeliveryFee
          : settings?.deliveryCharges ?? 0;
      }
    } catch (calcError) {
      console.error("Error calculating delivery fee:", calcError);
      // Fallback to provided fee or settings default (using pre-fetched settings)
      const providedDeliveryFee = Number(fees?.deliveryFee);
      deliveryFee = Number.isFinite(providedDeliveryFee)
        ? providedDeliveryFee
        : settings?.deliveryCharges ?? 0;
    }

    const finalTipAmount = Number(tipAmount) || 0;
    const giftPackagingFee = giftPackaging ? 30 : 0;

    // The base amount for coupon eligibility and calculation
    // Matches frontend's subtotalBeforeCoupon (calculatedSubtotal is essentially discountedTotal)
    const baseForCoupon = calculatedSubtotal + platformFee + deliveryFee;
    let discountAmount = 0;

    // Validate and Apply Coupon
    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      try {
        const normalizedCode = couponCode.trim().toUpperCase();
        const coupon = await Coupon.findOne({
          code: normalizedCode,
          isActive: true,
        });

        if (coupon) {
          const now = new Date();
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);

          // Use the same leniency as getCoupons
          if (now >= coupon.startDate && startOfToday <= coupon.endDate) {
            // Check usage limit
            if (
              !coupon.usageLimit ||
              coupon.usageCount < coupon.usageLimit
            ) {
              // Check minimum purchase (on baseForCoupon)
              if (
                !coupon.minimumPurchase ||
                baseForCoupon >= coupon.minimumPurchase
              ) {
                // Calculate discount
                if (coupon.discountType === "Percentage") {
                  discountAmount =
                    (baseForCoupon * coupon.discountValue) / 100;
                  if (
                    coupon.maximumDiscount &&
                    discountAmount > coupon.maximumDiscount
                  ) {
                    discountAmount = coupon.maximumDiscount;
                  }
                } else {
                  discountAmount = coupon.discountValue;
                }

                // Increment usage count
                await Coupon.findByIdAndUpdate(coupon._id, {
                  $inc: { usageCount: 1 },
                });

                newOrder.couponCode = normalizedCode;
                newOrder.discount = Number(discountAmount.toFixed(2));
                console.log(
                  `📢 Applied coupon ${normalizedCode}: ₹${discountAmount.toFixed(2)} discount`,
                );
              } else {
                console.warn(
                  `⚠️ Coupon ${normalizedCode} rejected: min purchase ₹${coupon.minimumPurchase} not met (Base: ₹${baseForCoupon})`,
                );
              }
            } else {
              console.warn(
                `⚠️ Coupon ${normalizedCode} rejected: usage limit ${coupon.usageLimit} reached`,
              );
            }
          } else {
            console.warn(`⚠️ Coupon ${normalizedCode} rejected: expired or not yet valid`);
          }
        } else {
          console.warn(`⚠️ Coupon code ${normalizedCode} not found or inactive`);
        }
      } catch (couponError) {
        console.error("❌ Error applying coupon:", couponError);
        // We continue with the order even if coupon fails
      }
    }

    const finalTotal = Math.max(0, baseForCoupon + finalTipAmount + giftPackagingFee - discountAmount);

    // Update Order with calculated values and items
    newOrder.subtotal = Number(calculatedSubtotal.toFixed(2));
    newOrder.total = Number(finalTotal.toFixed(2));
    newOrder.grandTotal = Number(finalTotal.toFixed(2)); // Sync grandTotal alias
    newOrder.items = orderItemIds;
    newOrder.shipping = deliveryFee; // Update with calculated fee
    newOrder.deliveryDistanceKm = deliveryDistanceKm; // Store distance for commission calc

    if (session) {
      await newOrder.save({ session });
      await session.commitTransaction();
    } else {
      // Validate before saving to catch errors with details
      const validationError = newOrder.validateSync();
      if (validationError) {
        console.error("DEBUG: Order Validation Error:", validationError.errors);
        throw validationError;
      }
      await newOrder.save();
    }

    // Emit notification to all involved sellers (non-blocking for performance)
    try {
      const io: SocketIOServer = req.app.get("io") as SocketIOServer;
      if (io) {
        // Only notify sellers immediately if it's a COD order
        // Online orders will notify after payment verification in paymentService
        if (paymentMethod === "COD") {
          // Use newOrder directly - notifySellersOfOrderUpdate will handle fetching items if needed
          notifySellersOfOrderUpdate(io, newOrder, "NEW_ORDER");
          console.log(
            `📢 [COD] Async seller notification triggered for order ${newOrder.orderNumber}`,
          );
        } else {
          console.log(
            `⏳ [Online] Seller notification deferred for order ${newOrder.orderNumber} until payment success`,
          );
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the order creation
      console.error("Error notifying sellers:", notificationError);
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: newOrder,
    });
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError);
      }
    }

    console.error("DEBUG: Order Creation Error Detail:", {
      message: error.message,
      name: error.name,
      errors: error.errors
        ? Object.keys(error.errors).map((key) => ({
          field: key,
          message: error.errors[key].message,
          value: error.errors[key].value,
        }))
        : undefined,
      stack: error.stack,
      body: req.body,
    });

    // Return a more informative error message if it's a validation error
    let errorMessage = "Error creating order. " + error.message;
    if (error.name === "ValidationError") {
      const fields = Object.keys(error.errors).join(", ");
      errorMessage = `Validation failed for fields: ${fields}. ${error.message}`;
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: error.errors,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (session) session.endSession();
  }
};

// Get authenticated customer's orders
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = { customer: userId };

    if (status) {
      query.status = status; // Note: Model field is 'status', not 'orderStatus'
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate({
        path: "items",
        populate: { path: "product", select: "productName mainImage price" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    // Transform orders to match frontend Order type
    const transformedOrders = orders.map((order) => {
      const orderObj = order.toObject();
      return {
        ...orderObj,
        id: orderObj._id.toString(),
        totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
        totalAmount: orderObj.total,
        fees: {
          platformFee: orderObj.platformFee || 0,
          deliveryFee: orderObj.shipping || 0,
        },
        // Keep original fields for backward compatibility
        subtotal: orderObj.subtotal,
        address: orderObj.deliveryAddress,
      };
    });

    return res.status(200).json({
      success: true,
      data: transformedOrders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Find order and ensure it belongs to the user
    const order = await Order.findOne({ _id: id, customer: userId })
      .populate({
        path: "items",
        populate: [
          {
            path: "product",
            select: "productName mainImage pack manufacturer price",
          },
          { path: "seller", select: "storeName city phone fssaiLicNo" },
        ],
      })
      .populate("deliveryBoy", "name phone profileImage vehicleNumber");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get customer's permanent delivery OTP
    const customer = await Customer.findById(userId).select("deliveryOtp");
    const deliveryOtp = customer?.deliveryOtp;

    // Transform order to match frontend Order type
    const orderObj = order.toObject();
    const transformedOrder = {
      ...orderObj,
      id: orderObj._id.toString(),
      totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
      totalAmount: orderObj.total,
      fees: {
        platformFee: orderObj.platformFee || 0,
        deliveryFee: orderObj.shipping || 0,
      },
      // Keep original fields for backward compatibility
      subtotal: orderObj.subtotal,
      address: orderObj.deliveryAddress,
      // Include invoice enabled flag
      invoiceEnabled: orderObj.invoiceEnabled || false,
      // Include customer's permanent delivery OTP
      deliveryOtp,
      // Map deliveryBoy to deliveryPartner for frontend
      deliveryPartner: orderObj.deliveryBoy,
    };

    return res.status(200).json({
      success: true,
      data: transformedOrder,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching order detail",
      error: error.message,
    });
  }
};

/**
 * Refresh Delivery OTP
 */
export const refreshDeliveryOtp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const order = await Order.findOne({ _id: id, customer: userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status === "Delivered") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already delivered" });
    }

    // Generate and send new OTP
    const result = await generateDeliveryOtp(id);

    // Emit socket event if needed (customer room)
    const io = (req.app as any).get("io");
    if (io) {
      io.to(`order-${id}`).emit("delivery-otp-refreshed", {
        orderId: id,
        deliveryOtp: order.deliveryOtp, // The service saves it to the order
        expiresAt: order.deliveryOtpExpiresAt,
      });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error refreshing delivery OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh delivery OTP",
      error: error.message,
    });
  }
};

// Cancel Order
export const cancelOrder = async (req: Request, res: Response) => {
  let session: mongoose.ClientSession | null = null;
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Cancellation reason is required" });
    }

    // Only start session if we are on a replica set (required for transactions)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionError) {
      console.warn(
        "MongoDB Transactions not supported or failed to start. Proceeding without transaction.",
      );
      session = null;
    }

    const order = session
      ? await Order.findOne({ _id: id, customer: userId }).session(session)
      : await Order.findOne({ _id: id, customer: userId });

    if (!order) {
      if (session) await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      [
        "Delivered",
        "Cancelled",
        "Returned",
        "Rejected",
        "Out for Delivery",
        "Shipped",
      ].includes(order.status)
    ) {
      if (session) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled as it is already ${order.status}`,
      });
    }

    // Restore stock
    for (const item of order.items) {
      const orderItem = session
        ? await OrderItem.findById(item).session(session)
        : await OrderItem.findById(item);

      if (orderItem) {
        const product = session
          ? await Product.findById(orderItem.product).session(session)
          : await Product.findById(orderItem.product);

        if (product) {
          // Check if it was a variation
          if (orderItem.variation) {
            // Try to find matching variation
            const variationIndex = product.variations?.findIndex(
              (v: any) =>
                v.value === orderItem.variation ||
                v.title === orderItem.variation ||
                v.pack === orderItem.variation,
            );

            if (
              variationIndex !== undefined &&
              variationIndex !== -1 &&
              product.variations &&
              product.variations[variationIndex]
            ) {
              const currentStock =
                product.variations[variationIndex].stock || 0;
              product.variations[variationIndex].stock =
                currentStock + orderItem.quantity;
            } else if (product.variations && product.variations.length > 0) {
              // Fallback to first variation if specific one not found (should be rare)
              const currentStock = product.variations[0].stock || 0;
              product.variations[0].stock = currentStock + orderItem.quantity;
            }
          }

          // Helper: also increment main stock if variations are just attributes or if simple product
          product.stock += orderItem.quantity;
          if (session) {
            await product.save({ session });
          } else {
            await product.save();
          }
        }

        orderItem.status = "Cancelled";
        if (session) {
          await orderItem.save({ session });
        } else {
          await orderItem.save();
        }
      }
    }

    order.status = "Cancelled";
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.cancelledBy = new mongoose.Types.ObjectId(userId); // Use Customer ID as canceller

    // So delivery boy is no longer "busy" and can take next order
    if (order.deliveryBoy) {
      order.deliveryBoyStatus = "Failed";
    }

    if (session) {
      await order.save({ session });
      await session.commitTransaction();
    } else {
      await order.save();
    }

    // Mark DeliveryAssignment as Cancelled so delivery boy is available for new orders
    if (order.deliveryBoy) {
      await DeliveryAssignment.findOneAndUpdate(
        { order: order._id },
        { status: "Cancelled", failedAt: new Date(), failureReason: "Order cancelled by customer" },
        { new: true }
      ).exec();
    }

    // Notify
    try {
      const io = (req.app as any).get("io");
      if (io) {
        await notifySellersOfOrderUpdate(io, order, "ORDER_CANCELLED");

        // Notify delivery boy so they know order is cancelled and can take next order
        if (order.deliveryBoy) {
          const deliveryBoyId = order.deliveryBoy.toString();
          io.to(`delivery-${deliveryBoyId}`).emit("order-cancelled", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: "Cancelled",
            message: "Order has been cancelled by the customer. You are now available for the next order.",
          });

          console.log(
            `Notification sent to delivery boy ${deliveryBoyId} for cancelled order ${order.orderNumber}`,
          );
        }

        // Emit to order room for real-time updates on tracking screen
        io.to(`order-${order._id}`).emit("order-cancelled", {
          orderId: order._id,
          status: "Cancelled",
          message: "Order has been cancelled",
        });
      }
    } catch (err) {
      console.error("Notification error:", err);
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        id: order._id,
        status: order.status,
        cancelledAt: order.cancelledAt,
      },
    });
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (e) { }
    }
    console.error("Error cancelling order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  } finally {
    if (session) session.endSession();
  }
};

// Update Order Notes (Instructions/Special Requests)
export const updateOrderNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deliveryInstructions, specialRequests } = req.body;
    const userId = req.user!.userId;

    const order = await Order.findOne({ _id: id, customer: userId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (["Delivered", "Cancelled", "Returned"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update notes for ${order.status} order`,
      });
    }

    if (deliveryInstructions !== undefined)
      order.deliveryInstructions = deliveryInstructions;
    if (specialRequests !== undefined) order.specialRequests = specialRequests;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order notes updated",
      data: {
        deliveryInstructions: order.deliveryInstructions,
        specialRequests: order.specialRequests,
      },
    });
  } catch (error: any) {
    console.error("Error updating order notes:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order notes",
      error: error.message,
    });
  }
};
