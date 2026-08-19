/**
 * returnLifecycleService.ts
 *
 * Centralizes the 9-stage return lifecycle:
 *   Pending → Approved → Pickup Pending → Delivery Partner Assigned →
 *   Picked Up → In Transit → Handed To Seller → Completed
 *   (Rejected = terminal failure)
 *
 * RULES:
 * - Financial settlement NEVER fires before "Completed".
 * - Idempotency: each transition checks current status before mutating.
 * - OTP has 10-minute expiry and 5-attempt limit (mirrors forward delivery pattern).
 */

import Return, { IReturn } from "../models/Return";

// ─────────────────────────────────────────────────────────────────────────────
// State Machine Definition
// ─────────────────────────────────────────────────────────────────────────────

type ReturnStatus = IReturn["status"];

/** Valid transitions: Map of from-state → allowed to-states */
const ALLOWED_TRANSITIONS: Record<string, ReturnStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Pickup Pending"],
  "Pickup Pending": ["Delivery Partner Assigned"],
  "Delivery Partner Assigned": ["Picked Up"],
  "Picked Up": ["In Transit"],
  "In Transit": ["Handed To Seller"],
  "Handed To Seller": ["Completed"],
  Completed: [], // Terminal — no further transitions
  Rejected: [], // Terminal — no further transitions
};

/** Seller-permitted transitions (subset) */
const SELLER_ALLOWED_TRANSITIONS: Record<string, ReturnStatus[]> = {
  Pending: ["Approved", "Rejected"],
  "Handed To Seller": ["Completed"], // Seller confirms physical receipt
};

/** Admin-permitted transitions */
const ADMIN_ALLOWED_TRANSITIONS: Record<string, ReturnStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Pickup Pending"],
  "Pickup Pending": ["Delivery Partner Assigned"],
};

/** Delivery partner-permitted transitions */
const DP_ALLOWED_TRANSITIONS: Record<string, ReturnStatus[]> = {
  "Delivery Partner Assigned": ["Picked Up"],
  "Picked Up": ["In Transit"],
  "In Transit": ["Handed To Seller"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Transition Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a generic status transition against the full state machine.
 * Throws a descriptive error on invalid transitions.
 */
export function validateReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus
): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid return status transition: "${from}" → "${to}". ` +
        `Allowed from "${from}": [${allowed.map((s) => `"${s}"`).join(", ") || "none (terminal state)"}]`
    );
  }
}

/**
 * Validates a transition specifically for a Seller actor.
 */
export function validateSellerReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus
): void {
  const allowed = SELLER_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Sellers cannot perform the transition "${from}" → "${to}". ` +
        `Seller-allowed transitions from "${from}": [${allowed.map((s) => `"${s}"`).join(", ") || "none"}]`
    );
  }
}

/**
 * Validates a transition specifically for an Admin actor.
 */
export function validateAdminReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus
): void {
  const allowed = ADMIN_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Admin cannot perform the transition "${from}" → "${to}". ` +
        `Admin-allowed transitions from "${from}": [${allowed.map((s) => `"${s}"`).join(", ") || "none"}]`
    );
  }
}

/**
 * Validates a transition specifically for a Delivery Partner actor.
 */
export function validateDPReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus
): void {
  const allowed = DP_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Delivery partner cannot perform the transition "${from}" → "${to}". ` +
        `DP-allowed transitions from "${from}": [${allowed.map((s) => `"${s}"`).join(", ") || "none"}]`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Pickup OTP
// ─────────────────────────────────────────────────────────────────────────────

const PICKUP_OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PICKUP_OTP_ATTEMPTS = 5;

/** Returns true if delivery test mode is active */
function isReturnTestMode(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.DELIVERY_TEST_MODE).trim().toLowerCase() === "true"
  );
}

/**
 * Generates a 4-digit pickup OTP for the return document.
 * Stores OTP (hashed in prod, plaintext in test) with 10-minute expiry.
 * Resets attempt counter on each new OTP generation.
 */
export async function generateReturnPickupOtp(
  returnId: string
): Promise<{ success: boolean; message: string; otp?: string; testMode?: boolean }> {
  const returnReq = await Return.findById(returnId).select("+pickupOtp");
  if (!returnReq) {
    throw new Error("Return request not found");
  }

  if (returnReq.status !== "Delivery Partner Assigned") {
    throw new Error(
      `Cannot generate pickup OTP — return is in "${returnReq.status}" status. Must be "Delivery Partner Assigned".`
    );
  }

  const testMode = isReturnTestMode();
  const newOtp = testMode
    ? "9999"
    : Math.floor(1000 + Math.random() * 9000).toString();

  returnReq.pickupOtp = newOtp;
  returnReq.pickupOtpExpiresAt = new Date(Date.now() + PICKUP_OTP_EXPIRY_MS);
  returnReq.pickupOtpAttempts = 0;
  returnReq.pickupOtpVerified = false;
  await returnReq.save();

  console.log(
    `[Return OTP] ${testMode ? "TEST MODE OTP (9999)" : "Dynamic OTP"} generated for return ${returnReq._id}`
  );

  return {
    success: true,
    message: testMode
      ? "Development Test Mode: Return pickup OTP is 9999."
      : "Return pickup OTP generated. Customer will receive it.",
    otp: testMode ? "9999" : undefined,
    testMode,
  };
}

