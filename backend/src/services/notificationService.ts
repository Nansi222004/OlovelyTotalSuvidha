import Notification from "../models/Notification";
import Admin from "../models/Admin";
import Seller from "../models/Seller";
import Customer from "../models/Customer";
import Delivery from "../models/Delivery";
import { sendNotificationToUser } from "./firebaseAdmin";

type RecipientType = "Admin" | "Seller" | "Customer" | "Delivery";

const DEFAULT_NOTIFICATION_LINKS: Record<RecipientType, string> = {
  Admin: "/admin/notification",
  Seller: "/seller/notifications",
  Customer: "/notifications",
  Delivery: "/delivery/notifications",
};

const buildPushPayload = (
  recipientType: RecipientType,
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
  },
) => ({
  title,
  body: message,
  data: {
    type: options?.type || "Info",
    link: options?.link || DEFAULT_NOTIFICATION_LINKS[recipientType],
    recipientType,
    priority: options?.priority || "Medium",
  },
});

const markNotificationsAsSent = async (notificationIds: string[]) => {
  if (notificationIds.length === 0) {
    return;
  }

  await Notification.updateMany(
    { _id: { $in: notificationIds } },
    { sentAt: new Date() },
  );
};

const pushNotificationToRecipients = async (
  recipientType: RecipientType,
  recipients: Array<{ notificationId: string; userId: string }>,
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
  },
) => {
  if (recipients.length === 0) {
    return;
  }

  const payload = buildPushPayload(recipientType, title, message, options);
  const results = await Promise.allSettled(
    recipients.map(({ userId }) =>
      sendNotificationToUser(userId, recipientType, payload),
    ),
  );

  const sentNotificationIds = recipients
    .map((recipient, index) => {
      const result = results[index];
      if (
        result?.status === "fulfilled" &&
        result.value &&
        typeof result.value.successCount === "number" &&
        result.value.successCount > 0
      ) {
        return recipient.notificationId;
      }
      return null;
    })
    .filter((notificationId): notificationId is string => Boolean(notificationId));

  await markNotificationsAsSent(sentNotificationIds);
};

/**
 * Send notification to specific user
 */
export const sendNotification = async (
  recipientType: RecipientType,
  recipientId: string,
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
  },
) => {
  const notification = await Notification.create({
    recipientType,
    recipientId,
    title,
    message,
    type: options?.type || "Info",
    link: options?.link,
    actionLabel: options?.actionLabel,
    priority: options?.priority || "Medium",
    expiresAt: options?.expiresAt,
    isRead: false,
  });

  await pushNotificationToRecipients(
    recipientType,
    [{ notificationId: notification._id.toString(), userId: recipientId }],
    title,
    message,
    options,
  );

  return notification;
};

/**
 * Send notification to all users of a type
 */
export const sendBroadcastNotification = async (
  recipientType: RecipientType,
  title: string,
  message: string,
  options?: {
    type?:
      | "Info"
      | "Success"
      | "Warning"
      | "Error"
      | "Order"
      | "Payment"
      | "System";
    link?: string;
    actionLabel?: string;
    priority?: "Low" | "Medium" | "High" | "Urgent";
    expiresAt?: Date;
    broadcastBatchId?: string;
    broadcastRecipientType?: "Admin" | "Seller" | "Customer" | "Delivery" | "All";
    createdBy?: string;
  },
) => {
  // Get all users of the specified type
  let userIds: string[] = [];

  switch (recipientType) {
    case "Admin":
      const admins = await Admin.find().select("_id");
      userIds = admins.map((a) => a._id.toString());
      break;
    case "Seller":
      const sellers = await Seller.find().select("_id");
      userIds = sellers.map((s) => s._id.toString());
      break;
    case "Customer":
      const customers = await Customer.find().select("_id");
      userIds = customers.map((c) => c._id.toString());
      break;
    case "Delivery":
      const deliveries = await Delivery.find().select("_id");
      userIds = deliveries.map((d) => d._id.toString());
      break;
  }

  // Create notifications for all users
  const notifications = await Promise.all(
    userIds.map((userId) =>
      Notification.create({
        recipientType,
        recipientId: userId,
        broadcastBatchId: options?.broadcastBatchId,
        broadcastRecipientType: options?.broadcastRecipientType,
        title,
        message,
        type: options?.type || "Info",
        link: options?.link,
        actionLabel: options?.actionLabel,
        priority: options?.priority || "Medium",
        expiresAt: options?.expiresAt,
        createdBy: options?.createdBy,
        isRead: false,
      }),
    ),
  );

  await pushNotificationToRecipients(
    recipientType,
    notifications.map((notification, index) => ({
      notificationId: notification._id.toString(),
      userId: userIds[index],
    })),
    title,
    message,
    options,
  );

  return notifications;
};

/**
 * Send order status notification
 */
export const sendOrderStatusNotification = async (
  orderId: string,
  customerId: string,
  status: string,
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    Processed: {
      title: "Order Processed",
      message:
        "Your order has been processed and is being prepared for shipment.",
    },
    Shipped: {
      title: "Order Shipped",
      message: "Your order has been shipped and is on its way!",
    },
    "Out for Delivery": {
      title: "Out for Delivery",
      message: "Your order is out for delivery and will reach you soon.",
    },
    Delivered: {
      title: "Order Delivered",
      message:
        "Your order has been delivered successfully. Thank you for shopping with us!",
    },
    Cancelled: {
      title: "Order Cancelled",
      message:
        "Your order has been cancelled. If you have any questions, please contact support.",
    },
  };

  const statusInfo = statusMessages[status];
  if (!statusInfo) return;

  return sendNotification(
    "Customer",
    customerId,
    statusInfo.title,
    statusInfo.message,
    {
      type: "Order",
      link: `/orders/${orderId}`,
      priority: status === "Cancelled" ? "High" : "Medium",
    },
  );
};

/**
 * Send product approval notification
 */
export const sendProductApprovalNotification = async (
  sellerId: string,
  productId: string,
  status: "Approved" | "Rejected",
  rejectionReason?: string,
) => {
  const title = status === "Approved" ? "Product Approved" : "Product Rejected";
  const message =
    status === "Approved"
      ? "Your product has been approved and is now live on the platform."
      : `Your product has been rejected. Reason: ${
          rejectionReason || "Not specified"
        }`;

  return sendNotification("Seller", sellerId, title, message, {
    type: status === "Approved" ? "Success" : "Error",
    link: `/products/${productId}`,
    priority: "Medium",
  });
};
