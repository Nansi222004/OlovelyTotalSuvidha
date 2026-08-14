import { Request, Response } from "express";
import Notification from "../../../models/Notification";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Customer notifications
 * - Includes per-user notifications (recipientId = customerId)
 * - Also includes "broadcast-style" notifications where recipientId is null/undefined
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user?.userId;

  const notifications = await Notification.find({
    recipientType: "Customer",
    $or: [
      { recipientId: customerId },
      { recipientId: null },
      { recipientId: { $exists: false } },
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
 * Mark notification as read (only for this customer / this recipient record)
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerId = req.user?.userId;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipientType: "Customer",
      $or: [
        { recipientId: customerId },
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

