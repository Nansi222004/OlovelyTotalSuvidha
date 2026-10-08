import { Request, Response } from "express";
import Seller from "../../../models/Seller";
import OrderItem from "../../../models/OrderItem";
import Return from "../../../models/Return";
import WithdrawRequest from "../../../models/WithdrawRequest";
import Product from "../../../models/Product";
import {
  sendOTP as sendOTPService,
  verifyOTP as verifyOTPService,
} from "../../../services/otpService";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";
import { isVendorTypeAllowed } from "../../../services/commerceChannelService";
import { cleanupSellerShiprocketPickup } from "../../../services/shipping/shiprocketPickupService";
import { validateSellerRegistrationLocation } from "../../../utils/sellerLocationValidation";
import HeaderCategory from "../../../models/HeaderCategory";
import Category from "../../../models/Category";
import {
  normalizeSelectedCategoryNames,
  validateSellerCategorySelection,
  type CommerceChannel,
  type SellerVendorType,
} from "../../../utils/sellerCategoryCompatibility";

/**
 * Safe boolean parser to avoid JavaScript `Boolean("false") === true` trap.
 * Only returns true for actual boolean `true`, number 1, or string "true" / "1".
 * Returns false for false, 0, "false", "0", or missing values.
 */
export function parseSafeBoolean(val: any, defaultVal: boolean = false): boolean {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (typeof val === "string") {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  return defaultVal;
}

/**
 * Send OTP to seller mobile number
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body;

  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  // Check if seller exists with this mobile
  const seller = await Seller.findOne({ mobile });
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found with this mobile number",
    });
  }

  // Send OTP - for login, always use default OTP
  const result = await sendOTPService(mobile, "Seller", true);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Verify OTP and login seller
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, otp } = req.body;

  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  if (!otp || !/^[0-9]{4}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "Valid 4-digit OTP is required",
    });
  }

  // Verify OTP
  const isValid = await verifyOTPService(mobile, otp, "Seller");
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  // Find seller
  const seller = await Seller.findOne({ mobile }).select("-password");
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found",
    });
  }

  // Generate JWT token
  const token = generateToken(seller._id.toString(), "Seller");

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: seller._id,
        sellerName: seller.sellerName,
        mobile: seller.mobile,
        email: seller.email,
        storeName: seller.storeName,
        status: seller.status,
        logo: seller.logo,
        address: seller.address,
        city: seller.city,
        vendorType: seller.vendorType || 'QUICK_COMMERCE',
        wholesaleEnabled: parseSafeBoolean(seller.wholesaleEnabled, false),
        shippingConfig: seller.shippingConfig,
      },
    },
  });
});

/**
 * Register new seller
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    sellerName,
    mobile,
    email,
    storeName,
    category,
    address,
    city,
    serviceableArea,
  } = req.body;

  // Validation (password removed - sellers don't need password during signup)
  if (!sellerName || !mobile || !email || !storeName || !category) {
    return res.status(400).json({
      success: false,
      message:
        "Required fields (Name, Mobile, Email, Store Name, Category) must be provided",
    });
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  // Validate location is provided
  // Validate vendorType if provided
  let vendorType = req.body.vendorType || "QUICK_COMMERCE";
  if (!["QUICK_COMMERCE", "ECOMMERCE", "HYBRID"].includes(vendorType)) {
    return res.status(400).json({
      success: false,
      message: "vendorType must be one of 'QUICK_COMMERCE', 'ECOMMERCE', 'HYBRID'",
    });
  }

  // Authoritative global commerce channel validation
  const vendorTypeCheck = await isVendorTypeAllowed(vendorType);
  if (!vendorTypeCheck.allowed) {
    return res.status(400).json({
      success: false,
      message: vendorTypeCheck.reason || `Vendor type ${vendorType} is currently unavailable.`,
    });
  }

  // Parse and validate service radius for QC / Hybrid
  let serviceRadiusKm = 10; // Default 10km
  if (
    req.body.serviceRadiusKm !== undefined &&
    req.body.serviceRadiusKm !== null &&
    req.body.serviceRadiusKm !== ""
  ) {
    const parsedRadius =
      typeof req.body.serviceRadiusKm === "string"
        ? parseFloat(req.body.serviceRadiusKm)
        : Number(req.body.serviceRadiusKm);

    if (!isNaN(parsedRadius) && parsedRadius >= 0.1 && parsedRadius <= 300) {
      serviceRadiusKm = parsedRadius;
    } else {
      return res.status(400).json({
        success: false,
        message: "Service radius must be between 0.1 and 300 kilometers",
      });
    }
  }

  // Every seller channel needs one canonical human-readable store/pickup
  // address and map point. QC uses it for radius serviceability; Ecommerce
  // retains it as business/pickup data without applying the QC radius.
  const sellerLocation = validateSellerRegistrationLocation(req.body);
  if (!sellerLocation.valid) {
    return res.status(400).json({
      success: false,
      message: sellerLocation.message,
    });
  }

  const selectedCategories = normalizeSelectedCategoryNames(category, req.body.categories);
  const selectedHeaderCategories = await HeaderCategory.find({
    status: "Published",
    name: { $in: selectedCategories },
  }).select("name").lean();
  const childCategoryRows = await Category.find({
    status: "Active",
    headerCategoryId: { $in: selectedHeaderCategories.map((entry) => entry._id) },
  }).select("headerCategoryId commerceChannels").lean();
  const channelsByHeader = new Map<string, Set<CommerceChannel>>();
  for (const child of childCategoryRows) {
    if (!child.headerCategoryId) continue;
    const key = child.headerCategoryId.toString();
    const channels = channelsByHeader.get(key) || new Set<CommerceChannel>();
    for (const channel of child.commerceChannels || []) channels.add(channel as CommerceChannel);
    channelsByHeader.set(key, channels);
  }
  const categorySelection = validateSellerCategorySelection(
    vendorType as SellerVendorType,
    selectedCategories,
    selectedHeaderCategories.map((entry) => ({
      name: entry.name,
      commerceChannels: Array.from(channelsByHeader.get(entry._id.toString()) || []),
    }))
  );
  if (!categorySelection.valid) {
    return res.status(400).json({ success: false, message: categorySelection.message });
  }
  const { latitude, longitude, location } = sellerLocation.data;

  // Shipping configuration for Ecommerce / Hybrid
  const rawPincode = req.body.shippingConfig?.pickupPincode || req.body.pickupPincode;
  const rawPickupAddress = req.body.shippingConfig?.pickupAddress || req.body.pickupAddress || sellerLocation.data.address;
  const rawPickupCity = req.body.shippingConfig?.pickupCity || req.body.pickupCity || city;
  const rawPickupState = req.body.shippingConfig?.pickupState || req.body.pickupState;

  if (vendorType === "ECOMMERCE" || vendorType === "HYBRID") {
    if (!rawPincode || !/^[1-9][0-9]{5}$/.test(String(rawPincode).trim())) {
      return res.status(400).json({
        success: false,
        message: "A valid 6-digit Indian pickup pincode is required for Ecommerce shipping configuration",
      });
    }
    if (!rawPickupAddress || String(rawPickupAddress).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Pickup/warehouse address is required for Ecommerce shipping configuration",
      });
    }
    if (!rawPickupCity || String(rawPickupCity).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Pickup city is required for Ecommerce shipping configuration",
      });
    }
    if (!rawPickupState || String(rawPickupState).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Pickup state is required for Ecommerce shipping configuration",
      });
    }
  }

  const shippingConfig = req.body.shippingConfig ? {
    pickupAddress: rawPickupAddress,
    pickupPincode: rawPincode,
    pickupCity: rawPickupCity,
    pickupState: rawPickupState,
    warehouseAddress: req.body.shippingConfig.warehouseAddress || rawPickupAddress,
    returnAddress: req.body.shippingConfig.returnAddress || rawPickupAddress,
    freeShippingThreshold: Number(req.body.shippingConfig.freeShippingThreshold) || 0,
    flatShippingFee: Number(req.body.shippingConfig.flatShippingFee) || 0,
  } : (rawPincode || rawPickupAddress) ? {
    pickupAddress: rawPickupAddress,
    pickupPincode: rawPincode,
    pickupCity: rawPickupCity,
    pickupState: rawPickupState,
  } : undefined;

  // Check if seller already exists
  const existingSeller = await Seller.findOne({
    $or: [{ mobile }, { email }],
  });

  if (existingSeller) {
    return res.status(409).json({
      success: false,
      message: "Seller already exists with this mobile or email",
    });
  }

  // Create new seller with GeoJSON location
  const seller = await Seller.create({
    sellerName,
    mobile,
    email,
    storeName,
    category: selectedCategories[0],
    address: sellerLocation.data.address,
    city,
    ...(serviceableArea && { serviceableArea }),
    searchLocation: req.body.searchLocation,
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    location, // GeoJSON location for geospatial queries
    serviceRadiusKm, // Service radius in kilometers
    vendorType,
    ...(shippingConfig && { shippingConfig }),
    status: "Pending",
    requireProductApproval: false,
    viewCustomerDetails: false,
    commission: 0,
    balance: 0,
    categories: selectedCategories,
    wholesaleEnabled: parseSafeBoolean(req.body.wholesaleEnabled, false),
  });

  // Generate token
  const token = generateToken(seller._id.toString(), "Seller");

  return res.status(201).json({
    success: true,
    message: "Seller registered successfully. Awaiting admin approval.",
    data: {
      token,
      user: {
        id: seller._id,
        sellerName: seller.sellerName,
        mobile: seller.mobile,
        email: seller.email,
        storeName: seller.storeName,
        status: seller.status,
        address: seller.address,
        city: seller.city,
        vendorType: seller.vendorType,
        wholesaleEnabled: seller.wholesaleEnabled || false,
        shippingConfig: seller.shippingConfig,
      },
    },
  });
});

/**
 * Get seller's profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;

  const seller = await Seller.findById(sellerId).select("-password");
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: seller,
  });
});

/**
 * Update seller's profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const updates = req.body;

    // Prevent updating sensitive fields directly
    const restrictedFields = [
      "password",
      "mobile",
      "email",
      "status",
      "balance",
    ];
    restrictedFields.forEach((field) => delete updates[field]);

    // Handle location update (convert lat/lng to GeoJSON)
    if (updates.latitude && updates.longitude) {
      const latitude = parseFloat(updates.latitude);
      const longitude = parseFloat(updates.longitude);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Update GeoJSON location for geospatial queries
        updates.location = {
          type: "Point",
          coordinates: [longitude, latitude], // MongoDB GeoJSON: [longitude, latitude]
        };
        // Ensure string fields are also synchronized
        updates.latitude = latitude.toString();
        updates.longitude = longitude.toString();
      }
    }

    // Handle serviceRadiusKm update
    if (
      updates.serviceRadiusKm !== undefined &&
      updates.serviceRadiusKm !== null &&
      updates.serviceRadiusKm !== ""
    ) {
      const radius =
        typeof updates.serviceRadiusKm === "string"
          ? parseFloat(updates.serviceRadiusKm)
          : Number(updates.serviceRadiusKm);

      if (!isNaN(radius) && radius >= 0.1 && radius <= 300) {
        updates.serviceRadiusKm = radius; // Ensure it's saved as a number
      } else {
        return res.status(400).json({
          success: false,
          message: "Service radius must be between 0.1 and 300 kilometers",
        });
      }
    } else if (
      updates.serviceRadiusKm === "" ||
      updates.serviceRadiusKm === null
    ) {
      // If empty string or null is sent, remove it from updates to keep existing value
      delete updates.serviceRadiusKm;
    }

    // Handle category compatibility validation if categories are being updated
    if (updates.categories !== undefined || updates.category !== undefined) {
      const existingSeller = await Seller.findById(sellerId).select("vendorType");
      const effectiveVendorType = (updates.vendorType || existingSeller?.vendorType || "QUICK_COMMERCE") as SellerVendorType;
      const selectedCategories = normalizeSelectedCategoryNames(updates.category, updates.categories);
      if (selectedCategories.length > 0) {
        const selectedHeaderCategories = await HeaderCategory.find({
          status: "Published",
          name: { $in: selectedCategories },
        }).select("name").lean();
        const childCategoryRows = await Category.find({
          status: "Active",
          headerCategoryId: { $in: selectedHeaderCategories.map((entry) => entry._id) },
        }).select("headerCategoryId commerceChannels").lean();
        const channelsByHeader = new Map<string, Set<CommerceChannel>>();
        for (const child of childCategoryRows) {
          if (!child.headerCategoryId) continue;
          const key = child.headerCategoryId.toString();
          const channels = channelsByHeader.get(key) || new Set<CommerceChannel>();
          for (const channel of child.commerceChannels || []) channels.add(channel as CommerceChannel);
          channelsByHeader.set(key, channels);
        }
        const categorySelection = validateSellerCategorySelection(
          effectiveVendorType,
          selectedCategories,
          selectedHeaderCategories.map((entry) => ({
            name: entry.name,
            commerceChannels: Array.from(channelsByHeader.get(entry._id.toString()) || []),
          }))
        );
        if (!categorySelection.valid) {
          return res.status(400).json({ success: false, message: categorySelection.message });
        }
        updates.categories = selectedCategories;
        updates.category = selectedCategories[0];
      }
    }

    const seller = await Seller.findByIdAndUpdate(sellerId, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: seller,
    });
  },
);

/**
 * Toggle shop status (Open/Close)
 */
export const toggleShopStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;

    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Handle undefined case - if isShopOpen is undefined, default to true (open) then toggle to false
    // This ensures backward compatibility with sellers created before this field was added
    if (seller.isShopOpen === undefined) {
      seller.isShopOpen = false; // Toggle from default "open" to "closed"
    } else {
      seller.isShopOpen = !seller.isShopOpen; // Normal toggle
    }

    // Fix invalid GeoJSON location objects
    // MongoDB requires that if location.type is "Point", coordinates must be a valid array
    if (seller.location && seller.location.type === "Point") {
      if (
        !seller.location.coordinates ||
        !Array.isArray(seller.location.coordinates) ||
        seller.location.coordinates.length !== 2
      ) {
        // Invalid location object - remove it to prevent validation error
        seller.location = undefined;
      }
    }

    await seller.save();

    return res.status(200).json({
      success: true,
      message: `Shop is now ${seller.isShopOpen ? "Open" : "Closed"}`,
      data: { isShopOpen: seller.isShopOpen },
    });
  },
);

