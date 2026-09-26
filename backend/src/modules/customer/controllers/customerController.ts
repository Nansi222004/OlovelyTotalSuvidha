import { Request, Response } from "express";
import Customer from "../../../models/Customer";
import Address from "../../../models/Address";
import SupportedLanguage from "../../../models/SupportedLanguage";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get customer profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  const customer = await Customer.findById(userId);

  if (!customer) {
    return res.status(401).json({
      success: false,
      code: "CUSTOMER_DELETED",
      message: "Customer account is no longer available. Please log in again.",
    });
  }

  // Auto-heal placeholder name ("User" or empty) if a valid Address exists with a real recipient name
  // Protection: If the customer already has a real name (e.g. "Nansi"), it is NEVER overwritten.
  const currentName = (customer.name || "").trim();
  if (!currentName || currentName.toLowerCase() === "user") {
    try {
      const defaultAddress = await Address.findOne({
        customer: userId,
        fullName: { $exists: true, $ne: "" },
      }).sort({ isDefault: -1, updatedAt: -1 });

      if (defaultAddress && defaultAddress.fullName && defaultAddress.fullName.trim().toLowerCase() !== "user") {
        const formatted = defaultAddress.fullName
          .trim()
          .split(/\s+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

        if (formatted && formatted.toLowerCase() !== "user") {
          customer.name = formatted;
          await customer.save();
          if (process.env.NODE_ENV !== "production") {
            console.log("[GET_PROFILE] Auto-healed placeholder customer name to:", formatted);
          }
        }
      }
    } catch (healErr) {
      console.warn("[GET_PROFILE] Non-blocking auto-heal warning:", healErr);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      dateOfBirth: customer.dateOfBirth,
      registrationDate: customer.registrationDate,
      status: customer.status,
      refCode: customer.refCode,
      walletAmount: customer.walletAmount,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      locationUpdatedAt: customer.locationUpdatedAt,
      preferredLanguage: customer.preferredLanguage || null,
    },
  });
});

/**
 * Update customer language preference
 * PUT /api/v1/customer/language
 */
export const updateLanguagePreference = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { language, preferredLanguage } = req.body;
    const targetLang = language || preferredLanguage;

    if (!userId || (req as any).user?.userType !== "Customer") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or not a customer",
      });
    }

    if (!targetLang || typeof targetLang !== "string" || !targetLang.trim()) {
      return res.status(400).json({
        success: false,
        message: "Language code is required",
      });
    }

    const cleanCode = targetLang.trim().toLowerCase();

    // Validate that language exists in SupportedLanguage and is active
    const activeLang = await SupportedLanguage.findOne({
      code: cleanCode,
      isActive: true,
    });

    if (!activeLang) {
      return res.status(400).json({
        success: false,
        message: "Selected language is invalid or inactive",
      });
    }

    const customer = await Customer.findById(userId);

    if (!customer) {
      return res.status(401).json({
        success: false,
        code: "CUSTOMER_DELETED",
        message: "Customer account is no longer available. Please log in again.",
      });
    }

    customer.preferredLanguage = cleanCode;
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Language preference updated successfully",
      data: {
        preferredLanguage: customer.preferredLanguage,
      },
    });
  }
);

/**
 * Update customer profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { name, email, dateOfBirth, notificationPreferences, accountPrivacy } = req.body;


    if (!userId || (req as any).user?.userType !== "Customer") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or not a customer",
      });
    }

    const customer = await Customer.findById(userId);

    if (!customer) {
      return res.status(401).json({
        success: false,
        code: "CUSTOMER_DELETED",
        message: "Customer account is no longer available. Please log in again.",
      });
    }

    // Update fields if provided
    if (name !== undefined) {
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
        });
      }
      customer.name = trimmedName;
    }

    if (email !== undefined && email !== null) {
      const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (trimmedEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          return res.status(400).json({
            success: false,
            message: "Please enter a valid email address",
          });
        }

        // Check if email is already taken by another customer
        const existingCustomer = await Customer.findOne({
          email: trimmedEmail,
          _id: { $ne: userId },
        });

        if (existingCustomer) {
          return res.status(409).json({
            success: false,
            message: "Email already in use by another customer",
          });
        }

        customer.email = trimmedEmail;
      } else if (req.body.clearEmail === true) {
        customer.email = undefined;
      }
    }
    if (dateOfBirth) customer.dateOfBirth = new Date(dateOfBirth);
    if (notificationPreferences) customer.notificationPreferences = { ...customer.notificationPreferences, ...notificationPreferences };
    if (accountPrivacy) customer.accountPrivacy = { ...customer.accountPrivacy, ...accountPrivacy };


    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        dateOfBirth: customer.dateOfBirth,
        registrationDate: customer.registrationDate,
        status: customer.status,
        refCode: customer.refCode,
        walletAmount: customer.walletAmount,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        latitude: customer.latitude,
        longitude: customer.longitude,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        notificationPreferences: customer.notificationPreferences,
        accountPrivacy: customer.accountPrivacy,
        donationStats: customer.donationStats,
      },

    });
  }
);

/**
 * Update customer location
 */
export const updateLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { latitude, longitude, address, city, state, pincode } = req.body;

    if (!userId || (req as any).user?.userType !== "Customer") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or not a customer",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const customer = await Customer.findById(userId);

    if (!customer) {
      return res.status(401).json({
        success: false,
        code: "CUSTOMER_DELETED",
        message: "Customer account is no longer available. Please log in again.",
      });
    }

    // Update location fields
    customer.latitude = latitude;
    customer.longitude = longitude;
    customer.address = address;
    customer.city = city;
    customer.state = state;
    customer.pincode = pincode;
    customer.locationUpdatedAt = new Date();

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        latitude: customer.latitude,
        longitude: customer.longitude,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        locationUpdatedAt: customer.locationUpdatedAt,
      },
    });
  }
);

/**
 * Get customer location
 */
export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  const customer = await Customer.findById(userId).select(
    "latitude longitude address city state pincode locationUpdatedAt"
  );

  if (!customer) {
    return res.status(401).json({
      success: false,
      code: "CUSTOMER_DELETED",
      message: "Customer account is no longer available. Please log in again.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Location retrieved successfully",
    data: {
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      locationUpdatedAt: customer.locationUpdatedAt,
    },
  });
});
