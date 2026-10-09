export type OrderStatus =
  | "Received"
  | "Accepted"
  | "Pending"
  | "Processed"
  | "Shipped"
  | "Picked up"
  | "On the way"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled"
  | "Rejected"
  | "Returned";

export type OrderFulfillmentChannel = "QUICK_COMMERCE" | "ECOMMERCE" | "MIXED";

/**
 * Normalizes an arbitrary status string or alias into the canonical Order model status.
 */
export function canonicalizeOrderStatus(status: string): OrderStatus | null {
  if (!status || typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "received":
      return "Received";
    case "accepted":
      return "Accepted";
    case "pending":
      return "Pending";
    case "processing":
    case "processed":
    case "preparing":
    case "ready for pickup":
    case "ready_for_pickup":
      return "Processed";
    case "shipped":
      return "Shipped";
    case "picked up":
    case "picked_up":
    case "pickedup":
      return "Picked up";
    case "on the way":
    case "on_the_way":
    case "ontheway":
      return "On the way";
    case "out for delivery":
    case "out_for_delivery":
    case "outfordelivery":
      return "Out for Delivery";
    case "delivered":
    case "completed":
      return "Delivered";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "rejected":
      return "Rejected";
    case "returned":
      return "Returned";
    default:
      return null;
  }
}

/**
 * Valid state transitions for the complete order lifecycle.
 * Terminal states (Delivered, Cancelled, Rejected, Returned) CANNOT transition backward.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Received: ["Accepted", "Cancelled", "Rejected"],
  Pending: ["Accepted", "Cancelled", "Rejected"],
  Accepted: [
    "Processed",
    "Picked up",
    "Shipped",
    "On the way",
    "Out for Delivery",
    "Cancelled",
    "Rejected",
  ],
  Processed: [
    "Picked up",
    "Shipped",
    "On the way",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ],
  "Picked up": ["On the way", "Out for Delivery", "Delivered", "Cancelled"],
  Shipped: ["Out for Delivery", "On the way", "Delivered", "Cancelled"],
  "On the way": ["Delivered", "Cancelled"],
  "Out for Delivery": ["Delivered", "Cancelled"],
  // Terminal states - Delivered only allows formal Return, NEVER backward transitions to active states
  Delivered: ["Returned"],
  Cancelled: [],
  Rejected: [],
  Returned: [],
};

/**
 * Allowed next statuses scoped to fulfillment channel
 */
export function getAllowedNextStatuses(
  currentStatus: string,
  channel?: OrderFulfillmentChannel
): OrderStatus[] {
  const canonicalCurrent = canonicalizeOrderStatus(currentStatus);
  if (!canonicalCurrent) return [];

  const rawAllowed = ALLOWED_ORDER_TRANSITIONS[canonicalCurrent] || [];

  if (channel === "QUICK_COMMERCE") {
    // Quick Commerce does not use Courier 'Shipped'
    return rawAllowed.filter((s) => s !== "Shipped");
  }

  if (channel === "ECOMMERCE") {
    // Ecommerce courier shipping does not use local rider 'Picked up' or 'On the way'
    return rawAllowed.filter((s) => s !== "Picked up" && s !== "On the way");
  }

  return [...rawAllowed];
}

export interface TransitionValidationResult {
  valid: boolean;
  code?: "INVALID_STATUS_TRANSITION" | "UNKNOWN_STATUS";
  message?: string;
  canonicalCurrent?: OrderStatus;
  canonicalNew?: OrderStatus;
  allowedNextStatuses?: OrderStatus[];
}

/**
 * Authoritative validator for order status transitions.
 * Enforces valid state machine and rejects illegal or backward transitions.
 */
export function validateOrderStatusTransition(
  currentStatus: string,
  newStatus: string,
  channel?: OrderFulfillmentChannel
): TransitionValidationResult {
  const canonicalCurrent = canonicalizeOrderStatus(currentStatus);
  const canonicalNew = canonicalizeOrderStatus(newStatus);

  if (!canonicalCurrent) {
    return {
      valid: false,
      code: "UNKNOWN_STATUS",
      message: `Unknown current order status: "${currentStatus}"`,
    };
  }

  if (!canonicalNew) {
    return {
      valid: false,
      code: "UNKNOWN_STATUS",
      message: `Unknown target order status: "${newStatus}"`,
    };
  }

  // Idempotent: same status transition is allowed (e.g. updating notes or delivery preference)
  if (canonicalCurrent === canonicalNew) {
    return {
      valid: true,
      canonicalCurrent,
      canonicalNew,
      allowedNextStatuses: getAllowedNextStatuses(canonicalCurrent, channel),
    };
  }

  const allowedNext = getAllowedNextStatuses(canonicalCurrent, channel);

  if (!allowedNext.includes(canonicalNew)) {
    return {
      valid: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Order cannot transition from ${canonicalCurrent} to ${canonicalNew}`,
      canonicalCurrent,
      canonicalNew,
      allowedNextStatuses: allowedNext,
    };
  }

  return {
    valid: true,
    canonicalCurrent,
    canonicalNew,
    allowedNextStatuses: allowedNext,
  };
}
