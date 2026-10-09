import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import CustomerSupportRequest, {
  ICustomerSupportRequest,
  SupportStatus,
  SupportPriority,
  SupportCategory,
  ISupportMessage,
} from "../models/CustomerSupportRequest";
import Customer from "../models/Customer";
import Order from "../models/Order";
import Admin from "../models/Admin";

export const isValidClientRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

export interface AppendSupportMessageResult {
  ticket: ICustomerSupportRequest | null;
  persistedMessage?: ISupportMessage;
  idempotent: boolean;
  reason?: "NOT_FOUND" | "CLOSED" | "CONFLICT";
}

export const toSupportMessagePayload = (message?: ISupportMessage) => {
  if (!message) return undefined;
  return {
    _id: message._id?.toString(),
    clientMessageId: message.clientMessageId,
    senderType: message.senderType,
    senderId: message.senderId?.toString(),
    senderName: message.senderName,
    message: message.message,
    createdAt: new Date(message.createdAt).toISOString(),
    readAt: message.readAt ? new Date(message.readAt).toISOString() : undefined,
  };
};

const supportCustomerId = (ticket: ICustomerSupportRequest): string | undefined => {
  const customer = ticket.customer as any;
  return customer?._id?.toString() || customer?.toString();
};

/**
 * Atomically append one support message. The client-generated ID is persisted
 * with the message and included in the update predicate, so a retry (including
 * concurrent retries) can never append the same logical message twice.
 */
export async function appendSupportMessageAtomic(params: {
  ticketFilter: Record<string, unknown>;
  clientMessageId: string;
  senderType: "CUSTOMER" | "ADMIN";
  senderId?: string;
  senderName: string;
  message: string;
  statusWhenCurrent?: { current: SupportStatus; next: SupportStatus };
  customerUnread: boolean;
  adminUnread: boolean;
}): Promise<AppendSupportMessageResult> {
  const messageId = new mongoose.Types.ObjectId();
  const createdAt = new Date();
  const persistedMessage: ISupportMessage = {
    _id: messageId,
    clientMessageId: params.clientMessageId,
    senderType: params.senderType,
    senderId: params.senderId ? new mongoose.Types.ObjectId(params.senderId) : undefined,
    senderName: params.senderName,
    message: params.message,
    createdAt,
  };

  const setFields: Record<string, unknown> = {
    customerUnread: params.customerUnread,
    adminUnread: params.adminUnread,
    lastMessageAt: createdAt,
  };
  if (params.statusWhenCurrent) {
    setFields.status = params.statusWhenCurrent.next;
  }

  const updateFilter: Record<string, unknown> = {
    ...params.ticketFilter,
    status: { $ne: "Closed" },
    "messages.clientMessageId": { $ne: params.clientMessageId },
  };
  if (params.statusWhenCurrent) {
    updateFilter.status = params.statusWhenCurrent.current;
  }

  const updated = await CustomerSupportRequest.findOneAndUpdate(
    updateFilter,
    {
      $push: { messages: persistedMessage },
      $set: setFields,
    },
    { new: true, runValidators: true }
  );

  if (updated) {
    const savedMessage = updated.messages.find(
      (item) => item.clientMessageId === params.clientMessageId
    );
    return { ticket: updated, persistedMessage: savedMessage, idempotent: false };
  }

  const existing = await CustomerSupportRequest.findOne(params.ticketFilter);
  if (!existing) {
    return { ticket: null, idempotent: false, reason: "NOT_FOUND" };
  }

  const duplicate = existing.messages.find(
    (item) => item.clientMessageId === params.clientMessageId
  );
  if (duplicate) {
    return { ticket: existing, persistedMessage: duplicate, idempotent: true };
  }

  if (existing.status === "Closed") {
    return { ticket: existing, idempotent: false, reason: "CLOSED" };
  }

  // The status may have changed between the initial read and atomic update.
  // Retry once without a status transition, preserving the newer status.
  if (params.statusWhenCurrent) {
    return appendSupportMessageAtomic({ ...params, statusWhenCurrent: undefined });
  }

  return { ticket: existing, idempotent: false, reason: "CONFLICT" };
}

/**
 * Generate human-readable, unique, immutable ticket number: SUP-YYYYMMDD-XXXXXX
 */
export async function generateTicketNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `SUP-${dateStr}-`;

  const latestToday = await CustomerSupportRequest.findOne({
    ticketNumber: { $regex: `^${prefix}` },
  })
    .sort({ ticketNumber: -1 })
    .select("ticketNumber")
    .lean();

  let nextSequence = 1;
  if (latestToday?.ticketNumber) {
    const parts = latestToday.ticketNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  let candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
  let exists = await CustomerSupportRequest.exists({ ticketNumber: candidate });
  while (exists) {
    nextSequence++;
    candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
    exists = await CustomerSupportRequest.exists({ ticketNumber: candidate });
  }

  return candidate;
}

/**
 * Valid state transitions for Support Tickets.
 * Closed is terminal. Resolved can transition back to In Progress if customer re-opens.
 */
export const ALLOWED_SUPPORT_STATUS_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  Pending: ["In Progress", "Resolved", "Closed"],
  "In Progress": ["Resolved", "Closed"],
  Resolved: ["In Progress", "Closed"],
  Closed: [],
};

export interface SupportStatusValidationResult {
  valid: boolean;
  code?: "INVALID_STATUS_TRANSITION" | "UNKNOWN_STATUS";
  message?: string;
}

