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
    data?: Record<string, string>;
  },
) => {
  const link = options?.link || DEFAULT_NOTIFICATION_LINKS[recipientType];
  const orderIdMatch = link.match(/\/orders\/([^/?#]+)/);
  const derivedOrderId = orderIdMatch ? orderIdMatch[1] : undefined;
  const roleLower = recipientType.toLowerCase();

  return {
    title,
    body: message,
    data: {
      type: options?.type || "Info",
      link,
      recipientType,
      role: roleLower,
      panel: roleLower,
      priority: options?.priority || "Medium",
      ...(derivedOrderId ? { orderId: derivedOrderId } : {}),
      ...(options?.data || {}),
    },
  };
};

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
    data?: Record<string, string>;
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
    data?: Record<string, string>;
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
  io?: any,
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    Accepted: {
      title: "Order Accepted",
      message: "Your order has been accepted by the seller.",
    },
    Processed: {
      title: "Order Processed",
      message:
        "Your order has been processed and is being prepared for shipment.",
    },
    Shipped: {
      title: "Order Shipped",
      message: "Your order has been shipped and is on its way!",
    },
    "Picked up": {
      title: "Order Picked Up",
      message: "Your order has been picked up by our delivery partner.",
    },
    "On the way": {
      title: "Out for Delivery",
      message: "Your order is out for delivery and will reach you soon.",
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

  if (io) {
    io.to(`order-${orderId}`).emit("order-status-update", {
      orderId,
      status,
      title: statusInfo.title,
      message: statusInfo.message,
      timestamp: new Date(),
    });
    io.to(`customer-${customerId}`).emit("customer-notification", {
      orderId,
      status,
      title: statusInfo.title,
      message: statusInfo.message,
      timestamp: new Date(),
    });
  }

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

/**
 * Send seller account approval / status notification
 */
export const sendSellerApprovalNotification = async (
  sellerId: string,
  status: "Approved" | "Pending" | "Rejected",
) => {
  const title =
    status === "Approved"
      ? "🎉 Store Application Approved!"
      : status === "Rejected"
      ? "Application Update"
      : "Seller Account Under Review";

  const message =
    status === "Approved"
      ? "Congratulations! Your seller account has been approved by admin. You can now access your seller dashboard and manage your products."
      : status === "Rejected"
      ? "Your seller application could not be approved at this time. Please contact support for more details."
      : "Your seller application has been placed under review.";

  return sendNotification("Seller", sellerId, title, message, {
    type: status === "Approved" ? "Success" : status === "Rejected" ? "Error" : "Info",
    link: status === "Approved" ? "/seller" : "/seller/under-review",
    priority: "High",
  });
};

/**
 * Send delivery partner account approval / status notification
 */
export const sendDeliveryApprovalNotification = async (
  deliveryId: string,
  status: "Active" | "Inactive",
) => {
  const title =
    status === "Active"
      ? "🎉 Delivery Partner Account Activated!"
      : "Delivery Account Update";

  const message =
    status === "Active"
      ? "Congratulations! Your delivery partner account has been approved and activated. You can now go online and receive delivery orders."
      : "Your delivery partner account has been set to Inactive.";

  return sendNotification("Delivery", deliveryId, title, message, {
    type: status === "Active" ? "Success" : "Warning",
    link: status === "Active" ? "/delivery" : "/delivery/under-review",
    priority: "High",
  });
};

/**
 * Send return request notification to seller
 */
export const sendReturnRequestNotificationToSeller = async (
  sellerId: string,
  orderNumber: string,
  productName: string,
  returnId: string,
  io?: any
) => {
  const title = "New Return Request";
  const message = `Customer has requested a return for ${productName} (Order #${orderNumber}).`;

  if (io) {
    io.to(`seller-${sellerId}`).emit("seller-notification", {
      type: "ORDER",
      title,
      message,
      link: "/seller/return",
      timestamp: new Date(),
    });
  }

  return sendNotification("Seller", sellerId, title, message, {
    type: "Order",
    link: "/seller/return",
    priority: "High",
  });
};

/**
 * Send return status notification to customer
 */
export const sendReturnStatusNotificationToCustomer = async (
  customerId: string,
  orderNumber: string,
  productName: string,
  status: string,
  rejectionReason?: string,
  orderId?: string,
  io?: any
) => {
  let title = "Return Status Update";
  let message = `Your return request for ${productName} (Order #${orderNumber}) status is now ${status}.`;
  let type: "Success" | "Error" | "Info" = "Info";

  if (status === "Approved" || status === "Pickup Pending") {
    title = "Return Request Approved";
    message = `Your return request for ${productName} (Order #${orderNumber}) has been approved by the seller. Pickup will be scheduled soon.`;
    type = "Success";
  } else if (status === "Rejected") {
    title = "Return Request Rejected";
    message = `Your return request for ${productName} (Order #${orderNumber}) was rejected by the seller. Reason: ${rejectionReason || "Not specified"}`;
    type = "Error";
  } else if (status === "Completed") {
    title = "Return Completed & Refund Processed";
    message = `Your return for ${productName} (Order #${orderNumber}) has been completed and refund has been credited.`;
    type = "Success";
  }

  const targetLink = orderId ? `/orders/${orderId}` : "/orders";

  if (io) {
    io.to(`customer-${customerId}`).emit("customer-notification", {
      title,
      message,
      status,
      link: targetLink,
      timestamp: new Date(),
    });
  }

  return sendNotification("Customer", customerId, title, message, {
    type,
    link: targetLink,
    priority: status === "Rejected" || status === "Completed" ? "High" : "Medium",
  });
};

