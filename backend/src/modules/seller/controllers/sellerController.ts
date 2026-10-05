import { Request, Response } from "express";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";
import { parseSafeBoolean } from "./sellerAuthController";
import {
  isShiprocketPickupRequired,
  cleanupSellerShiprocketPickup,
  provisionShiprocketPickupLocation,
} from "../../../services/shipping/shiprocketPickupService";

/**
 * Get all sellers (Admin only)
 */
export const getAllSellers = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, search } = req.query;

    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { sellerName: { $regex: search, $options: "i" } },
        { storeName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const sellers = await Seller.find(query)
      .select("-password") // Exclude password
      .sort({ createdAt: -1 }); // Sort by newest first

    return res.status(200).json({
      success: true,
      message: "Sellers fetched successfully",
      data: sellers,
    });
  }
);

/**
 * Get seller by ID
 */
export const getSellerById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const seller = await Seller.findById(id).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller fetched successfully",
      data: seller,
    });
  }
);

/**
 * Update seller status (Approve/Reject)
 */
export const updateSellerStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Approved", "Pending", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (Approved, Pending, or Rejected)",
      });
    }

    let seller = await Seller.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    let pickupProvisioning;
    if (status === "Approved") {
      // Approval is the platform decision. Courier provisioning is recoverable and
      // must never roll the seller back if Shiprocket is temporarily unavailable.
      pickupProvisioning = await provisionShiprocketPickupLocation(id);
      seller = await Seller.findById(id).select("-password");
    }

    // Trigger push notification and in-app alert to seller asynchronously
    import("../../../services/notificationService").then(({ sendSellerApprovalNotification }) => {
      sendSellerApprovalNotification(id, status).catch((err: any) => {
        console.error(`❌ [Push Notification Error] Failed to send approval notification to seller ${id}:`, err?.message);
      });
    });

    return res.status(200).json({
      success: true,
      message: `Seller status updated to ${status}`,
      data: seller,
      ...(pickupProvisioning && { pickupProvisioning }),
    });
  }
);

/** Retry the external courier pickup provisioning step for an approved seller. */
export const retrySellerPickupProvisioning = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const seller = await Seller.findById(id).select("status vendorType");

    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }
    if (seller.status !== "Approved") {
      return res.status(409).json({
        success: false,
        message: "Approve the seller before provisioning a courier pickup location",
      });
    }
    if (!isShiprocketPickupRequired(seller.vendorType)) {
      return res.status(409).json({
        success: false,
        message: "Courier pickup provisioning does not apply to Quick Commerce vendors",
      });
    }

    const pickupProvisioning = await provisionShiprocketPickupLocation(id);
    const updatedSeller = await Seller.findById(id).select("-password");
    return res.status(pickupProvisioning.status === "ACTIVE" ? 200 : 409).json({
      success: pickupProvisioning.status === "ACTIVE",
      message: pickupProvisioning.message,
      data: updatedSeller,
      pickupProvisioning,
    });
  }
);

/**
 * Update seller details
 */
