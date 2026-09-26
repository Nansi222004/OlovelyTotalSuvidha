import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";
import {
  getCommerceChannels,
  validateChannelsState,
  invalidateCommerceChannelCache,
} from "../../../services/commerceChannelService";
import { cache } from "../../../utils/cache";

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
        commerceChannels: {
          quickCommerceEnabled: true,
          ecommerceEnabled: true,
        },
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

    let settings = await AppSettings.findOne();

    // ── COMMERCE CHANNELS INVARIANT VALIDATION ──────────────────────────────
    // Check if commerceChannels update is present in payload (nested or flat)
    const incomingChannels = updateData.commerceChannels || {
      quickCommerceEnabled: updateData.quickCommerceEnabled,
      ecommerceEnabled: updateData.ecommerceEnabled,
    };

    if (
      incomingChannels.quickCommerceEnabled !== undefined ||
      incomingChannels.ecommerceEnabled !== undefined
    ) {
      const currentChannels = {
        quickCommerceEnabled: settings?.commerceChannels?.quickCommerceEnabled !== false,
        ecommerceEnabled: settings?.commerceChannels?.ecommerceEnabled !== false,
      };

      const channelValidation = validateChannelsState(incomingChannels, currentChannels);
      if (!channelValidation.valid) {
        return res.status(400).json({
          success: false,
          message: channelValidation.error || "At least one commerce channel must remain enabled.",
        });
      }

      updateData.commerceChannels = channelValidation.finalState;
      delete updateData.quickCommerceEnabled;
      delete updateData.ecommerceEnabled;
    }

    if (!settings) {
      settings = await AppSettings.create(updateData);
    } else {
      settings = await AppSettings.findOneAndUpdate({ _id: settings._id }, updateData, {
        new: true,
        runValidators: true,
      });
    }

    // Invalidate centralized channel cache and category cache immediately
    invalidateCommerceChannelCache();
    cache.clear();

    return res.status(200).json({
      success: true,
      message: "App settings updated successfully",
      data: settings,
    });
  }
);

