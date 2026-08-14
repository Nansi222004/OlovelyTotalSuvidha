import { Request, Response } from "express";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";

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

    const seller = await Seller.findByIdAndUpdate(
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

    return res.status(200).json({
      success: true,
      message: `Seller status updated to ${status}`,
      data: seller,
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

      if (!isNaN(radius) && radius >= 0.1 && radius <= 100) {
        updateData.serviceRadiusKm = radius; // Ensure it's saved as a number
      } else {
        return res.status(400).json({
          success: false,
          message: "Service radius must be between 0.1 and 100 kilometers",
        });
      }
    } else if (
      updateData.serviceRadiusKm === "" ||
      updateData.serviceRadiusKm === null
    ) {
      // If empty string or null is sent, remove it from updates to keep existing value
      delete updateData.serviceRadiusKm;
    }

    const seller = await Seller.findByIdAndUpdate(id, updateData, {
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
      message: "Seller updated successfully",
      data: seller,
    });
  }
);

/**
 * Delete seller
 */
export const deleteSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const seller = await Seller.findByIdAndDelete(id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

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

