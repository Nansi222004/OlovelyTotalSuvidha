/**
 * Step 2 — settlement of cancelled order items (partial OR complete), exactly once per item.
 *
 * Used when PART of an order will not be delivered: a seller rejects their items, the carrier
 * cancels a courier shipment, or an admin rejects platform items. If nothing deliverable is
 * left, the same call settles the whole order as a full cancellation.
 *
 * For the items being settled it:
 *   1. restores stock (same idempotency key as every other cancellation path)
 *   2. marks the items Cancelled and stamps cancellationSettledAt (the exactly-once marker)
 *   3. cancels their Pending seller commissions
 *   4. closes fulfillment groups that have no deliverable item left
 *   5. settles the money for the cancelled part:
 *        value = items − their coupon share
 *              + delivery fee of every group that this call leaves with nothing to deliver
 *              + tip, when no quick-commerce part is left to deliver it
 *      (the platform fee is only returned when the WHOLE order is cancelled)
 *        COD    → the cash still to collect drops by the value; any excess over it (wallet
 *                 already used) is refunded
 *        Prepaid→ refund, wallet-funded part first, then the gateway; a failed gateway refund
 *                 falls back to the customer wallet (same rule as returns)
 *      Full cancellation refunds everything actually paid minus what was already refunded.
 *   6. if every remaining part is already Delivered, completes the order (Delivered + payouts)
 */
import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Refund from "../models/Refund";
import { processRefund } from "./paymentService";
import { creditWallet } from "./walletManagementService";
import { calculateItemRefundAmount } from "./refundSettlementService";
import { isQcItem } from "./sellerSettlementService";
import { areAllFulfillmentGroupsDelivered } from "../utils/fulfillmentStatus";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const FINAL_ITEM_STATUSES = ["Cancelled", "Returned"];
const NOT_CANCELLABLE_ITEM_STATUSES = ["Delivered", "Returned"];

export type OrderPartCancellationResult = {
  success: boolean;
  mode: "none" | "partial" | "full";
  settledItemIds: string[];
  refunded: number;
  codReduced: number;
  orderCompleted: boolean;
  message: string;
};

const isWriteConflict = (error: any) =>
  error?.message?.includes("Write conflict") ||
  error?.message?.includes("WriteConflict") ||
  error?.code === 112 ||
  error?.codeName === "WriteConflict" ||
  (typeof error?.hasErrorLabel === "function" && error.hasErrorLabel("TransientTransactionError"));

async function resolveVariationId(orderItem: any): Promise<string | null> {
  if (orderItem.variationId) return orderItem.variationId.toString();
  if (!orderItem.variation || !orderItem.product) return null;
  const Product = (await import("../models/Product")).default;
  const product: any = await Product.findById(orderItem.product).select("variations").lean();
  const match = (product?.variations || []).find(
    (v: any) => v.value === orderItem.variation || v.title === orderItem.variation || v.pack === orderItem.variation,
  );
  return match?._id ? match._id.toString() : null;
}

/** Stock restore with the same deterministic key as customer/admin/seller cancellation paths. */
async function restoreStock(orderId: string, items: any[]) {
  const { mutateStock } = await import("./inventoryService");
  for (const item of items) {
    try {
      await mutateStock({
        productId: item.product.toString(),
        variationId: await resolveVariationId(item),
        quantity: +item.quantity,
        type: "RETURN",
        referenceType: "RETURN",
        referenceId: orderId,
        orderItemId: item._id.toString(),
        performedByRole: "SYSTEM",
        note: "Order item cancellation stock restore",
      });
    } catch (error: any) {
      console.warn(`[PartCancel] Stock restore failed for item ${item._id}: ${error?.message}`);
    }
  }
}

/**
 * Settles the cancellation of `itemIds` of an order. Idempotent: items already settled, delivered
 * or returned are ignored, so callers (seller reject, carrier webhook, orchestrator) may overlap.
 */
