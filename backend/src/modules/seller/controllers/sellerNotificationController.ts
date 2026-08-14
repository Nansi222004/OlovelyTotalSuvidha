import { Request, Response } from "express";
import Notification from "../../../models/Notification";
import { asyncHandler } from "../../../utils/asyncHandler";

/** Hide historical noise; keep recent inbox items only. */
const SELLER_NOTIFICATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Seller notifications
 * - Includes per-user notifications (recipientId = sellerId)
 * - Also includes "broadcast-style" notifications where recipientId is null/undefined
 * - Excludes expired and older-than-7-days notifications
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;
  const createdAfter = new Date(Date.now() - SELLER_NOTIFICATION_MAX_AGE_MS);
  const now = new Date();

  const notifications = await Notification.find({
    recipientType: "Seller",
    createdAt: { $gte: createdAfter },
    $and: [
      {
        $or: [
          { recipientId: sellerId },
          { recipientId: null },
          { recipientId: { $exists: false } },
        ],
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gte: now } },
        ],
      },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  return res.status(200).json({
    success: true,
    data: notifications,
  });
});

/**
 * Mark notification as read (only for this seller / this recipient record)
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const sellerId = req.user?.userId;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipientType: "Seller",
      $or: [
        { recipientId: sellerId },
        { recipientId: null },
        { recipientId: { $exists: false } },
      ],
    },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found or access denied",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
  });
});

