import mongoose from "mongoose";
import Order, { IOrder, IFulfillmentGroup } from "../models/Order";
import OrderItem, { IOrderItem } from "../models/OrderItem";
import Customer, { ICustomer } from "../models/Customer";
import Return, { IReturn } from "../models/Return";
import OrderEmailNotification, { IOrderEmailNotification } from "../models/OrderEmailNotification";
import { sendEmail, escapeHtml } from "./emailService";

export interface IEmailDeliveryResult {
  sent: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  skippedReason?: string;
  error?: string;
  notificationId?: string;
  messageId?: string;
  eventKey: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFrontendBaseUrl(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_URL || process.env.SERVER_URL || "https://olovely.com";
  const firstUrl = raw.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return (firstUrl || "https://olovely.com").replace(/\/+$/, "");
}

/**
 * Format currency in Indian Rupees
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Resolve authoritative customer email and validate customer ownership
 */
async function resolveAuthoritativeCustomerEmail(
  order: IOrder
): Promise<{ email: string | null; customerDoc: ICustomer | null; error?: string }> {
  let customerDoc: ICustomer | null = null;

  if (order.customer) {
    customerDoc = await Customer.findById(order.customer);
  }

  // 1. Check order.customerEmail first
  let email = (order.customerEmail || "").trim().toLowerCase();

  // 2. Fall back to registered customer email
  if (!email && customerDoc?.email) {
    email = customerDoc.email.trim().toLowerCase();
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return { email: null, customerDoc, error: "Missing or invalid customer email address" };
  }

  // 3. Check customer notification preferences
  if (customerDoc?.notificationPreferences && customerDoc.notificationPreferences.email === false) {
    return { email: null, customerDoc, error: "Customer opted out of email notifications" };
  }

  return { email, customerDoc };
}

/**
 * Atomically reserve an email notification event to guarantee idempotency.
 */
async function reserveEmailNotificationEvent(
  orderId: string,
  orderNumber: string,
  customerId: string,
  recipientEmail: string,
  eventKey: string,
  subject: string,
  templateType: string,
  channel?: "QUICK_COMMERCE" | "ECOMMERCE" | "MIXED",
  metadata?: Record<string, any>,
  isRetry = false
): Promise<{ reserved: boolean; record: IOrderEmailNotification; duplicate?: boolean }> {
  try {
    const record = await OrderEmailNotification.create({
      order: new mongoose.Types.ObjectId(orderId),
      orderNumber,
      customer: new mongoose.Types.ObjectId(customerId),
      recipientEmail,
      eventKey,
      subject,
      templateType,
      channel,
      status: "PENDING",
      attempts: 1,
      lastAttemptAt: new Date(),
      metadata,
    });
    return { reserved: true, record };
  } catch (error: any) {
    if (error?.code === 11000) {
      const existing = await OrderEmailNotification.findOne({ eventKey });
      if (!existing) {
        throw error;
      }
      if (existing.status === "SENT") {
        return { reserved: false, record: existing, duplicate: true };
      }
      if (existing.status === "SKIPPED") {
        return { reserved: false, record: existing, duplicate: true };
      }
      if (existing.status === "PENDING" && !isRetry) {
        // In-flight transmission lock
        // Check for abandoned pending lease (> 5 minutes old) to recover crashed workers safely
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (existing.lastAttemptAt && existing.lastAttemptAt < fiveMinutesAgo && existing.attempts < 5) {
          const recovered = await OrderEmailNotification.findOneAndUpdate(
            {
              eventKey,
              status: "PENDING",
              lastAttemptAt: { $lt: fiveMinutesAgo },
              attempts: { $lt: 5 },
            },
            {
              $set: { status: "PENDING", lastAttemptAt: new Date() },
              $inc: { attempts: 1 },
            },
            { new: true }
          );
          if (recovered) {
            return { reserved: true, record: recovered };
          }
        }
        return { reserved: false, record: existing, duplicate: true };
      }
      if (isRetry || existing.status === "FAILED") {
        if (existing.attempts >= 5) {
          return { reserved: false, record: existing, duplicate: true };
        }
        // Atomic reservation on retry: only ONE concurrent worker can transition FAILED -> PENDING
        const reclaimed = await OrderEmailNotification.findOneAndUpdate(
          {
            eventKey,
            status: "FAILED",
            attempts: { $lt: 5 },
          },
          {
            $set: { status: "PENDING", lastAttemptAt: new Date() },
            $inc: { attempts: 1 },
          },
          { new: true }
        );
        if (reclaimed) {
          return { reserved: true, record: reclaimed };
        }
        return { reserved: false, record: existing, duplicate: true };
      }
      return { reserved: false, record: existing, duplicate: true };
    }
    throw error;
  }
}

/**
 * Builds standard responsive Olovely email layout
 */
function buildEmailHtml(params: {
  title: string;
  badgeText: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  headline: string;
  description: string;
  orderNumber: string;
  orderDate?: Date;
  statusText: string;
  channelSectionHtml?: string;
  itemsSectionHtml?: string;
  totalsSectionHtml?: string;
  viewOrderUrl: string;
}): string {
  const badgeBg = params.badgeBgColor || "#dcfce7";
  const badgeTextCol = params.badgeTextColor || "#166534";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; color: #1f2937; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #16a34a; color: #ffffff; padding: 24px 32px; text-align: left; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.92; }
    .content { padding: 32px; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${badgeBg}; color: ${badgeTextCol}; margin-bottom: 16px; }
    .headline { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
    .description { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0; }
    .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .card-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin: 0 0 12px 0; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .meta-label { color: #6b7280; }
    .meta-val { font-weight: 600; color: #111827; text-align: right; }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .item-row:last-child { border-bottom: none; }
    .item-title { font-weight: 600; font-size: 14px; color: #111827; }
    .item-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .wholesale-badge { display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px; text-transform: uppercase; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; text-align: center; }
    .btn-container { text-align: center; margin: 28px 0 12px 0; }
    .footer { background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.5; }
    .footer a { color: #16a34a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Olovely Total Suvidha</h1>
      <p>Your Trusted Local & Online Shopping Partner</p>
    </div>
    <div class="content">
      <div class="status-badge">${escapeHtml(params.badgeText)}</div>
      <h2 class="headline">${escapeHtml(params.headline)}</h2>
      <p class="description">${escapeHtml(params.description)}</p>

      <div class="card">
        <div class="card-title">Order Information</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #6b7280; width: 45%;">Order Number:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #111827; text-align: right;">#${escapeHtml(params.orderNumber)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Current Status:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #16a34a; text-align: right;">${escapeHtml(params.statusText)}</td>
          </tr>
          ${params.orderDate ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Order Date:</td>
            <td style="padding: 4px 0; color: #111827; text-align: right;">${params.orderDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</td>
          </tr>` : ""}
        </table>
      </div>

      ${params.channelSectionHtml || ""}
      ${params.itemsSectionHtml || ""}
      ${params.totalsSectionHtml || ""}

      <div class="btn-container">
        <a href="${params.viewOrderUrl}" class="btn" target="_blank" rel="noopener noreferrer">View Order Details</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">This email was sent regarding your order #${escapeHtml(params.orderNumber)} on Olovely Total Suvidha.</p>
      <p style="margin: 0;">If you have any questions, reach out through the <a href="${params.viewOrderUrl}">Order Support</a> page in your account.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Render items table HTML with wholesale indicators
 */
function renderItemsTableHtml(items: any[]): string {
  if (!items || items.length === 0) return "";

  const rowsHtml = items.map((item) => {
    const isWholesale = Boolean(item.isWholesale);
    const variantStr = item.variantTitle || item.variation ? ` (${item.variantTitle || item.variation})` : "";
    const unitPrice = isWholesale && item.wholesalePrice ? item.wholesalePrice : item.unitPrice || 0;
    const total = item.total || unitPrice * (item.quantity || 1);

    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <div style="font-weight: 600; color: #111827; font-size: 14px;">
            ${escapeHtml(item.productName || "Product")}
            ${isWholesale ? `<span style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Wholesale</span>` : ""}
          </div>
          ${variantStr ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Variant: ${escapeHtml(variantStr)}</div>` : ""}
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Qty: ${item.quantity} × ${formatCurrency(unitPrice)}</div>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600; color: #111827; font-size: 14px; vertical-align: top;">
          ${formatCurrency(total)}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 12px;">Ordered Items</div>
      <table style="width: 100%; border-collapse: collapse;">
        ${rowsHtml}
      </table>
    </div>
  `;
}

/**
 * Render order financial totals section
 */
function renderTotalsHtml(order: IOrder): string {
  return `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
        <tr>
          <td style="padding: 3px 0;">Subtotal:</td>
          <td style="padding: 3px 0; text-align: right; color: #111827; font-weight: 500;">${formatCurrency(order.subtotal)}</td>
        </tr>
        ${order.discount && order.discount > 0 ? `
        <tr>
          <td style="padding: 3px 0; color: #16a34a;">Discount:</td>
          <td style="padding: 3px 0; text-align: right; color: #16a34a; font-weight: 600;">-${formatCurrency(order.discount)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 3px 0;">Delivery Fee:</td>
          <td style="padding: 3px 0; text-align: right; color: #111827; font-weight: 500;">${order.shipping === 0 ? "FREE" : formatCurrency(order.shipping)}</td>
        </tr>
        ${order.platformFee && order.platformFee > 0 ? `
        <tr>
          <td style="padding: 3px 0;">Platform Fee:</td>
          <td style="padding: 3px 0; text-align: right; color: #111827; font-weight: 500;">${formatCurrency(order.platformFee)}</td>
        </tr>` : ""}
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 8px 0 0 0; font-weight: 700; font-size: 15px; color: #111827;">Total Paid / Payable:</td>
          <td style="padding: 8px 0 0 0; text-align: right; font-weight: 700; font-size: 16px; color: #16a34a;">${formatCurrency(order.total)}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Render Quick Commerce delivery card (never shows Shiprocket tracking)
 */
function renderQuickCommerceSectionHtml(order: IOrder): string {
  const addr = order.deliveryAddress;
  const addressStr = [addr?.address, addr?.landmark, addr?.city, addr?.pincode]
    .filter(Boolean)
    .join(", ");

  return `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 16px; margin-right: 8px;">⚡</span>
        <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46;">Quick Commerce • Local Delivery</span>
      </div>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #047857; line-height: 1.5;">
        This order is fulfilled by local verified merchants with fast instant delivery.
      </p>
      ${addressStr ? `
      <div style="font-size: 13px; color: #065f46; border-top: 1px solid #d1fae5; padding-top: 8px;">
        <strong>Delivery Destination:</strong> ${escapeHtml(addressStr)}
      </div>` : ""}
    </div>
  `;
}

/**
 * Render Ecommerce courier shipment card (includes tracking details ONLY when available)
 */
function renderEcommerceSectionHtml(group?: IFulfillmentGroup): string {
  const shipping = group?.shippingDetails;
  const hasAwb = Boolean(shipping?.awbNumber);
  const hasCarrier = Boolean(shipping?.carrier);
  const hasTrackingUrl = Boolean(shipping?.trackingUrl);

  if (!hasAwb && !hasCarrier) {
    return `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; margin-bottom: 6px;">
          📦 Standard Courier Delivery
        </div>
        <p style="margin: 0; font-size: 14px; color: #1e3a8a; line-height: 1.5;">
          Your order will be safely dispatched via our courier shipping network. Tracking and AWB details will be emailed as soon as the package is handed over to the courier partner.
        </p>
      </div>
    `;
  }

  return `
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; margin-bottom: 12px;">
        🚚 Courier Tracking Details
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${hasCarrier ? `
        <tr>
          <td style="padding: 4px 0; color: #4b5563; width: 45%;">Courier Partner:</td>
          <td style="padding: 4px 0; font-weight: 600; color: #111827; text-align: right;">${escapeHtml(shipping!.carrier!)}</td>
        </tr>` : ""}
        ${hasAwb ? `
        <tr>
          <td style="padding: 4px 0; color: #4b5563;">AWB / Tracking No:</td>
          <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #1e40af; text-align: right;">${escapeHtml(shipping!.awbNumber!)}</td>
        </tr>` : ""}
        ${shipping?.estimatedDelivery ? `
        <tr>
          <td style="padding: 4px 0; color: #4b5563;">Estimated Delivery:</td>
          <td style="padding: 4px 0; font-weight: 600; color: #111827; text-align: right;">${new Date(shipping.estimatedDelivery).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</td>
        </tr>` : ""}
      </table>
      ${hasTrackingUrl ? `
      <div style="margin-top: 14px; text-align: right;">
        <a href="${shipping!.trackingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block;" target="_blank" rel="noopener noreferrer">
          Track on Courier Website ↗
        </a>
      </div>` : ""}
    </div>
  `;
}

/**
 * Render mixed order groups summary
 */
function renderMixedOrderGroupsHtml(order: IOrder): string {
  const groups = order.fulfillmentGroups || [];
  if (groups.length === 0) return "";

  const groupsHtml = groups.map((g, index) => {
    const isQc = g.fulfillmentType === "LOCAL_DELIVERY";
    const statusText = g.status;
    const awb = g.shippingDetails?.awbNumber;
    const carrier = g.shippingDetails?.carrier;

    return `
      <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #111827;">Package ${index + 1}: ${isQc ? "Local Instant Delivery" : "Courier Shipping"}</strong>
          <span style="font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 12px; background-color: ${statusText === "Delivered" ? "#dcfce7" : "#fef3c7"}; color: ${statusText === "Delivered" ? "#166534" : "#92400e"};">
            ${escapeHtml(statusText)}
          </span>
        </div>
        ${!isQc && awb ? `<div style="font-size: 12px; color: #6b7280;">Courier: ${escapeHtml(carrier || "Courier")} • AWB: <span style="font-family: monospace;">${escapeHtml(awb)}</span></div>` : ""}
      </div>
    `;
  }).join("");

  return `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 10px;">
        Fulfillment Groups (Separate Deliveries)
      </div>
      <p style="font-size: 13px; color: #4b5563; margin: 0 0 12px 0;">
        Your order contains items fulfilled via multiple channels. Each package moves independently.
      </p>
      ${groupsHtml}
    </div>
  `;
}

/**
 * 1. Send customer order status email
 * Covers Order Placed, Accepted, Processing, Picked Up, Shipped, Out for Delivery, Delivered, Cancelled
 */
export async function sendCustomerOrderStatusEmail(
  orderId: string,
  newStatus: string
): Promise<IEmailDeliveryResult> {
  const normStatus = (newStatus || "").trim();
  const eventKey = `order:${orderId}:status:${normStatus.toLowerCase()}`;

  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) {
      console.warn(`[OrderEmailService] Order ${orderId} not found. Skipping email.`);
      return { sent: false, skipped: true, skippedReason: "Order not found", eventKey };
    }

    const { email, customerDoc, error: emailErr } = await resolveAuthoritativeCustomerEmail(order);
    if (!email) {
      console.warn(`[OrderEmailService] Order ${order.orderNumber}: ${emailErr}. Skipping email.`);
      return { sent: false, skipped: true, skippedReason: emailErr, eventKey };
    }

    const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    const viewOrderUrl = `${getFrontendBaseUrl()}/orders/${order._id}`;

    // Status-specific title & descriptions
    const statusMeta: Record<string, { badge: string; headline: string; description: string; badgeBg?: string; badgeText?: string }> = {
      received: {
        badge: "Order Confirmed",
        headline: "Thank you for your order! 🛍️",
        description: "We've received your order and notified the sellers. We'll keep you updated every step of the way.",
        badgeBg: "#dcfce7",
        badgeText: "#166534",
      },
      pending: {
        badge: "Order Placed",
        headline: "Your order is confirmed 🛍️",
        description: "Your order has been recorded and is currently awaiting seller acceptance.",
        badgeBg: "#dbeafe",
        badgeText: "#1e40af",
      },
      accepted: {
        badge: "Order Accepted",
        headline: "Seller has accepted your order! 📌",
        description: "The merchant has confirmed your order and is now getting it ready for packing.",
        badgeBg: "#e0e7ff",
        badgeText: "#3730a3",
      },
      processed: {
        badge: "Preparing",
        headline: "Your items are being prepared 🍳",
        description: "The seller is carefully packing your items and getting everything ready for dispatch.",
        badgeBg: "#fef3c7",
        badgeText: "#92400e",
      },
      preparing: {
        badge: "Preparing",
        headline: "Your items are being prepared 🍳",
        description: "The seller is preparing your items for delivery.",
        badgeBg: "#fef3c7",
        badgeText: "#92400e",
      },
      "ready for pickup": {
        badge: "Ready for Pickup",
        headline: "Order packed and ready 📦",
        description: "Your package is ready and waiting for courier / delivery partner collection.",
        badgeBg: "#e0e7ff",
        badgeText: "#3730a3",
      },
      "picked up": {
        badge: "Picked Up",
        headline: "Package picked up 🛵",
        description: "Our delivery partner has collected your package from the store and is on the way.",
        badgeBg: "#dbeafe",
        badgeText: "#1e40af",
      },
      shipped: {
        badge: "Shipped",
        headline: "Your order is on the way! 🚚",
        description: "Your package has been dispatched and is currently in transit to your delivery destination.",
        badgeBg: "#dbeafe",
        badgeText: "#1e40af",
      },
      "on the way": {
        badge: "Out for Delivery",
        headline: "Your delivery is arriving soon! 🛵",
        description: "Our delivery partner is in your area and will deliver your order shortly.",
        badgeBg: "#fef3c7",
        badgeText: "#92400e",
      },
      "out for delivery": {
        badge: "Out for Delivery",
        headline: "Your delivery is arriving soon! 🛵",
        description: "Our delivery partner is on the way to your delivery address.",
        badgeBg: "#fef3c7",
        badgeText: "#92400e",
      },
      delivered: {
        badge: "Delivered",
        headline: "Order Delivered Successfully! 📦",
        description: "Your order has been safely delivered. We hope you love your purchase! Thank you for choosing Olovely Total Suvidha.",
        badgeBg: "#dcfce7",
        badgeText: "#166534",
      },
      completed: {
        badge: "Delivered",
        headline: "Order Delivered Successfully! 📦",
        description: "Your order has been completed and delivered. Thank you for shopping with us!",
        badgeBg: "#dcfce7",
        badgeText: "#166534",
      },
      cancelled: {
        badge: "Cancelled",
        headline: "Your order has been cancelled ❌",
        description: `This order has been cancelled.${order.cancellationReason ? ` Reason: ${order.cancellationReason}` : ""} Any applicable online or wallet payments have been initiated for refund.`,
        badgeBg: "#fee2e2",
        badgeText: "#991b1b",
      },
      rejected: {
        badge: "Order Cancelled",
        headline: "Order could not be fulfilled ❌",
        description: "Unfortunately, the merchant was unable to fulfill your order and it has been cancelled. Any pre-paid amounts will be refunded.",
        badgeBg: "#fee2e2",
        badgeText: "#991b1b",
      },
    };

    const meta = statusMeta[normStatus.toLowerCase()] || {
      badge: normStatus,
      headline: `Order Status Update: ${normStatus}`,
      description: `Your order status has been updated to ${normStatus}.`,
      badgeBg: "#f3f4f6",
      badgeText: "#374151",
    };

    const subject = `Order Update: #${order.orderNumber} — ${meta.badge}`;

    // Atomically reserve to guarantee single email delivery
    const reservation = await reserveEmailNotificationEvent(
      order._id.toString(),
      order.orderNumber,
      customerId,
      email,
      eventKey,
      subject,
      "ORDER_STATUS",
      order.orderType,
      { status: normStatus }
    );

    if (!reservation.reserved) {
      console.log(`[OrderEmailService] Duplicate or in-flight email for eventKey ${eventKey}. Skipping.`);
      return { sent: false, duplicate: true, eventKey };
    }

    // Build channel-specific content
    let channelSectionHtml = "";
    if (order.orderType === "MIXED") {
      channelSectionHtml = renderMixedOrderGroupsHtml(order);
    } else if (order.orderType === "QUICK_COMMERCE") {
      channelSectionHtml = renderQuickCommerceSectionHtml(order);
    } else if (order.orderType === "ECOMMERCE") {
      const firstGroup = (order.fulfillmentGroups || [])[0];
      channelSectionHtml = renderEcommerceSectionHtml(firstGroup);
    }

    const itemsSectionHtml = renderItemsTableHtml(order.items as any[]);
    const totalsSectionHtml = renderTotalsHtml(order);

    const html = buildEmailHtml({
      title: subject,
      badgeText: meta.badge,
      badgeBgColor: meta.badgeBg,
      badgeTextColor: meta.badgeText,
      headline: meta.headline,
      description: meta.description,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      statusText: normStatus,
      channelSectionHtml,
      itemsSectionHtml,
      totalsSectionHtml,
      viewOrderUrl,
    });

    const text = `
Olovely Total Suvidha - Order Update
-----------------------------------
Order Number: #${order.orderNumber}
Status: ${normStatus}
Update: ${meta.headline}
${meta.description}

View complete order details: ${viewOrderUrl}
-----------------------------------
Thank you for choosing Olovely Total Suvidha.
    `.trim();

    // Send email via nodemailer service
    const sendResult = await sendEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (sendResult.success) {
      reservation.record.status = "SENT";
      reservation.record.messageId = sendResult.messageId;
      reservation.record.sentAt = new Date();
      await reservation.record.save();

      return {
        sent: true,
        notificationId: reservation.record._id.toString(),
        messageId: sendResult.messageId,
        eventKey,
      };
    } else {
      reservation.record.status = "FAILED";
      reservation.record.errorMessage = sendResult.error;
      await reservation.record.save();

      console.error(`[OrderEmailService] Failed to deliver order email for ${order.orderNumber}:`, sendResult.error);
      return {
        sent: false,
        error: sendResult.error,
        notificationId: reservation.record._id.toString(),
        eventKey,
      };
    }
  } catch (error: any) {
    console.error(`[OrderEmailService ERROR] Unexpected error sending order email for ${orderId}:`, error);
    return { sent: false, error: error.message, eventKey };
  }
}

/**
 * 2. Send customer fulfillment group update email (for Ecommerce and Mixed orders)
 * Handles courier assignment, AWB generation, dispatch, in-transit, out for delivery, and group delivery.
 */
export async function sendCustomerFulfillmentGroupEmail(
  orderId: string,
  groupId: string,
  groupStatus: string,
  trackingInfo?: { awb?: string; carrier?: string; attemptDate?: string }
): Promise<IEmailDeliveryResult> {
  const normStatus = (groupStatus || "").trim();
  let eventKey = `order:${orderId}:group:${groupId}:status:${normStatus.toLowerCase()}`;

  try {
    const order = await Order.findById(orderId).populate("items");
    const group = (order?.fulfillmentGroups || []).find((g) => g.groupId === groupId);
    const awb = trackingInfo?.awb || group?.shippingDetails?.awbNumber;
    const carrier = trackingInfo?.carrier || group?.shippingDetails?.carrier;
    const attemptDate = trackingInfo?.attemptDate;

    // Distinguish legitimate distinct shipments or delivery attempts without defeating idempotency
    eventKey = attemptDate
      ? `order:${orderId}:group:${groupId}:status:${normStatus.toLowerCase()}:attempt:${attemptDate}`
      : `order:${orderId}:group:${groupId}${awb ? `:awb:${awb}` : ""}:status:${normStatus.toLowerCase()}`;

    if (!order) return { sent: false, skipped: true, skippedReason: "Order not found", eventKey };
    if (!group) return { sent: false, skipped: true, skippedReason: "Fulfillment group not found", eventKey };

    const { email, error: emailErr } = await resolveAuthoritativeCustomerEmail(order);
    if (!email) return { sent: false, skipped: true, skippedReason: emailErr, eventKey };

    const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    const viewOrderUrl = `${getFrontendBaseUrl()}/orders/${order._id}`;

    const isCourier = group.fulfillmentType === "COURIER_SHIPPING" || group.fulfillmentType === "THIRD_PARTY_API";

    let headline = `Shipment Update: ${normStatus}`;
    let description = `Package ${groupId} status is now ${normStatus}.`;

    if (normStatus === "Shipped" || normStatus === "Processing") {
      headline = awb ? `Your Package has Dispatched via ${carrier || "Courier"}! 🚚` : "Your Shipment is Being Processed";
      description = awb
        ? `Package ${groupId} is on the way. Tracking number is ${awb}.`
        : `Your package ${groupId} is being packed and prepared for dispatch.`;
    } else if (normStatus === "OutForDelivery" || normStatus === "Out for Delivery") {
      headline = "Package Out for Delivery 🛵";
      description = `Package ${groupId} is out for delivery and will arrive today.`;
    } else if (normStatus === "Delivered") {
      headline = "Package Delivered 📦";
      description = `Package ${groupId} has been delivered successfully.`;
    }

    const subject = `Shipment Update: #${order.orderNumber} — Package ${normStatus}`;

    const reservation = await reserveEmailNotificationEvent(
      order._id.toString(),
      order.orderNumber,
      customerId,
      email,
      eventKey,
      subject,
      "FULFILLMENT_GROUP",
      order.orderType,
      { groupId, groupStatus: normStatus, awb, carrier }
    );

    if (!reservation.reserved) {
      return { sent: false, duplicate: true, eventKey };
    }

    // Filter items belonging to this group
    const groupItemIds = (group.items || []).map((id) => id.toString());
    const groupItems = (order.items as any[]).filter((it) =>
      groupItemIds.includes(it._id?.toString())
    );

    const channelSectionHtml = isCourier ? renderEcommerceSectionHtml(group) : renderQuickCommerceSectionHtml(order);
    const itemsSectionHtml = renderItemsTableHtml(groupItems.length > 0 ? groupItems : (order.items as any[]));

    const html = buildEmailHtml({
      title: subject,
      badgeText: `Package ${normStatus}`,
      badgeBgColor: normStatus === "Delivered" ? "#dcfce7" : "#dbeafe",
      badgeTextColor: normStatus === "Delivered" ? "#166534" : "#1e40af",
      headline,
      description,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      statusText: `Package: ${normStatus}`,
      channelSectionHtml,
      itemsSectionHtml,
      viewOrderUrl,
    });

    const text = `
Olovely Total Suvidha - Shipment Update
--------------------------------------
Order: #${order.orderNumber}
Package: ${groupId}
Status: ${normStatus}
${awb ? `Courier: ${carrier || "Courier"} | AWB: ${awb}` : ""}
${headline}
${description}

Track Order: ${viewOrderUrl}
    `.trim();

    const sendResult = await sendEmail({ to: email, subject, html, text });

    if (sendResult.success) {
      reservation.record.status = "SENT";
      reservation.record.messageId = sendResult.messageId;
      reservation.record.sentAt = new Date();
      await reservation.record.save();
      return { sent: true, notificationId: reservation.record._id.toString(), messageId: sendResult.messageId, eventKey };
    } else {
      reservation.record.status = "FAILED";
      reservation.record.errorMessage = sendResult.error;
      await reservation.record.save();
      return { sent: false, error: sendResult.error, notificationId: reservation.record._id.toString(), eventKey };
    }
  } catch (error: any) {
    console.error(`[OrderEmailService ERROR] Error sending group update email:`, error);
    return { sent: false, error: error.message, eventKey };
  }
}

/**
 * 3. Send customer return or exchange email
 * Handles Return / Exchange requested, approved, rejected, picked up, replacement dispatched, and completed
 */
export async function sendCustomerReturnExchangeEmail(
  returnId: string,
  stage: string,
  rejectionReason?: string
): Promise<IEmailDeliveryResult> {
  const normStage = (stage || "").trim();
  let eventKey = `return:${returnId}:stage:${normStage.toLowerCase()}`;

  try {
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) return { sent: false, skipped: true, skippedReason: "Return document not found", eventKey };

    const repAwb = returnDoc?.replacement?.awbNumber;
    const isRepLeg = normStage.toLowerCase().includes("forward") || normStage.toLowerCase().includes("replacement");
    eventKey = (isRepLeg && repAwb)
      ? `return:${returnId}:replacement:${repAwb}:stage:${normStage.toLowerCase()}`
      : `return:${returnId}:stage:${normStage.toLowerCase()}`;

    const order = await Order.findById(returnDoc.order);
    if (!order) return { sent: false, skipped: true, skippedReason: "Order not found", eventKey };

    const orderItem = await OrderItem.findById(returnDoc.orderItem);
    const { email, error: emailErr } = await resolveAuthoritativeCustomerEmail(order);
    if (!email) return { sent: false, skipped: true, skippedReason: emailErr, eventKey };

    const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    const isExchange = returnDoc.requestType === "EXCHANGE";
    const typeLabel = isExchange ? "Exchange" : "Return";
    const viewOrderUrl = `${getFrontendBaseUrl()}/orders/${order._id}`;
    const productName = orderItem?.productName || "Item";

    let badgeText = `${typeLabel} ${normStage}`;
    let headline = `${typeLabel} Update`;
    let description = `Your ${typeLabel.toLowerCase()} request for ${productName} is currently ${normStage}.`;
    let badgeBg = "#fef3c7";
    let badgeTextCol = "#92400e";

    if (normStage === "REQUEST_SUBMITTED" || normStage === "Pending") {
      headline = `${typeLabel} Request Submitted`;
      description = `Your ${typeLabel.toLowerCase()} request for ${productName} has been received and is currently under review by the seller.`;
    } else if (normStage === "Approved" || normStage === "Pickup Pending") {
      badgeBg = "#dcfce7";
      badgeTextCol = "#166534";
      headline = `${typeLabel} Request Approved ✅`;
      description = isExchange
        ? `Your exchange request for ${productName} was approved. A pickup for your original item will be scheduled soon.`
        : `Your return request for ${productName} was approved. A pickup partner will be assigned shortly.`;
    } else if (normStage === "Delivery Partner Assigned" || normStage === "Reverse Shipment Created") {
      headline = `${typeLabel} Pickup Scheduled 📦`;
      description = returnDoc.returnAwbNumber
        ? `Reverse courier pickup scheduled with ${returnDoc.courierName || "Courier"} (AWB: ${returnDoc.returnAwbNumber}). Please keep the item packed with tags attached.`
        : `A delivery partner has been assigned to collect your return item. Please keep the item packed safely.`;
    } else if (normStage === "Picked Up" || normStage === "In Transit") {
      headline = `${typeLabel} Item Collected 🚚`;
      description = `Your item (${productName}) has been picked up and is in transit to the seller's facility.`;
    } else if (normStage === "Handed To Seller" || normStage === "QC Pending") {
      headline = isExchange ? "Replacement Processing 🔄" : "Item Received by Seller 📦";
      description = isExchange
        ? `The returned item was received. Your replacement unit is now being prepared for shipment.`
        : `The returned item was safely received by the seller and is undergoing verification.`;
    } else if (normStage === "Forward Shipment Created" || normStage === "Replacement Shipped") {
      badgeBg = "#dbeafe";
      badgeTextCol = "#1e40af";
      headline = "Replacement Unit Dispatched! 🚚";
      const repAwb = returnDoc.replacement?.awbNumber;
      const repCarrier = returnDoc.replacement?.carrier;
      description = `Your replacement for ${productName} has been dispatched! ${repAwb ? `Shipped via ${repCarrier || "Courier"} (AWB: ${repAwb}).` : ""}`;
    } else if (normStage === "Completed") {
      badgeBg = "#dcfce7";
      badgeTextCol = "#166534";
      headline = isExchange ? "Exchange Completed Successfully ✅" : "Return Completed & Refund Processed 💰";
      description = isExchange
        ? `Your exchange for ${productName} is complete. We hope you enjoy your replacement!`
        : `Your return for ${productName} is completed. Your refund has been credited.`;
    } else if (normStage === "Rejected" || normStage === "QC Rejected") {
      badgeBg = "#fee2e2";
      badgeTextCol = "#991b1b";
      headline = `${typeLabel} Request Rejected ❌`;
      description = `Your ${typeLabel.toLowerCase()} request for ${productName} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
    }

    const subject = `${typeLabel} Update: #${order.orderNumber} — ${headline}`;

    const reservation = await reserveEmailNotificationEvent(
      order._id.toString(),
      order.orderNumber,
      customerId,
      email,
      eventKey,
      subject,
      isExchange ? "EXCHANGE_STATUS" : "RETURN_STATUS",
      order.orderType,
      { returnId, stage: normStage, isExchange }
    );

    if (!reservation.reserved) return { sent: false, duplicate: true, eventKey };

    // Details card for return item
    const detailsHtml = `
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 10px;">
          ${typeLabel} Details
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #6b7280; width: 45%;">Item:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #111827; text-align: right;">${escapeHtml(productName)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Quantity:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #111827; text-align: right;">${returnDoc.quantity}</td>
          </tr>
          ${returnDoc.returnAwbNumber ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Reverse AWB:</td>
            <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #1e40af; text-align: right;">${escapeHtml(returnDoc.returnAwbNumber)}</td>
          </tr>` : ""}
          ${isExchange && returnDoc.replacement?.awbNumber ? `
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Replacement AWB:</td>
            <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #16a34a; text-align: right;">${escapeHtml(returnDoc.replacement.awbNumber)}</td>
          </tr>` : ""}
        </table>
      </div>
    `;

    const html = buildEmailHtml({
      title: subject,
      badgeText,
      badgeBgColor: badgeBg,
      badgeTextColor: badgeTextCol,
      headline,
      description,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      statusText: `${typeLabel}: ${normStage}`,
      channelSectionHtml: detailsHtml,
      viewOrderUrl,
    });

    const text = `
Olovely Total Suvidha - ${typeLabel} Update
------------------------------------------
Order: #${order.orderNumber}
Item: ${productName} (Qty: ${returnDoc.quantity})
Status: ${headline}
${description}

View Status: ${viewOrderUrl}
    `.trim();

    const sendResult = await sendEmail({ to: email, subject, html, text });

    if (sendResult.success) {
      reservation.record.status = "SENT";
      reservation.record.messageId = sendResult.messageId;
      reservation.record.sentAt = new Date();
      await reservation.record.save();
      return { sent: true, notificationId: reservation.record._id.toString(), messageId: sendResult.messageId, eventKey };
    } else {
      reservation.record.status = "FAILED";
      reservation.record.errorMessage = sendResult.error;
      await reservation.record.save();
      return { sent: false, error: sendResult.error, notificationId: reservation.record._id.toString(), eventKey };
    }
  } catch (error: any) {
    console.error(`[OrderEmailService ERROR] Error sending return/exchange email:`, error);
    return { sent: false, error: error.message, eventKey };
  }
}

/**
 * 4. Send customer refund notification email
 * Handles pre-cancellation full refund or return item refund
 */
export async function sendCustomerRefundEmail(
  orderId: string,
  refundData: {
    amount: number;
    reason: string;
    method?: string;
    status: string;
    refundId?: string;
  }
): Promise<IEmailDeliveryResult> {
  const normStatus = (refundData.status || "Completed").trim();
  const eventKey = `order:${orderId}:refund:${refundData.refundId || "cancellation"}:status:${normStatus.toLowerCase()}`;

  try {
    const order = await Order.findById(orderId);
    if (!order) return { sent: false, skipped: true, skippedReason: "Order not found", eventKey };

    const { email, error: emailErr } = await resolveAuthoritativeCustomerEmail(order);
    if (!email) return { sent: false, skipped: true, skippedReason: emailErr, eventKey };

    const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    const viewOrderUrl = `${getFrontendBaseUrl()}/orders/${order._id}`;
    const formattedAmount = formatCurrency(refundData.amount);
    const subject = `Refund Update: #${order.orderNumber} — ${formattedAmount} ${normStatus}`;

    const reservation = await reserveEmailNotificationEvent(
      order._id.toString(),
      order.orderNumber,
      customerId,
      email,
      eventKey,
      subject,
      "REFUND",
      order.orderType,
      refundData
    );

    if (!reservation.reserved) return { sent: false, duplicate: true, eventKey };

    const headline = `Refund of ${formattedAmount} ${normStatus === "Completed" ? "Processed Successfully" : "Initiated"} 💰`;
    const description = `A refund of ${formattedAmount} for your order #${order.orderNumber} has been ${normStatus.toLowerCase()}.${refundData.method ? ` Refund destination: ${refundData.method}.` : ""}`;

    const refundCardHtml = `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46; margin-bottom: 10px;">Refund Summary</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #047857; width: 45%;">Refund Amount:</td>
            <td style="padding: 4px 0; font-weight: 700; font-size: 16px; color: #16a34a; text-align: right;">${formattedAmount}</td>
          </tr>
          ${refundData.method ? `
          <tr>
            <td style="padding: 4px 0; color: #047857;">Refund Method:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #065f46; text-align: right;">${escapeHtml(refundData.method)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding: 4px 0; color: #047857;">Refund Status:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #16a34a; text-align: right;">${escapeHtml(normStatus)}</td>
          </tr>
        </table>
      </div>
    `;

    const html = buildEmailHtml({
      title: subject,
      badgeText: `Refund ${normStatus}`,
      badgeBgColor: "#dcfce7",
      badgeTextColor: "#166534",
      headline,
      description,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      statusText: `Refund: ${normStatus}`,
      channelSectionHtml: refundCardHtml,
      viewOrderUrl,
    });

    const text = `
Olovely Total Suvidha - Refund Update
-------------------------------------
Order: #${order.orderNumber}
Refund Amount: ${formattedAmount}
Status: ${normStatus}
${description}

View Order: ${viewOrderUrl}
    `.trim();

    const sendResult = await sendEmail({ to: email, subject, html, text });

    if (sendResult.success) {
      reservation.record.status = "SENT";
      reservation.record.messageId = sendResult.messageId;
      reservation.record.sentAt = new Date();
      await reservation.record.save();
      return { sent: true, notificationId: reservation.record._id.toString(), messageId: sendResult.messageId, eventKey };
    } else {
      reservation.record.status = "FAILED";
      reservation.record.errorMessage = sendResult.error;
      await reservation.record.save();
      return { sent: false, error: sendResult.error, notificationId: reservation.record._id.toString(), eventKey };
    }
  } catch (error: any) {
    console.error(`[OrderEmailService ERROR] Error sending refund email:`, error);
    return { sent: false, error: error.message, eventKey };
  }
}

/**
 * 5. Safe idempotent retry mechanism for failed emails
 */
export async function retryFailedOrderEmail(notificationId: string): Promise<IEmailDeliveryResult> {
  try {
    const record = await OrderEmailNotification.findById(notificationId);
    if (!record) {
      return { sent: false, skipped: true, skippedReason: "Notification record not found", eventKey: "" };
    }

    if (record.status === "SENT") {
      return { sent: true, duplicate: true, eventKey: record.eventKey };
    }

    if (record.status === "SKIPPED") {
      return { sent: false, skipped: true, skippedReason: "Permanently skipped notification cannot be retried", eventKey: record.eventKey };
    }

    if (record.attempts >= 5) {
      return { sent: false, skipped: true, skippedReason: "Maximum retry attempts exceeded", eventKey: record.eventKey };
    }

    if (record.status === "PENDING") {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isStale = record.lastAttemptAt && record.lastAttemptAt < fiveMinutesAgo;
      if (!isStale) {
        return { sent: false, duplicate: true, skippedReason: "Email transmission or retry already in progress", eventKey: record.eventKey };
      }
      // If pending lease is abandoned / stale (> 5 minutes), transition to FAILED so it can be reclaimed
      await OrderEmailNotification.updateOne(
        { _id: record._id, status: "PENDING", lastAttemptAt: { $lt: fiveMinutesAgo } },
        { $set: { status: "FAILED", errorMessage: "Previous transmission worker timed out or crashed" } }
      );
      record.status = "FAILED";
    }

    if (record.status !== "FAILED") {
      return { sent: false, error: `Invalid status for retry: ${record.status}`, eventKey: record.eventKey };
    }

    const order = await Order.findById(record.order);
    if (!order) {
      return { sent: false, skipped: true, skippedReason: "Associated order not found", eventKey: record.eventKey };
    }

    // Re-execute appropriate email sender based on templateType
    if (record.templateType === "ORDER_STATUS") {
      const status = record.metadata?.status || order.status;
      return sendCustomerOrderStatusEmail(order._id.toString(), status);
    }

    if (record.templateType === "FULFILLMENT_GROUP") {
      const groupId = record.metadata?.groupId;
      const groupStatus = record.metadata?.groupStatus || record.metadata?.status;
      if (!groupId || !groupStatus) {
        return { sent: false, error: "Missing fulfillment group metadata for retry", eventKey: record.eventKey };
      }
      return sendCustomerFulfillmentGroupEmail(order._id.toString(), groupId, groupStatus, record.metadata);
    }

    if (record.templateType === "RETURN_STATUS" || record.templateType === "EXCHANGE_STATUS") {
      const returnId = record.metadata?.returnId;
      const stage = record.metadata?.stage;
      if (!returnId || !stage) {
        return { sent: false, error: "Missing return/exchange metadata for retry", eventKey: record.eventKey };
      }
      return sendCustomerReturnExchangeEmail(returnId, stage);
    }

    if (record.templateType === "REFUND") {
      const refundData = record.metadata?.refundData || record.metadata || {
        amount: (order as any).refundAmount || order.total,
        status: "Completed",
        method: order.paymentMethod,
      };
      return sendCustomerRefundEmail(order._id.toString(), refundData);
    }

    return { sent: false, error: "Unsupported retry template type", eventKey: record.eventKey };
  } catch (error: any) {
    console.error(`[OrderEmailService ERROR] Error retrying email:`, error);
    return { sent: false, error: error.message, eventKey: "" };
  }
}