export const updateSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    // Remove password from update data if present
    delete updateData.password;

    const existingSeller = await Seller.findById(id);
    if (!existingSeller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    if (updateData.shippingConfig) {
      // Integration state is server-owned. Admin may edit authoritative address data,
      // but cannot forge an ACTIVE synchronization state or a remote identifier.
      const incomingConfig = { ...updateData.shippingConfig };
      for (const key of [
        "shiprocketPickupLocationId",
        "shiprocketPickupLocationName",
        "shiprocketPickupStatus",
        "shiprocketPickupLastError",
        "shiprocketPickupAddressFingerprint",
        "shiprocketPickupLastSyncedAt",
        "shiprocketPickupSyncStartedAt",
        "shiprocketPickupCleanupStartedAt",
        "shiprocketPickupRetiredAt",
      ]) {
        delete incomingConfig[key];
      }

      const oldConfig = existingSeller.shippingConfig || {};
      const mergedConfig: any = { ...oldConfig, ...incomingConfig };
      const addressChanged = ["pickupAddress", "pickupPincode", "pickupCity", "pickupState"]
        .some((key) => String((oldConfig as any)[key] || "").trim() !== String(mergedConfig[key] || "").trim());

      if (
        addressChanged &&
        isShiprocketPickupRequired(existingSeller.vendorType) &&
        oldConfig.shiprocketPickupLocationId &&
        !["RETIRING", "RETRY_PENDING", "RETIRED"].includes(oldConfig.shiprocketPickupStatus || "")
      ) {
        mergedConfig.shiprocketPickupStatus = "PENDING";
        mergedConfig.shiprocketPickupLastError =
          "Pickup address changed. Update the existing Shiprocket pickup location, then retry synchronization; a duplicate will not be created.";
      }
      updateData.shippingConfig = mergedConfig;
    }

    // Handle location update (convert lat/lng to GeoJSON)
    if (updateData.latitude && updateData.longitude) {
      const latitude = parseFloat(updateData.latitude);
      const longitude = parseFloat(updateData.longitude);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Update GeoJSON location for geospatial queries
        updateData.location = {
          type: "Point",
          coordinates: [longitude, latitude], // MongoDB GeoJSON: [longitude, latitude]
        };
        // Ensure string fields are also synchronized
        updateData.latitude = latitude.toString();
        updateData.longitude = longitude.toString();
      }
    }

    // Handle serviceRadiusKm update
    if (
      updateData.serviceRadiusKm !== undefined &&
      updateData.serviceRadiusKm !== null &&
      updateData.serviceRadiusKm !== ""
    ) {
      const radius =
        typeof updateData.serviceRadiusKm === "string"
          ? parseFloat(updateData.serviceRadiusKm)
          : Number(updateData.serviceRadiusKm);

      if (!isNaN(radius) && radius >= 0.1 && radius <= 300) {
        updateData.serviceRadiusKm = radius; // Ensure it's saved as a number
      } else {
        return res.status(400).json({
          success: false,
          message: "Service radius must be between 0.1 and 300 kilometers",
        });
      }
    } else if (
      updateData.serviceRadiusKm === "" ||
      updateData.serviceRadiusKm === null
    ) {
      // If empty string or null is sent, remove it from updates to keep existing value
      delete updateData.serviceRadiusKm;
    }

    // Safe boolean parsing for wholesaleEnabled
    if (updateData.wholesaleEnabled !== undefined) {
      updateData.wholesaleEnabled = parseSafeBoolean(updateData.wholesaleEnabled, false);
    }

    let seller = await Seller.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    let pickupProvisioning;
    if (updateData.status === "Approved" && existingSeller.status !== "Approved") {
      pickupProvisioning = await provisionShiprocketPickupLocation(id);
      seller = await Seller.findById(id).select("-password");
    }

    return res.status(200).json({
      success: true,
      message: "Seller updated successfully",
      data: seller,
      ...(pickupProvisioning && { pickupProvisioning }),
    });
  }
);

/**
 * Delete seller
 */
export const deleteSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const seller = await Seller.findById(id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    await cleanupSellerShiprocketPickup(seller);
    await Seller.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Seller deleted successfully",
    });
  }
);

/**
 * Update seller category commissions (Admin only)
 * Sets per-header-category commission rates for a specific seller
 */
export const updateSellerCategoryCommissions = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { categoryCommissions } = req.body;

    if (!Array.isArray(categoryCommissions)) {
      return res.status(400).json({
        success: false,
        message: "categoryCommissions must be an array",
      });
    }

    // Validate each entry
    for (const entry of categoryCommissions) {
      if (!entry.headerCategory) {
        return res.status(400).json({
          success: false,
          message: "Each entry must have a headerCategory ID",
        });
      }
      if (
        entry.commissionRate === undefined ||
        entry.commissionRate < 0 ||
        entry.commissionRate > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "commissionRate must be between 0 and 100",
        });
      }
    }

    const seller = await Seller.findByIdAndUpdate(
      id,
      { categoryCommissions },
      { new: true, runValidators: true }
    ).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category commissions updated successfully",
      data: seller,
    });
  }
);

