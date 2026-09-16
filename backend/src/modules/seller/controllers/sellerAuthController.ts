import { Request, Response } from "express";
import Seller from "../../../models/Seller";
import {
  sendOTP as sendOTPService,
  verifyOTP as verifyOTPService,
} from "../../../services/otpService";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";

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

  // Location validation: for QUICK_COMMERCE and HYBRID, store GPS coordinates are required
  const latitude = req.body.latitude ? parseFloat(req.body.latitude) : null;
  const longitude = req.body.longitude ? parseFloat(req.body.longitude) : null;

  if (vendorType === "QUICK_COMMERCE" || vendorType === "HYBRID") {
    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Store location GPS coordinates (latitude and longitude) are required for Quick Commerce",
      });
    }
  }

  if (
    latitude !== null &&
    longitude !== null &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid location coordinates",
    });
  }

  // Shipping configuration for Ecommerce / Hybrid
  const rawPincode = req.body.shippingConfig?.pickupPincode || req.body.pickupPincode;
  const rawPickupAddress = req.body.shippingConfig?.pickupAddress || req.body.pickupAddress || address;

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
  }

  const shippingConfig = req.body.shippingConfig ? {
    pickupAddress: rawPickupAddress,
    pickupPincode: rawPincode,
    warehouseAddress: req.body.shippingConfig.warehouseAddress || rawPickupAddress,
    returnAddress: req.body.shippingConfig.returnAddress || rawPickupAddress,
    freeShippingThreshold: Number(req.body.shippingConfig.freeShippingThreshold) || 0,
    flatShippingFee: Number(req.body.shippingConfig.flatShippingFee) || 0,
  } : (rawPincode || rawPickupAddress) ? {
    pickupAddress: rawPickupAddress,
    pickupPincode: rawPincode,
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

  // Create GeoJSON location point [longitude, latitude] if provided
  const location =
    longitude !== null && latitude !== null && !isNaN(longitude) && !isNaN(latitude)
      ? {
          type: "Point" as const,
          coordinates: [longitude, latitude],
        }
      : undefined;

  // Create new seller with GeoJSON location
  const seller = await Seller.create({
    sellerName,
    mobile,
    email,
    storeName,
    category,
    address,
    city,
    ...(serviceableArea && { serviceableArea }),
    searchLocation: req.body.searchLocation,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    location, // GeoJSON location for geospatial queries
    serviceRadiusKm, // Service radius in kilometers
    vendorType,
    ...(shippingConfig && { shippingConfig }),
    status: "Pending",
    requireProductApproval: false,
    viewCustomerDetails: false,
    commission: 0,
    balance: 0,
    categories:
      Array.isArray(req.body.categories) && req.body.categories.length > 0
        ? req.body.categories
        : [category],
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
