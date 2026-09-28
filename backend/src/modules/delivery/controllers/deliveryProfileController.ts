import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Delivery from "../../../models/Delivery";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Return from "../../../models/Return";
import WithdrawRequest from "../../../models/WithdrawRequest";

/**
 * Update Delivery Profile
 * Updates personal and vehicle information
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const {
        name,
        email,
        address,
        city,
        vehicleNumber,
        vehicleType,
        bankName,
        accountNumber,
        ifscCode,
        accountName,
        upiId
    } = req.body;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
        return res.status(401).json({
            success: false,
            code: "DELIVERY_PARTNER_DELETED",
            message: "Delivery partner account is no longer available. Please log in again."
        });
    }

    // Update fields if provided
    if (name) delivery.name = name;
    if (email) delivery.email = email;
    if (address) delivery.address = address;
    if (city) delivery.city = city;
    if (vehicleNumber) delivery.vehicleNumber = vehicleNumber;
    if (vehicleType) delivery.vehicleType = vehicleType;

    // Bank details updates
    if (bankName) delivery.bankName = bankName;
    if (accountNumber) delivery.accountNumber = accountNumber;
    if (ifscCode) delivery.ifscCode = ifscCode;
    if (accountName) delivery.accountName = accountName;
    if (upiId !== undefined) delivery.upiId = upiId ? upiId.trim() : undefined;

    await delivery.save();

    return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: delivery
    });
});

/**
 * Update Availability Status
 * Toggles isOnline status
 */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: "isOnline status must be a boolean"
        });
    }

    const delivery = await Delivery.findByIdAndUpdate(
        deliveryId,
        {
            isOnline,
            available: isOnline ? "Available" : "Not Available"
        },
        { new: true }
    );

    if (!delivery) {
        return res.status(401).json({
            success: false,
            code: "DELIVERY_PARTNER_DELETED",
            message: "Delivery partner account is no longer available. Please log in again."
        });
    }

    return res.status(200).json({
        success: true,
        message: `Status updated to ${isOnline ? 'Online' : 'Offline'}`,
        data: {
            isOnline: delivery.isOnline
        }
    });
});

/**
 * Update Delivery Settings
 * Updates notification, location, sound preferences
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const { notifications, location, sound } = req.body;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
        return res.status(401).json({
            success: false,
            code: "DELIVERY_PARTNER_DELETED",
            message: "Delivery partner account is no longer available. Please log in again."
        });
    }

    // Initialize settings if not present
    if (!delivery.settings) {
        delivery.settings = {
            notifications: true,
            location: true,
            sound: true
        };
    }

    if (typeof notifications === 'boolean') delivery.settings.notifications = notifications;
    if (typeof location === 'boolean') delivery.settings.location = location;
    if (typeof sound === 'boolean') delivery.settings.sound = sound;

    await delivery.save();

    return res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: delivery.settings
    });
});

/**
 * Self-service Account Deletion for Authenticated Delivery Partner
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    const deliveryBoyId = req.user?.userId;

    if (!deliveryBoyId || (req as any).user?.userType !== "Delivery") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only delivery partners can delete their delivery account."
        });
    }

    const delivery = await Delivery.findById(deliveryBoyId);
    if (!delivery) {
        return res.status(401).json({
            success: false,
            code: "DELIVERY_PARTNER_DELETED",
            message: "Delivery partner account is no longer available. Please log in again."
        });
    }

    // 1. Check for active delivery assignments
    const activeAssignments = await DeliveryAssignment.countDocuments({
        deliveryBoy: deliveryBoyId,
        status: { $in: ["Assigned", "Picked Up", "In Transit"] }
    });

    if (activeAssignments > 0) {
        return res.status(400).json({
            success: false,
            message: "Your account cannot be deleted while you have active deliveries in progress."
        });
    }

    // 2. Check for active return pickup assignments
    const activeReturns = await Return.countDocuments({
        deliveryBoy: deliveryBoyId,
        status: { $in: ["Delivery Partner Assigned", "Picked Up", "In Transit"] }
    });

    if (activeReturns > 0) {
        return res.status(400).json({
            success: false,
            message: "Your account cannot be deleted while you have active return deliveries in progress."
        });
    }

    // 3. Check for pending balance or cash collected (financial obligations)
    if (delivery.balance > 0 || delivery.cashCollected > 0) {
        return res.status(400).json({
            success: false,
            message: `Your account cannot be deleted while you have a pending wallet balance (₹${delivery.balance || 0}) or unremitted cash collected (₹${delivery.cashCollected || 0}). Please settle your accounts first.`
        });
    }

    if (delivery.pendingAdminPayout > 0) {
        return res.status(400).json({
            success: false,
            message: `Your account cannot be deleted while you have a pending admin payout (₹${delivery.pendingAdminPayout}).`
        });
    }

    // 4. Check for pending withdrawal requests
    const pendingWithdrawal = await WithdrawRequest.countDocuments({
        userId: deliveryBoyId,
        userType: "DELIVERY_BOY",
        status: { $in: ["Pending", "Approved"] }
    });

    if (pendingWithdrawal > 0) {
        return res.status(400).json({
            success: false,
            message: "Your account cannot be deleted while you have a pending withdrawal request in progress."
        });
    }

    // 5. Delete delivery partner document
    const deleted = await Delivery.findByIdAndDelete(deliveryBoyId);
    if (!deleted) {
        return res.status(404).json({
            success: false,
            message: "Delivery partner account not found"
        });
    }

    // Historical delivery assignments, earnings ledger, and completed orders are preserved.
    return res.status(200).json({
        success: true,
        message: "Your account has been deleted successfully. You have been logged out."
    });
});
