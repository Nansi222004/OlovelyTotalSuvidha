import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";
import Seller from "../../../models/Seller";
import {
  getCommerceChannels,
  validateChannelsState,
  invalidateCommerceChannelCache,
} from "../../../services/commerceChannelService";
import { cache } from "../../../utils/cache";
import { GSTIN_PATTERN, normalizeStateCode, validateStateIdentity } from "../../../utils/indianStates";

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

    const billingKeys = [
      "businessName", "companyAddress", "companyCity", "companyState",
      "companyPincode", "gstin", "stateCode", "gstEnabled", "gstRate",
    ];
    const isBillingUpdate = billingKeys.some((key) => Object.prototype.hasOwnProperty.call(updateData, key));

    if (isBillingUpdate) {
      const current = settings?.toObject() || {};
      const effective = { ...current, ...updateData } as any;
      const businessName = String(effective.businessName || "").trim();
      const companyAddress = String(effective.companyAddress || "").trim();
      const companyState = String(effective.companyState || "").trim();
      const stateCode = normalizeStateCode(effective.stateCode);
      const gstin = String(effective.gstin || "").trim().toUpperCase();
      const stateIdentity = validateStateIdentity(companyState, stateCode);

      if (!businessName) {
        return res.status(400).json({ success: false, message: "Business name is required." });
      }
      if (!companyState || !stateCode || !stateIdentity.valid) {
        return res.status(400).json({
          success: false,
          message: "A valid business state and its matching GST state code are required.",
        });
      }
      if (effective.gstEnabled && (!companyAddress || !/^\d{6}$/.test(String(effective.companyPincode || "").trim()) || !gstin)) {
        return res.status(400).json({
          success: false,
          message: "GSTIN, registered business address, and a 6-digit pincode are required when GST billing is enabled.",
        });
      }
      if (gstin && (!GSTIN_PATTERN.test(gstin) || gstin.slice(0, 2) !== stateIdentity.code)) {
        return res.status(400).json({
          success: false,
          message: "GSTIN is invalid or its state prefix does not match the selected business state.",
        });
      }

      updateData.businessName = businessName;
      updateData.companyAddress = companyAddress;
      updateData.companyState = stateIdentity.name;
      updateData.stateCode = stateIdentity.code;
      updateData.gstin = gstin;
    }

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

    // Sync GSTIN and business name to canonical platform seller if provided
    if (updateData.gstin !== undefined) {
      await Seller.findOneAndUpdate(
        { isPlatform: true },
        {
          taxNumber: updateData.gstin.trim(),
          taxName: "GSTIN",
          ...(updateData.businessName ? { storeName: updateData.businessName.trim() } : {}),
        }
      );
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

