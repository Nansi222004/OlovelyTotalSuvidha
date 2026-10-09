import { Request, Response } from "express";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import CustomerSupportRequest, {
  ICustomerSupportRequest,
  SupportCategory,
  SupportPriority,
} from "../../../models/CustomerSupportRequest";
import Customer from "../../../models/Customer";
import Order from "../../../models/Order";
import { sendSupportEmail } from "../../../services/emailService";
import {
  generateTicketNumber,
  validateSupportStatusTransition,
  notifyAdminsOfSupportEvent,
  appendSupportMessageAtomic,
  isValidClientRequestId,
} from "../../../services/customerSupportService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Submit Guest / General Contact Form
 * POST /api/customer/support/contact
 */
export const submitCustomerSupport = async (req: Request, res: Response) => {
  try {
    let { name, email, subject, message } = req.body;

    name = (name || "").trim().replace(/[\r\n]/g, " ");
    email = (email || "").trim().toLowerCase().replace(/[\r\n]/g, "");
    subject = (subject || "").trim().replace(/[\r\n]/g, " ");
    message = (message || "").trim();

    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid name (2-100 characters).",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!subject || subject.length < 3 || subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid subject (3-200 characters).",
      });
    }

    if (!message || message.length < 10 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Please describe your issue (10-2000 characters).",
      });
    }

    let customerId: string | undefined = undefined;
    if ((req as any).user?.userId) {
      customerId = (req as any).user.userId;
      try {
        const custDoc = await Customer.findById(customerId).select("name email");
        if (custDoc) {
          if (!name) name = custDoc.name;
          if (!email) email = custDoc.email;
        }
      } catch (err) {
        console.warn("[SUPPORT CONTROLLER] Unable to fetch customer profile:", err);
      }
    }

    const supportRequest = new CustomerSupportRequest({
      customer: customerId,
      name,
      email,
      subject,
      message,
      status: "Pending",
      category: "General",
      priority: "Normal",
      isLegacyContact: true,
      emailSent: false,
      lastMessageAt: new Date(),
    });
    await supportRequest.save();

    console.log(`[SUPPORT CONTROLLER] Sending support email for Request ID: ${supportRequest._id}`);
    const emailResult =
      process.env.NODE_ENV === "test"
        ? { success: false, error: "Email delivery skipped in test environment" }
        : await sendSupportEmail({
            name,
            email,
            subject,
            message,
            customerId,
            submittedAt: supportRequest.createdAt,
          });

    if (emailResult.success) {
      supportRequest.emailSent = true;
      supportRequest.emailMessageId = emailResult.messageId;
      await supportRequest.save();
    } else {
      console.warn(`[SUPPORT CONTROLLER] Support email notice failed for Request ID ${supportRequest._id}: ${emailResult.error}`);
    }

    const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
    notifyAdminsOfSupportEvent(supportRequest, "CREATED", message, io).catch((e) =>
      console.error("Error notifying admins of contact request:", e)
    );

    return res.status(200).json({
      success: true,
      message: "Your support request has been sent successfully. Our support team will get back to you.",
      data: {
        requestId: supportRequest._id,
      },
    });
  } catch (error: any) {
    console.error("[SUPPORT CONTROLLER EXCEPTION]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred while submitting your support request.",
    });
  }
};

/**
 * Create Authenticated Support Ticket
 * POST /api/customer/support/tickets
 */
