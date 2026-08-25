import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";

/**
 * Get app settings
 */
export const getAppSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    let settings = await AppSettings.findOne();

    // Create default settings if none exist
    if (!settings) {
      settings = await AppSettings.create({
        appName: "Olovely Total Suvidha",
        appLogo: "/assets/olovelylogo_transparent.png",
        estimatedDeliveryTime: "12-15 mins",
        contactEmail: "contact@olovely.com",
        contactPhone: "9876543210",
      });
    }

    return res.status(200).json({
      success: true,
      message: "App settings fetched successfully",
      data: settings,
    });
  }
);

/**
 * Update app settings
 */
export const updateAppSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const updateData = req.body;
    updateData.updatedBy = (req as any).user?.userId;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEBUG Settings] Incoming update payload:`, JSON.stringify(updateData.deliveryConfig, null, 2));
    }

    let settings = await AppSettings.findOne();

    if (!settings) {
      settings = await AppSettings.create(updateData);
    } else {
      settings = await AppSettings.findOneAndUpdate({ _id: settings._id }, updateData, {
        new: true,
        runValidators: true,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEBUG Settings] Updated settings:`, JSON.stringify(settings?.deliveryConfig, null, 2));
    }

    return res.status(200).json({
      success: true,
      message: "App settings updated successfully",
      data: settings,
    });
  }
);
