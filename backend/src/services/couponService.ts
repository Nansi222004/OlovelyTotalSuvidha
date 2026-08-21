import Coupon from "../models/Coupon";

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