export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).user?.userId;
  if (!customerId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const customer = await Customer.findById(customerId).select("name email mobile");
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer account not found" });
  }

  const {
    subject,
    message,
    category = "General",
    priority = "Normal",
    orderId,
    fulfillmentGroupId,
    clientRequestId,
  } = req.body;

  if (!isValidClientRequestId(clientRequestId)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_CLIENT_REQUEST_ID",
      message: "A valid clientRequestId is required",
    });
  }

  if (!subject || subject.trim().length < 3 || subject.trim().length > 200) {
    return res.status(400).json({ success: false, message: "Subject must be between 3 and 200 characters" });
  }

  if (!message || message.trim().length < 5 || message.trim().length > 5000) {
    return res.status(400).json({ success: false, message: "Message must be between 5 and 5000 characters" });
  }

  const validCategories: string[] = [
    "General",
    "Order",
    "Order Issue",
    "Delivery",
    "Payment",
    "Product",
    "Return",
    "Exchange",
    "Account",
    "Other",
  ];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    });
  }
  const normalizedCategory: SupportCategory = category === "Order Issue" ? "Order" : (category as SupportCategory);

  const existingTicket = await CustomerSupportRequest.findOne({
    customer: customerId,
    clientRequestId,
  });
  if (existingTicket) {
    const sameRequest =
      existingTicket.subject === subject.trim() &&
      existingTicket.message === message.trim();
    if (!sameRequest) {
      return res.status(409).json({
        success: false,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This request ID was already used for a different support ticket",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Support ticket already created",
      data: existingTicket,
      idempotent: true,
    });
  }

  let linkedOrder: any = null;
  let orderNumber: string | undefined = undefined;
  let channel: "QUICK_COMMERCE" | "ECOMMERCE" | "MIXED" | undefined = undefined;
  let fulfillmentContext: any = undefined;

  if (orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID format" });
    }

    linkedOrder = await Order.findById(orderId);
    if (!linkedOrder) {
      return res.status(404).json({ success: false, message: "Linked order not found" });
    }

    // Strict Authorization: Order must belong to this customer
    const orderCustomerId = (linkedOrder.customer as any)?._id?.toString() || linkedOrder.customer?.toString();
    if (orderCustomerId !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to open a support ticket for this order",
      });
    }

    orderNumber = linkedOrder.orderNumber;
    channel = linkedOrder.channel || linkedOrder.orderType;
    if (!channel && Array.isArray(linkedOrder.fulfillmentGroups)) {
      const hasQC = linkedOrder.fulfillmentGroups.some((g: any) => g.fulfillmentType === "LOCAL_DELIVERY" || g.channel === "QUICK_COMMERCE");
      const hasEcom = linkedOrder.fulfillmentGroups.some((g: any) => g.fulfillmentType === "SHIPROCKET" || g.channel === "ECOMMERCE");
      if (hasQC && hasEcom) channel = "MIXED";
      else if (hasQC) channel = "QUICK_COMMERCE";
      else if (hasEcom) channel = "ECOMMERCE";
    }
    if (!channel) channel = "ECOMMERCE";

    let itemsSummary = "";
    const itemsCount = Array.isArray(linkedOrder.items) ? linkedOrder.items.length : 0;
    if (itemsCount > 0) {
      itemsSummary = `${itemsCount} item(s) (Order Total: ₹${linkedOrder.totalAmount || linkedOrder.total || 0})`;
    }

    fulfillmentContext = {
      orderStatus: linkedOrder.status,
      channel,
      fulfillmentType: linkedOrder.fulfillmentType || (channel === "QUICK_COMMERCE" ? "Platform" : "Shiprocket"),
      ownerType: linkedOrder.ownerType || "Platform",
      itemsCount,
      totalAmount: linkedOrder.totalAmount || linkedOrder.total,
      paymentMethod: linkedOrder.paymentMethod,
      deliveryPartner: linkedOrder.deliveryBoy?.name || linkedOrder.deliveryBoyName,
      itemsSummary,
    };
  }

  const ticketNumber = await generateTicketNumber();

  const ticket = new CustomerSupportRequest({
    clientRequestId,
    ticketNumber,
    customer: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.mobile,
    subject: subject.trim(),
    message: message.trim(),
    category: normalizedCategory,
    priority: ["Low", "Normal", "High", "Urgent"].includes(priority) ? priority : "Normal",
    order: linkedOrder ? linkedOrder._id : undefined,
    orderNumber,
    fulfillmentGroupId,
    channel,
    fulfillmentContext,
    messages: [
      {
        clientMessageId: clientRequestId,
        senderType: "CUSTOMER",
        senderId: customer._id,
        senderName: customer.name,
        message: message.trim(),
        createdAt: new Date(),
      },
    ],
    customerUnread: false,
    adminUnread: true,
    lastMessageAt: new Date(),
    isLegacyContact: false,
    status: "Pending",
  });

  try {
    await ticket.save();
  } catch (error: any) {
    if (error?.code === 11000) {
      const retriedTicket = await CustomerSupportRequest.findOne({
        customer: customerId,
        clientRequestId,
      });
      if (retriedTicket) {
        return res.status(200).json({
          success: true,
          message: "Support ticket already created",
          data: retriedTicket,
          idempotent: true,
        });
      }
    }
    throw error;
  }

  const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
  notifyAdminsOfSupportEvent(ticket, "CREATED", message, io).catch((e) =>
    console.error("Error notifying admins of new ticket:", e)
  );

  return res.status(201).json({
    success: true,
    message: "Support ticket created successfully",
    data: ticket,
  });
});