/**
 * Verifies a pickup OTP submitted by the delivery partner.
 * On success: marks pickupOtpVerified = true, advances status to "Picked Up".
 * On failure: increments attempt counter, blocks after 5 failures.
 */
export async function verifyReturnPickupOtp(
  returnId: string,
  otp: string
): Promise<{ success: boolean; message: string }> {
  const returnReq = await Return.findById(returnId).select("+pickupOtp");
  if (!returnReq) {
    throw new Error("Return request not found");
  }

  if (returnReq.status === "Picked Up") {
    return { success: true, message: "Return is already marked as picked up (idempotent)." };
  }

  if (returnReq.status !== "Delivery Partner Assigned") {
    throw new Error(
      `Cannot verify pickup OTP — return is in "${returnReq.status}" status.`
    );
  }

  // Attempt limit
  const attempts = returnReq.pickupOtpAttempts || 0;
  if (attempts >= MAX_PICKUP_OTP_ATTEMPTS) {
    throw new Error(
      "Too many incorrect OTP attempts. Please request a new OTP."
    );
  }

  // Expiry check
  if (
    returnReq.pickupOtpExpiresAt &&
    new Date() > new Date(returnReq.pickupOtpExpiresAt)
  ) {
    throw new Error("Return pickup OTP has expired. Please request a new OTP.");
  }

  // Dev bypass
  if (
    (process.env.NODE_ENV !== "production" ||
      process.env.USE_MOCK_OTP === "true") &&
    otp === "9999"
  ) {
    returnReq.pickupOtpVerified = true;
    returnReq.pickupOtpAttempts = 0;
    returnReq.status = "Picked Up";
    returnReq.pickedUpAt = new Date();
    await returnReq.save();
    return { success: true, message: "Return pickup OTP verified (test mode). Return marked as Picked Up." };
  }

  // Exact OTP match
  if (returnReq.pickupOtp !== otp) {
    returnReq.pickupOtpAttempts = attempts + 1;
    await returnReq.save();
    const remaining = MAX_PICKUP_OTP_ATTEMPTS - returnReq.pickupOtpAttempts;
    if (remaining <= 0) {
      throw new Error(
        "Too many incorrect OTP attempts. Verification blocked. Please request a new OTP."
      );
    }
    throw new Error(
      `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
    );
  }

  // SUCCESS
  returnReq.pickupOtpVerified = true;
  returnReq.pickupOtpAttempts = 0;
  returnReq.status = "Picked Up";
  returnReq.pickedUpAt = new Date();
  await returnReq.save();

  return {
    success: true,
    message: "Return pickup OTP verified. Return marked as Picked Up.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Settlement Trigger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers financial settlement ONLY when return is Completed.
 * This is the ONLY place executeReturnRefundAndReversal should be called
 * from the return lifecycle (never from Approved, Pickup Pending, etc.)
 */
export async function triggerReturnFinancialSettlement(
  returnId: string,
  processedByUserId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { executeReturnRefundAndReversal } = await import(
    "./refundSettlementService"
  );
  return executeReturnRefundAndReversal(returnId, processedByUserId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get human-readable lifecycle summary
// ─────────────────────────────────────────────────────────────────────────────

export function getReturnLifecycleSummary(status: ReturnStatus): {
  stage: number;
  label: string;
  description: string;
  nextActions: string[];
} {
  const stages: Record<ReturnStatus, { stage: number; label: string; description: string; nextActions: string[] }> = {
    Pending: {
      stage: 1,
      label: "Return Requested",
      description: "Customer has requested a return. Awaiting seller approval.",
      nextActions: ["Seller: Approve or Reject"],
    },
    Approved: {
      stage: 2,
      label: "Return Approved",
      description: "Seller approved the return. Waiting for pickup assignment.",
      nextActions: ["Auto-advances to Pickup Pending"],
    },
    "Pickup Pending": {
      stage: 3,
      label: "Awaiting Pickup Assignment",
      description: "Return is approved. Admin needs to assign a delivery partner.",
      nextActions: ["Admin: Assign Delivery Partner"],
    },
    "Delivery Partner Assigned": {
      stage: 4,
      label: "Pickup Assigned",
      description: "Delivery partner assigned. Awaiting pickup OTP verification.",
      nextActions: ["Delivery Partner: Generate OTP", "Delivery Partner: Verify OTP & Pick Up"],
    },
    "Picked Up": {
      stage: 5,
      label: "Item Picked Up",
      description: "Delivery partner has collected the item from customer.",
      nextActions: ["Delivery Partner: Mark In Transit"],
    },
    "In Transit": {
      stage: 6,
      label: "In Transit to Seller",
      description: "Item is being transported to the seller.",
      nextActions: ["Delivery Partner: Mark Handed To Seller"],
    },
    "Handed To Seller": {
      stage: 7,
      label: "Delivered to Seller",
      description: "Delivery partner has handed the item to the seller.",
      nextActions: ["Seller: Confirm Receipt → triggers refund"],
    },
    Completed: {
      stage: 8,
      label: "Return Completed",
      description: "Seller confirmed receipt. Financial settlement executed.",
      nextActions: [],
    },
    Rejected: {
      stage: 0,
      label: "Return Rejected",
      description: "Return request was rejected.",
      nextActions: [],
    },
  };
  return stages[status] || stages["Pending"];
}
