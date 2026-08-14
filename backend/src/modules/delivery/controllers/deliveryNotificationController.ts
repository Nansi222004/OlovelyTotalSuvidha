import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
// import mongoose from "mongoose";

/**
 * Get Notifications
 * Fetches notifications for the logged-in delivery partner
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const notifications = await Notification.find({
        recipientType: "Delivery",
        $or: [
            { recipientId: deliveryId },
            { recipientId: null } // Broadcasts to all delivery partners
        ]
    })
        .sort({ createdAt: -1 })
        .limit(50); // Limit to last 50 notifications

    return res.status(200).json({
        success: true,
        data: notifications
    });
});

/**
 * Mark Notification as Read
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipientType: "Delivery", recipientId: deliveryId },
        { isRead: true, readAt: new Date() },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({
            success: false,
            message: "Notification not found or access denied"
        });
    }

    return res.status(200).json({
        success: true,
        message: "Notification marked as read"
    });
});