/**
 * Get Customer's Own Tickets
 * GET /api/customer/support/tickets
 */
export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).user?.userId;
  const { status, category, page = 1, limit = 15 } = req.query;

  const query: any = { customer: customerId };

  if (status && status !== "ALL") {
    query.status = status;
  }
  if (category && category !== "ALL") {
    query.category = category;
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const total = await CustomerSupportRequest.countDocuments(query);
  const tickets = await CustomerSupportRequest.find(query)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

/**
 * Get Ticket Detail by ID or Ticket Number
 * GET /api/customer/support/tickets/:idOrNumber
 */
export const getTicketDetail = asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).user?.userId;
  const { idOrNumber } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(idOrNumber);
  const filter: any = {
    customer: customerId,
    $or: [{ ticketNumber: idOrNumber }],
  };
  if (isObjectId) {
    filter.$or.push({ _id: idOrNumber });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  // Clear customer unread badge
  if (ticket.customerUnread) {
    ticket.customerUnread = false;
    await ticket.save();
  }

  return res.status(200).json({
    success: true,
    data: ticket,
  });
});

/**
 * Append Customer Message to Ticket
 * POST /api/customer/support/tickets/:id/messages
 */
export const sendCustomerMessage = asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).user?.userId;
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
  const filter: any = {
    customer: customerId,
    $or: [{ ticketNumber: id }],
  };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found or unauthorized" });
  }

  if (ticket.status === "Closed") {
    return res.status(400).json({
      success: false,
      code: "TICKET_CLOSED",
      message: "This ticket is closed. Please create a new support ticket if you require further assistance.",
    });
  }

  const customer = await Customer.findById(customerId).select("name");
  const senderName = customer?.name || ticket.name || "Customer";

  const result = await appendSupportMessageAtomic({
    ticketFilter: filter,
    clientMessageId,
    senderType: "CUSTOMER",
    senderId: customerId,
    senderName,
    message: message.trim(),
    customerUnread: false,
    adminUnread: true,
    statusWhenCurrent:
      ticket.status === "Resolved"
        ? { current: "Resolved", next: "In Progress" }
        : undefined,
  });

  if (result.reason === "CLOSED") {
    return res.status(409).json({ success: false, code: "TICKET_CLOSED", message: "This ticket is closed" });
  }
  if (!result.ticket || !result.persistedMessage) {
    return res.status(409).json({ success: false, code: "MESSAGE_WRITE_CONFLICT", message: "Message was not saved; please retry" });
  }

  const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
  if (!result.idempotent) {
    notifyAdminsOfSupportEvent(result.ticket, "REPLIED", message, io).catch((e) =>
      console.error("Error notifying admins of customer reply:", e)
    );
  }

  return res.status(200).json({
    success: true,
    message: result.idempotent ? "Message already received" : "Message sent successfully",
    data: result.ticket,
    persistedMessage: result.persistedMessage,
    idempotent: result.idempotent,
  });
});

/**
 * Customer Closes Ticket
 * POST /api/customer/support/tickets/:id/close
 */
export const closeCustomerTicket = asyncHandler(async (req: Request, res: Response) => {
  const customerId = (req as any).user?.userId;
  const { id } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter: any = {
    customer: customerId,
    $or: [{ ticketNumber: id }],
  };
  if (isObjectId) {
    filter.$or.push({ _id: id });
  }

  const ticket = await CustomerSupportRequest.findOne(filter);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found or unauthorized" });
  }

  if (ticket.status === "Closed") {
    return res.status(400).json({ success: false, message: "Ticket is already closed" });
  }

  const transitionCheck = validateSupportStatusTransition(ticket.status, "Closed", "Customer");
  if (!transitionCheck.valid) {
    return res.status(400).json({ success: false, code: transitionCheck.code, message: transitionCheck.message });
  }

  ticket.status = "Closed";
  ticket.closedAt = new Date();
  await ticket.save();

  const io: SocketIOServer = req.app?.get ? req.app.get("io") : undefined;
  if (io) {
    io.to(`support-ticket-${ticket._id}`).emit("ticket-updated", {
      ticketId: ticket._id,
      status: "Closed",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Ticket closed successfully",
    data: ticket,
  });
});