export function validateSupportStatusTransition(
  currentStatus: SupportStatus,
  targetStatus: SupportStatus,
  actorRole: "Customer" | "Admin"
): SupportStatusValidationResult {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  if (actorRole === "Customer") {
    // Customer can close any active ticket
    if (targetStatus === "Closed" && currentStatus !== "Closed") {
      return { valid: true };
    }
    // Customer can reopen a resolved ticket by replying
    if (currentStatus === "Resolved" && targetStatus === "In Progress") {
      return { valid: true };
    }
    return {
      valid: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Customers are not authorized to transition ticket from ${currentStatus} to ${targetStatus}`,
    };
  }

  // Admin state machine enforcement
  const allowed = ALLOWED_SUPPORT_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Ticket cannot transition from ${currentStatus} to ${targetStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Notify all admins about a new support ticket or customer reply
 */
export async function notifyAdminsOfSupportEvent(
  ticket: ICustomerSupportRequest,
  eventType: "CREATED" | "REPLIED",
  messageSnippet?: string,
  io?: SocketIOServer
): Promise<void> {
  try {
    if (io) {
      const persistedMessage =
        eventType === "REPLIED" ? ticket.messages[ticket.messages.length - 1] : undefined;
      io.to("admin").emit("admin-support-event", {
        eventType,
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        subject: ticket.subject,
        messageId: persistedMessage?._id?.toString(),
        message: toSupportMessagePayload(persistedMessage),
      });
    }

    if (process.env.NODE_ENV !== "test") {
      const { sendNotification } = await import("./notificationService");
      const admins = await Admin.find({
        $or: [{ status: "Active" }, { status: { $exists: false } }, { isActive: true }],
      }).select("_id");

      for (const admin of admins) {
        const adminId = admin._id.toString();
        const eventId =
          eventType === "CREATED"
            ? `support:${ticket._id}:created:${adminId}`
            : `support:${ticket._id}:msg:${ticket.messages[ticket.messages.length - 1]?._id || Date.now()}:admin:${adminId}`;

        const title =
          eventType === "CREATED"
            ? `New Support Ticket #${ticket.ticketNumber || ticket._id.toString().slice(-6)}`
            : `New Reply on Ticket #${ticket.ticketNumber || ticket._id.toString().slice(-6)}`;

        const body =
          eventType === "CREATED"
            ? `${ticket.name} (${ticket.category}): "${ticket.subject}"`
            : `${ticket.name}: "${(messageSnippet || ticket.message).slice(0, 100)}"`;

        sendNotification(
          "Admin",
          adminId,
          title,
          body,
          {
            type: "System",
            link: `/admin/support/tickets/${ticket._id}`,
            priority: ticket.priority === "Urgent" ? "Urgent" : ticket.priority === "High" ? "High" : "Medium",
            data: {
              ticketId: ticket._id.toString(),
              ticketNumber: ticket.ticketNumber || "",
              category: ticket.category || "",
            },
            eventId,
          }
        ).catch((e) => console.error(`Error notifying admin ${adminId} of support event:`, e));
      }
    }

  } catch (err) {
    console.error("Error notifying admins of support event:", err);
  }
}

/**
 * Notify customer of admin reply or ticket status resolution
 */
export async function notifyCustomerOfSupportEvent(
  ticket: ICustomerSupportRequest,
  eventType: "REPLIED" | "STATUS_CHANGED",
  detail?: string,
  io?: SocketIOServer
): Promise<void> {
  if (!ticket.customer) return;

  try {
    const customerId = supportCustomerId(ticket);
    if (!customerId) return;

    let eventId = "";
    let title = "";
    let message = "";

    if (eventType === "REPLIED") {
      const lastMsg = ticket.messages[ticket.messages.length - 1];
      eventId = `support:${ticket._id}:msg:${lastMsg?._id || Date.now()}:customer:${customerId}`;
      title = `Support Reply on #${ticket.ticketNumber || ticket._id.toString().slice(-6)}`;
      message = `Our support team replied: "${(detail || lastMsg?.message || "").slice(0, 90)}"`;
    } else {
      eventId = `support:${ticket._id}:status:${ticket.status}:${customerId}`;
      title = `Ticket #${ticket.ticketNumber || ticket._id.toString().slice(-6)} ${ticket.status}`;
      message = `Your support ticket has been marked as ${ticket.status}.`;
    }

    if (io) {
      const persistedMessage =
        eventType === "REPLIED" ? ticket.messages[ticket.messages.length - 1] : undefined;
      io.to(`customer-${customerId}`).emit("customer-support-event", {
        eventType,
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        messageId: persistedMessage?._id?.toString(),
        message: toSupportMessagePayload(persistedMessage),
      });
    }

    if (process.env.NODE_ENV !== "test") {
      const { sendNotification } = await import("./notificationService");
      sendNotification(
        "Customer",
        customerId,
        title,
        message,
        {
          type: "System",
          link: `/support/tickets/${ticket.ticketNumber || ticket._id}`,
          priority: "Medium",
          data: {
            ticketId: ticket._id.toString(),
            ticketNumber: ticket.ticketNumber || "",
            status: ticket.status,
          },
          eventId,
        }
      ).catch((e) => console.error("Error notifying customer of support event:", e));
    }

  } catch (err) {
    console.error("Error notifying customer of support event:", err);
  }
}
