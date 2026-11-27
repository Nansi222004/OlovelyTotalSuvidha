import Coupon from "../models/Coupon";
import Order from "../models/Order";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface ICouponLine {
  productId?: string;
  categoryId?: string;
  sellerId?: string;
  total: number;
}

/**
 * Authoritative coupon discount. Discount applies to the PRODUCT subtotal of eligible lines only
 * (delivery/platform/tip/gift fees are never discounted). Honours applicableTo/applicableIds,
 * which the checkout previously ignored (a "Product"/"Category"/"Seller" coupon discounted the
 * whole cart).
 */
export const computeCouponDiscount = (
  coupon: {
    discountType: string;
    discountValue: number;
    maximumDiscount?: number;
    minimumPurchase?: number;
    applicableTo?: string;
    applicableIds?: any[];
  },
  lines: ICouponLine[],
): { eligibleSubtotal: number; discount: number; reason?: string } => {
  const scope = coupon.applicableTo || "All";
  const ids = new Set((coupon.applicableIds || []).map((x: any) => String(x)));
  const eligible = lines.filter((l) => {
    if (scope === "All" || ids.size === 0) return true;
    if (scope === "Product") return l.productId != null && ids.has(String(l.productId));
    if (scope === "Category") return l.categoryId != null && ids.has(String(l.categoryId));
    if (scope === "Seller") return l.sellerId != null && ids.has(String(l.sellerId));
    return true;
  });
  const productSubtotal = round2(lines.reduce((s, l) => s + (Number(l.total) || 0), 0));
  const eligibleSubtotal = round2(eligible.reduce((s, l) => s + (Number(l.total) || 0), 0));

  if (eligibleSubtotal <= 0) return { eligibleSubtotal: 0, discount: 0, reason: "No eligible items for this coupon" };
  // Minimum purchase is evaluated on the whole product subtotal (existing business rule)
  if (coupon.minimumPurchase && productSubtotal < coupon.minimumPurchase) {
    return { eligibleSubtotal, discount: 0, reason: `Minimum purchase ₹${coupon.minimumPurchase} not met` };
  }

  let discount = 0;
  if (coupon.discountType === "Percentage") {
    discount = (eligibleSubtotal * Number(coupon.discountValue || 0)) / 100;
    if (coupon.maximumDiscount && discount > coupon.maximumDiscount) discount = coupon.maximumDiscount;
  } else {
    discount = Math.min(Number(coupon.discountValue || 0), eligibleSubtotal);
  }
  discount = Math.max(0, Math.min(round2(discount), eligibleSubtotal));
  return { eligibleSubtotal, discount };
};

/**
 * Per-customer usage (usageLimitPerUser) was stored but never enforced anywhere.
 * Counts the customer's non-failed, non-cancelled orders that used the coupon.
 */
export const hasReachedPerUserCouponLimit = async (
  coupon: { code: string; usageLimitPerUser?: number },
  customerId: string,
): Promise<boolean> => {
  if (!coupon.usageLimitPerUser || coupon.usageLimitPerUser <= 0 || !customerId) return false;
  const used = await Order.countDocuments({
    customer: customerId,
    couponCode: String(coupon.code).trim().toUpperCase(),
    status: { $nin: ["Cancelled", "Rejected"] },
    paymentStatus: { $ne: "Failed" },
  });
  return used >= coupon.usageLimitPerUser;
};

/** Highest tip a customer can add to one order (checkout UI enforces the same limit). */
export const MAX_TIP_AMOUNT = 500;

/**
 * Client-supplied tip must be a finite, non-negative amount (a negative tip reduced the total),
 * capped at MAX_TIP_AMOUNT so a typo like ₹99,999 can never become a huge COD order.
 */
export const sanitizeTipAmount = (raw: any): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return round2(Math.min(n, MAX_TIP_AMOUNT));
};

export interface ICommitCouponResult {
  success: boolean;
  message: string;
  previousUsageCount?: number;
  newUsageCount?: number;
}

/**
 * Atomically commits coupon usage for a confirmed/paid order.
 * Ensures usage is committed exactly once per order (idempotent),
 * respects global usage limits, and increments usage count safely.
 */
export const commitCouponUsage = async (
  order: any,
  session?: any
): Promise<ICommitCouponResult> => {
  if (!order || !order.couponCode) {
    return { success: false, message: "No coupon code associated with order" };
  }

  // Idempotency Protection: If coupon usage was already committed for this order, skip!
  if (order.couponUsageCommitted) {
    console.log(`[COUPON USAGE SKIPPED]
Order ID: ${order._id}
Reason: Usage already committed`);
    return { success: true, message: "Coupon usage already committed" };
  }

  const normalizedCode = order.couponCode.trim().toUpperCase();

  try {
    const coupon = await Coupon.findOne({ code: normalizedCode });
    if (!coupon) {
      console.warn(`⚠️ Coupon ${normalizedCode} not found when committing usage for order ${order._id}`);
      order.couponUsageCommitted = true;
      if (session) {
        await order.save({ session });
      } else {
        await order.save();
      }
      return { success: false, message: "Coupon not found" };
    }

    const prevCount = coupon.usageCount || 0;

    // Build atomic query: if usageLimit exists, ensure usageCount < usageLimit
    const query: any = { _id: coupon._id };
    if (coupon.usageLimit && coupon.usageLimit > 0) {
      query.usageCount = { $lt: coupon.usageLimit };
    }

    const updatedCoupon = await Coupon.findOneAndUpdate(
      query,
      { $inc: { usageCount: 1 } },
      { new: true, session }
    );

    if (!updatedCoupon) {
      console.warn(`[COUPON USAGE LIMIT EXCEEDED]
Order ID: ${order._id}
Coupon Code: ${normalizedCode}
Reason: Global usage limit (${coupon.usageLimit}) reached before payment completion`);

      order.couponUsageCommitted = true;
      if (session) {
        await order.save({ session });
      } else {
        await order.save();
      }
      return { success: false, message: "Coupon usage limit reached" };
    }

    // Mark usage committed on the order
    order.couponUsageCommitted = true;
    if (session) {
      await order.save({ session });
    } else {
      await order.save();
    }

    console.log(`[COUPON USAGE COMMIT]
Order ID: ${order._id}
Coupon Code: ${normalizedCode}
Payment Method: ${order.paymentMethod}
Payment Status: ${order.paymentStatus}
Previous Usage Count: ${prevCount}
New Usage Count: ${updatedCoupon.usageCount}
Committed: true`);

    return {
      success: true,
      message: "Coupon usage committed successfully",
      previousUsageCount: prevCount,
      newUsageCount: updatedCoupon.usageCount,
    };
  } catch (error: any) {
    console.error(`❌ Error committing coupon usage for order ${order._id}:`, error);
    return { success: false, message: error.message || "Failed to commit coupon usage" };
  }
};