/**
 * Self-service Account Deletion for Authenticated Seller
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user?.userId;

  if (!sellerId || (req as any).user?.userType !== "Seller") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only sellers can delete their seller account.",
    });
  }

  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return res.status(401).json({
      success: false,
      code: "SELLER_DELETED",
      message: "Seller account is no longer available. Please log in again.",
    });
  }

  // 1. Check for active/pending orders or items awaiting fulfillment
  const activeItemsCount = await OrderItem.countDocuments({
    seller: sellerId,
    status: { $in: ["Pending", "Shipped"] },
  });

  if (activeItemsCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Your account cannot be deleted while you have pending orders or unfulfilled items.",
    });
  }

  // 2. Check for pending returns or exchanges
  const sellerItems = await OrderItem.find({ seller: sellerId }).select("_id");
  const sellerItemIds = sellerItems.map((item) => item._id);

  if (sellerItemIds.length > 0) {
    const activeReturnsCount = await Return.countDocuments({
      orderItem: { $in: sellerItemIds },
      status: {
        $in: [
          "Pending",
          "Approved",
          "Pickup Pending",
          "Delivery Partner Assigned",
          "Picked Up",
          "In Transit",
          "Handed To Seller",
        ],
      },
    });

    if (activeReturnsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Your account cannot be deleted while you have pending returns or exchanges.",
      });
    }
  }

  // 3. Check for positive wallet balance or pending settlements
  if (
    (seller.balance && seller.balance > 0) ||
    (seller.onHoldBalance && seller.onHoldBalance > 0)
  ) {
    return res.status(400).json({
      success: false,
      message: `Your account cannot be deleted while you have pending settlements or an active wallet balance (₹${(seller.balance || 0).toFixed(2)}). Please withdraw or settle your balance before deleting your account.`,
    });
  }

  // 4. Check for pending withdrawal requests
  const pendingWithdrawalCount = await WithdrawRequest.countDocuments({
    userId: sellerId,
    userType: "SELLER",
    status: { $in: ["Pending", "Approved"] },
  });

  if (pendingWithdrawalCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Your account cannot be deleted while you have a pending withdrawal request in progress.",
    });
  }

  // 5. Retire and audit the seller-owned courier pickup before removing its owner record.
  await cleanupSellerShiprocketPickup(seller);

  // 6. Deactivate / unpublish seller's active products
  try {
    await Product.updateMany(
      { seller: sellerId },
      { status: "Inactive", publish: false }
    );
  } catch (prodErr) {
    console.warn("[DELETE_SELLER_ACCOUNT] Product deactivation warning:", prodErr);
  }

  // 7. Delete seller document
  const deleted = await Seller.findByIdAndDelete(sellerId);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Seller account not found",
    });
  }

  // Historical orders, order items, payouts, and financial transactions are preserved.
  return res.status(200).json({
    success: true,
    message: "Your account has been deleted successfully. You have been logged out.",
  });
});