export async function settleCancelledOrderItems(
  orderId: string,
  itemIds: string[],
  options: { reason?: string } = {},
): Promise<OrderPartCancellationResult> {
  const reason = options.reason || "Part of the order was cancelled";
  const requested = new Set((itemIds || []).map((id) => String(id)));
  const none = (message: string): OrderPartCancellationResult => ({
    success: true, mode: "none", settledItemIds: [], refunded: 0, codReduced: 0, orderCompleted: false, message,
  });
  if (requested.size === 0) return none("No items to settle");

  // Stock first (idempotent per item): a retried/failed transaction can never lose stock.
  const preItems = await OrderItem.find({ order: orderId, _id: { $in: [...requested] } });
  const preTargets = preItems.filter(
    (i: any) => !i.cancellationSettledAt && !NOT_CANCELLABLE_ITEM_STATUSES.includes(String(i.status)),
  );
  if (preTargets.length === 0) return none("Items already settled, delivered or returned");
  await restoreStock(orderId, preTargets);

  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order: any = await Order.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      const allItems: any[] = await OrderItem.find({ order: order._id }).session(session);
      const targets = allItems.filter(
        (i) =>
          requested.has(String(i._id)) &&
          !i.cancellationSettledAt &&
          !NOT_CANCELLABLE_ITEM_STATUSES.includes(String(i.status)),
      );
      if (targets.length === 0) {
        await session.abortTransaction();
        return none("Items already settled, delivered or returned");
      }
      const targetIds = new Set(targets.map((i) => String(i._id)));
      const isActive = (i: any) => !targetIds.has(String(i._id)) && !FINAL_ITEM_STATUSES.includes(String(i.status));
      const remainingActive = allItems.filter(isActive);
      const fullMode = remainingActive.length === 0;
      // Was a quick-commerce part deliverable before this call, and is one still left after it?
      const qcActiveBefore = allItems.some(
        (i) => isQcItem(i) && (targetIds.has(String(i._id)) || !FINAL_ITEM_STATUSES.includes(String(i.status))),
      );
      const qcActiveAfter = remainingActive.some((i) => isQcItem(i));

      // ── Value of the cancelled part (what the customer no longer owes) ──────────────
      let itemsValue = 0;
      for (const item of targets) {
        itemsValue += calculateItemRefundAmount(item, item.quantity, order.subtotal || 0, order.discount || 0).customerRefundAmount;
      }

      let shippingValue = 0;
      const groups: any[] = Array.isArray(order.fulfillmentGroups) ? order.fulfillmentGroups : [];
      const itemById = new Map(allItems.map((i) => [String(i._id), i]));
      for (const group of groups) {
        const groupItemIds: string[] = (group.items || []).map((id: any) => String(id));
        if (groupItemIds.length === 0 || group.status === "Delivered") continue;
        const touched = groupItemIds.some((id) => targetIds.has(id));
        const deliverableLeft = groupItemIds.some((id) => {
          const it = itemById.get(id);
          return it && isActive(it);
        });
        if (!touched || deliverableLeft) continue;
        // Counted exactly once: only the call that settles the group's last unsettled item gets
        // here (its status may already be Cancelled by the carrier flow; the fee is still owed back).
        shippingValue += Number(group.shippingFee || 0);
        const isCourier = group.fulfillmentType === "COURIER_SHIPPING" || group.fulfillmentType === "THIRD_PARTY_API";
        // A booked courier shipment is closed by the carrier flow (cancel API / webhook), never here.
        if (!isCourier || !group.thirdPartyOrderDetails?.externalOrderId) group.status = "Cancelled";
      }

      const tip = Math.max(0, Number(order.tipAmount) || 0);
      const tipValue = tip > 0 && !order.tipCreditedAt && qcActiveBefore && !qcActiveAfter ? tip : 0;
      const partValue = round2(itemsValue + shippingValue + tipValue);

      // ── Money ────────────────────────────────────────────────────────────────────────
      const isCod = String(order.paymentMethod || "").toUpperCase() === "COD";
      const paidWallet = round2(order.walletAmountUsed || 0);
      const paidOnline = order.paymentStatus === "Paid" || order.paymentStatus === "Refunded"
        ? round2(order.onlineAmountPaid || 0)
        : 0;
      const completedRefunds = await Refund.find({ order: order._id, status: "Completed" }).session(session);
      const alreadyRefunded = round2(completedRefunds.reduce((s: number, r: any) => s + (r.amount || 0), 0));
      // A full cancellation via the legacy path refunds 100% and sets Refunded without a Refund doc.
      const fullyRefundedAlready = order.paymentStatus === "Refunded";
      const refundable = fullyRefundedAlready ? 0 : Math.max(0, round2(paidWallet + paidOnline - alreadyRefunded));

      let codReduced = 0;
      let refundAmount = 0;
      const codPending = round2(order.codAmountPending || 0);
      if (fullMode) {
        codReduced = codPending;
        refundAmount = refundable;
      } else if (isCod) {
        codReduced = round2(Math.min(partValue, codPending));
        refundAmount = round2(Math.min(Math.max(0, partValue - codReduced), refundable));
      } else {
        refundAmount = round2(Math.min(partValue, refundable));
      }
      if (codReduced > 0) order.codAmountPending = round2(codPending - codReduced);

      const batchKey = crypto.createHash("sha256").update([...targetIds].sort().join(",")).digest("hex").slice(0, 12);
      let gatewayRefunded = 0;
      let paymentDoc: any = null;
      if (refundAmount > 0) {
        if (!order.customer) throw new Error("Cannot refund: order has no customer");
        paymentDoc = paidOnline > 0
          ? await Payment.findOne({ $or: [{ order: order._id }, ...(order.paymentId ? [{ razorpayPaymentId: order.paymentId }] : [])] }).session(session)
          : null;
        const priorOnline = round2(paymentDoc?.refundAmount || 0);
        const priorWallet = Math.max(0, round2(alreadyRefunded - priorOnline));
        const walletPortion = round2(Math.min(Math.max(0, paidWallet - priorWallet), refundAmount));
        const onlinePortion = round2(refundAmount - walletPortion);

        if (walletPortion > 0) {
          const res = await creditWallet(
            order.customer.toString(), "CUSTOMER", walletPortion,
            `Refund for cancelled items of order #${order.orderNumber}`,
            order._id.toString(), undefined, session, `PART_CANCEL_WALLET_${order._id}_${batchKey}`, "ORDER_CANCELLATION_REFUND",
          );
          if (!res.success) throw new Error(`Wallet refund failed: ${res.message}`);
        }
        if (onlinePortion > 0 && paymentDoc?.razorpayPaymentId) {
          const gatewayRefundable = Math.max(0, round2((paymentDoc.amount || paidOnline) - priorOnline));
          const amount = round2(Math.min(onlinePortion, gatewayRefundable));
          if (amount > 0) {
            const res = await processRefund(
              paymentDoc._id.toString(), amount, reason, session, `PART_CANCEL_${order._id}_${batchKey}`,
            );
            if (res.success) gatewayRefunded = amount;
            else console.warn(`[PartCancel] Gateway refund not completed (${res.message}); crediting wallet instead`);
          }
        }
        const walletRemainder = round2(onlinePortion - gatewayRefunded);
        if (walletRemainder > 0) {
          const res = await creditWallet(
            order.customer.toString(), "CUSTOMER", walletRemainder,
            `Refund for cancelled items of order #${order.orderNumber}`,
            order._id.toString(), undefined, session, `PART_CANCEL_WALLET_REM_${order._id}_${batchKey}`, "ORDER_CANCELLATION_REFUND",
          );
          if (!res.success) throw new Error(`Wallet refund failed: ${res.message}`);
        }
        await new Refund({
          order: order._id,
          customer: order.customer,
          amount: refundAmount,
          reason,
          status: "Completed",
          paymentMethod: order.paymentMethod,
          ...(paymentDoc ? { payment: paymentDoc._id } : {}),
        }).save({ session });
        if (round2(alreadyRefunded + refundAmount) >= round2(paidWallet + paidOnline)) order.paymentStatus = "Refunded";
      }

      // ── Items, commissions ───────────────────────────────────────────────────────────
      const now = new Date();
      await OrderItem.updateMany(
        { _id: { $in: [...targetIds] } },
        { $set: { status: "Cancelled", cancellationSettledAt: now } },
        { session },
      );
      await Commission.updateMany(
        { order: order._id, orderItem: { $in: [...targetIds] }, type: "SELLER", status: "Pending" },
        { $set: { status: "Cancelled" } },
        { session },
      );

      // ── Order status ─────────────────────────────────────────────────────────────────
      const wasCancelled = order.status === "Cancelled";
      let orderCompleted = false;
      if (fullMode) {
        order.status = "Cancelled";
        order.cancellationReason = order.cancellationReason || reason;
        order.cancelledAt = order.cancelledAt || now;
        order.codAmountPending = 0;
        for (const group of groups) {
          const isCourier = group.fulfillmentType === "COURIER_SHIPPING" || group.fulfillmentType === "THIRD_PARTY_API";
          if (group.status !== "Delivered" && (!isCourier || !group.thirdPartyOrderDetails?.externalOrderId)) group.status = "Cancelled";
        }
      } else if (
        order.status !== "Delivered" &&
        groups.length > 0 &&
        areAllFulfillmentGroupsDelivered(groups)
      ) {
        // Everything still deliverable was already delivered: the order is complete.
        order.status = "Delivered";
        order.deliveredAt = order.deliveredAt || now;
        orderCompleted = true;
      }
      order.markModified("fulfillmentGroups");
      await order.save({ session });
      await session.commitTransaction();

      // ── After commit (best effort, all idempotent) ───────────────────────────────────
      const refunded = refundAmount;
      if (refunded > 0) {
        import("./orderEmailService").then(({ sendCustomerRefundEmail }) =>
          sendCustomerRefundEmail(order._id.toString(), {
            amount: refunded,
            reason,
            method: gatewayRefunded > 0 ? "Original Payment Method" : "Olovely Wallet",
            status: "Completed",
          }),
        ).catch((err) => console.error("[PartCancel] Refund email error:", err));
      }
      if (fullMode && !wasCancelled) {
        if (order.firstOrderFreeShippingApplied && order.customer) {
          try {
            const { releaseFirstOrderFreeShippingClaim } = await import("./shipping/shippingPromotionService");
            await releaseFirstOrderFreeShippingClaim(order.customer);
          } catch (e) {
            console.error("[PartCancel] Free-shipping claim release failed:", e);
          }
        }
        if (order.customer) {
          import("./notificationService").then(({ sendOrderStatusNotification }) =>
            sendOrderStatusNotification(order._id.toString(), order.customer.toString(), "Cancelled"),
          ).catch((e) => console.error("[PartCancel] Cancellation notification error:", e));
        }
      }
      if (orderCompleted) {
        try {
          const { recordDeliveryFinancials } = await import("./commissionService");
          await recordDeliveryFinancials(order._id.toString());
        } catch (e) {
          console.error("[PartCancel] Delivery financials after completion failed:", e);
        }
      }

      console.log(
        `[PartCancel] Order ${order.orderNumber}: settled ${targets.length} item(s) (${fullMode ? "full" : "partial"}); ` +
        `value ₹${partValue}, refunded ₹${refunded}, COD reduced ₹${codReduced}${orderCompleted ? ", order completed" : ""}`,
      );
      return {
        success: true,
        mode: fullMode ? "full" : "partial",
        settledItemIds: [...targetIds],
        refunded,
        codReduced,
        orderCompleted,
        message: fullMode ? "Order fully cancelled and settled" : "Cancelled items settled",
      };
    } catch (error: any) {
      if (session.inTransaction()) await session.abortTransaction();
      if (isWriteConflict(error) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 150 * attempt));
        continue;
      }
      console.error(`[PartCancel] Settlement failed for order ${orderId}:`, error);
      return {
        success: false, mode: "none", settledItemIds: [], refunded: 0, codReduced: 0, orderCompleted: false,
        message: error?.message || "Cancelled item settlement failed",
      };
    } finally {
      session.endSession();
    }
  }
  return {
    success: false, mode: "none", settledItemIds: [], refunded: 0, codReduced: 0, orderCompleted: false,
    message: "Cancelled item settlement failed after repeated write conflicts",
  };
}
