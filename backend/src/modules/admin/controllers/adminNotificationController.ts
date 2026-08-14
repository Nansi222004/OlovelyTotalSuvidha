import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
import {
  sendBroadcastNotification,
  sendNotification as createAndSendNotification,
} from "../../../services/notificationService";
import crypto from "crypto";

/**
 * Create a new notification
 */
export const createNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      recipientType,
      recipientId,
      title,
      message,
      type,
      link,
      actionLabel,
      priority,
      expiresAt,
    } = req.body;

    if (!recipientType || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient type, title, and message are required",
      });
    }

    const notificationType = type || "Info";
    const notificationPriority = priority || "Medium";
    const notificationExpiresAt = expiresAt ? new Date(expiresAt) : undefined;

    const shouldBroadcastToAll =
      recipientId === undefined ||
      recipientId === null ||
      (typeof recipientId === "string" && recipientId.trim() === "");

    // If recipientId is not provided, treat it as broadcast to all users of that type.
    // This matches the Admin "Send Notification" form behavior.
    let notification: any = null;
    if (shouldBroadcastToAll) {
      const createdNotifications: any[] = [];
      const broadcastBatchId = crypto.randomUUID();

      if (recipientType === "All") {
        createdNotifications.push(
          ...(await sendBroadcastNotification("Admin", title, message, {
            type: notificationType,
            link,
            actionLabel,
            priority: notificationPriority,
            expiresAt: notificationExpiresAt,
            broadcastBatchId,
            broadcastRecipientType: recipientType,
            createdBy: req.user?.userId,
          }))
        );
        createdNotifications.push(
          ...(await sendBroadcastNotification("Seller", title, message, {
            type: notificationType,
            link,
            actionLabel,
            priority: notificationPriority,
            expiresAt: notificationExpiresAt,
            broadcastBatchId,
            broadcastRecipientType: recipientType,
            createdBy: req.user?.userId,
          }))
        );
        createdNotifications.push(
          ...(await sendBroadcastNotification("Customer", title, message, {
            type: notificationType,
            link,
            actionLabel,
            priority: notificationPriority,
            expiresAt: notificationExpiresAt,
            broadcastBatchId,
            broadcastRecipientType: recipientType,
            createdBy: req.user?.userId,
          }))
        );
        createdNotifications.push(
          ...(await sendBroadcastNotification("Delivery", title, message, {
            type: notificationType,
            link,
            actionLabel,
            priority: notificationPriority,
            expiresAt: notificationExpiresAt,
            broadcastBatchId,
            broadcastRecipientType: recipientType,
            createdBy: req.user?.userId,
          }))
        );
      } else {
        // recipientType is one of Admin/Seller/Customer/Delivery
        createdNotifications.push(
          ...(await sendBroadcastNotification(recipientType, title, message, {
            type: notificationType,
            link,
            actionLabel,
            priority: notificationPriority,
            expiresAt: notificationExpiresAt,
            broadcastBatchId,
            broadcastRecipientType: recipientType,
            createdBy: req.user?.userId,
          }))
        );
      }

      // Return the first notification record for response compatibility.
      notification = createdNotifications[0] || null;
    } else {
      notification = await createAndSendNotification(
        recipientType,
        recipientId,
        title,
        message,
        {
          type: notificationType,
          link,
          actionLabel,
          priority: notificationPriority,
          expiresAt: notificationExpiresAt,
        },
      );

      if (req.user?.userId && !notification.createdBy) {
        notification.createdBy = req.user.userId;
        await notification.save();
      }
    }

    // Fallback (in case there were no users to broadcast to).
    if (!notification) {
      return res.status(201).json({
        success: true,
        message: "Notification created successfully (no recipients found)",
        data: null,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  }
);

/**
 * Get all notifications
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      recipientType,
      recipientId,
      isRead,
      type,
      priority,
    } = req.query;

    const query: any = {};

    if (recipientType) query.recipientType = recipientType;
    if (recipientId) query.recipientId = recipientId;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // Filter expired notifications
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } },
    ];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitNum = parseInt(limit as string);

    // Collapse broadcast entries (same broadcastBatchId) into a single row for admin list.
    // Non-broadcast rows remain one-to-one.
    const [notificationsRaw, totalAgg] = await Promise.all([
      Notification.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        {
          $addFields: {
            __groupKey: {
              $ifNull: ["$broadcastBatchId", { $toString: "$_id" }],
            },
          },
        },
        {
          $group: {
            _id: "$__groupKey",
            doc: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ]),
      Notification.aggregate([
        { $match: query },
        {
          $addFields: {
            __groupKey: {
              $ifNull: ["$broadcastBatchId", { $toString: "$_id" }],
            },
          },
        },
        {
          $group: {
            _id: "$__groupKey",
          },
        },
        { $count: "total" },
      ]),
    ]);

    const notifications = await Notification.populate(notificationsRaw, {
      path: "createdBy",
      select: "firstName lastName",
    });

    for (const n of notifications as any[]) {
      if (n.broadcastRecipientType) {
        n.recipientType = n.broadcastRecipientType;
      }
    }

    const total = totalAgg?.[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      pagination: {
        page: parseInt(page as string),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get notification by ID
 */
export const getNotificationById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data: notification,
    });
  }
);

/**
 * Mark notification as read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndUpdate(
    id,
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * Update notification
 */
export const updateNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await Notification.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    });
  }
);

/**
 * Send notification (Push to users)
 * This is a placeholder for actual push notification logic (Firebase/Socket.io)
 * For now, just mark it as sent.
 */
export const sendNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Logic to send push notification would go here
    // e.g. await pushNotificationService.send(notification);

    notification.sentAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: notification,
    });
  }
);

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modified: result.modifiedCount,
      },
    });
  }
);

/**
 * Delete notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  }
);
