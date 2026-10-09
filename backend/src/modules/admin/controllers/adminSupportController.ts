import { Request, Response } from "express";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import CustomerSupportRequest, {
  SupportStatus,
  SupportPriority,
} from "../../../models/CustomerSupportRequest";
import Admin from "../../../models/Admin";
import {
  validateSupportStatusTransition,
  notifyCustomerOfSupportEvent,
  appendSupportMessageAtomic,
  isValidClientRequestId,
} from "../../../services/customerSupportService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get all support tickets with filtering, pagination and counts summary
 * GET /api/admin/support/tickets
 */
export const getAllTickets = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    category,
    priority,
    channel,
    search,
    page = 1,
    limit = 20,
    onlyUnread,
  } = req.query;

  const filter: any = {};

  if (status && status !== "ALL") {
    filter.status = status;
  }
  if (category && category !== "ALL") {
    filter.category = category;
  }
  if (priority && priority !== "ALL") {
    filter.priority = priority;
  }
  if (channel && channel !== "ALL") {
    filter.channel = channel;
  }
  if (onlyUnread === "true") {
    filter.adminUnread = true;
  }

  if (search && typeof search === "string" && search.trim().length > 0) {
    const q = search.trim();
    filter.$or = [
      { ticketNumber: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { subject: { $regex: q, $options: "i" } },
      { orderNumber: { $regex: q, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [tickets, total, pendingCount, inProgressCount, resolvedCount, closedCount, unreadCount] =
    await Promise.all([
      CustomerSupportRequest.find(filter)
        .sort({ adminUnread: -1, lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CustomerSupportRequest.countDocuments(filter),
      CustomerSupportRequest.countDocuments({ status: "Pending" }),
      CustomerSupportRequest.countDocuments({ status: "In Progress" }),
      CustomerSupportRequest.countDocuments({ status: "Resolved" }),
      CustomerSupportRequest.countDocuments({ status: "Closed" }),
      CustomerSupportRequest.countDocuments({ adminUnread: true }),
    ]);

  const countsObj = {
    total,
    all: total,
    pending: pendingCount,
    inProgress: inProgressCount,
    resolved: resolvedCount,
    closed: closedCount,
    unread: unreadCount,
  };

  const paginationObj = {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  };

  return res.status(200).json({
    success: true,
    data: {
      tickets,
      counts: countsObj,
      pagination: paginationObj,
    },
    counts: countsObj,
    pagination: paginationObj,
  });
});

/**
 * Get ticket details by ID or Ticket Number
 * GET /api/admin/support/tickets/:id
 */
export const getTicketById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter: any = { $or: [{ ticketNumber: id }] };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter)
    .populate("customer", "name email mobile status createdAt")
    .populate("order", "orderNumber status total orderType deliveryOption paymentMethod paymentStatus createdAt items");

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  // Clear admin unread flag on view
  if (ticket.adminUnread) {
    ticket.adminUnread = false;
    await ticket.save();
  }

  return res.status(200).json({
    success: true,
    data: ticket,
  });
});

/**
 * Send admin reply to customer ticket
 * POST /api/admin/support/tickets/:id/messages
 */
export const sendAdminMessage = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId;
  const { id } = req.params;
  const { message, clientMessageId } = req.body;

  if (!message || message.trim().length === 0 || message.trim().length > 5000) {
    return res.status(400).json({ success: false, message: "Message cannot be empty and must be under 5000 characters" });
  }

  if (!isValidClientRequestId(clientMessageId)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_CLIENT_MESSAGE_ID",
      message: "A valid clientMessageId is required",
    });
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter: any = { $or: [{ ticketNumber: id }] };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  let adminName = "Support Team";
  if (adminId) {
    try {
      const adminDoc = await Admin.findById(adminId).select("firstName lastName email");
      if (adminDoc) {
        const full = `${adminDoc.firstName || ""} ${adminDoc.lastName || ""}`.trim();
        if (full) adminName = full;
      }
    } catch {
      // fallback
    }
  }

  const result = await appendSupportMessageAtomic({
    ticketFilter: filter,
    clientMessageId,
    senderType: "ADMIN",
    senderId: adminId,
    senderName: adminName,
    message: message.trim(),
    customerUnread: true,
    adminUnread: false,
    statusWhenCurrent:
      ticket.status === "Pending"
        ? { current: "Pending", next: "In Progress" }
        : undefined,
  });

  if (result.reason === "CLOSED") {
    return res.status(409).json({ success: false, code: "TICKET_CLOSED", message: "This ticket is closed" });
  }
  if (!result.ticket || !result.persistedMessage) {
    return res.status(409).json({ success: false, code: "MESSAGE_WRITE_CONFLICT", message: "Reply was not saved; please retry" });
  }

  const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
  if (!result.idempotent) {
    notifyCustomerOfSupportEvent(result.ticket, "REPLIED", message, io).catch((e) =>
      console.error("Error notifying customer of admin reply:", e)
    );
  }

  return res.status(200).json({
    success: true,
    message: result.idempotent ? "Reply already sent" : "Reply sent successfully",
    data: result.ticket,
    persistedMessage: result.persistedMessage,
    idempotent: result.idempotent,
  });
});

/**
 * Update support ticket status
 * PATCH /api/admin/support/tickets/:id/status
 */
export const updateTicketStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses: SupportStatus[] = ["Pending", "In Progress", "Resolved", "Closed"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter: any = { $or: [{ ticketNumber: id }] };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  const transitionCheck = validateSupportStatusTransition(ticket.status, status, "Admin");
  if (!transitionCheck.valid) {
    return res.status(400).json({
      success: false,
      code: transitionCheck.code,
      message: transitionCheck.message,
    });
  }

  ticket.status = status;
  if (status === "Resolved") {
    ticket.resolvedAt = new Date();
  } else if (status === "Closed") {
    ticket.closedAt = new Date();
  }

  await ticket.save();

  const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
  notifyCustomerOfSupportEvent(ticket, "STATUS_CHANGED", undefined, io).catch((e) =>
    console.error("Error notifying customer of status change:", e)
  );

  return res.status(200).json({
    success: true,
    message: `Ticket status updated to ${status}`,
    data: ticket,
  });
});

/**
 * Update support ticket priority
 * PATCH /api/admin/support/tickets/:id/priority
 */
export const updateTicketPriority = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { priority } = req.body;

  const validPriorities: SupportPriority[] = ["Low", "Normal", "High", "Urgent"];
  if (!priority || !validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
    });
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter: any = { $or: [{ ticketNumber: id }] };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  ticket.priority = priority;
  await ticket.save();

  return res.status(200).json({
    success: true,
    message: `Ticket priority updated to ${priority}`,
    data: ticket,
  });
});
