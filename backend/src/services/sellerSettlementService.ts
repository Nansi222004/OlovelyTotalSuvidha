/**
 * Seller settlement core: the ONLY place where a seller commission moves out of Pending.
 *
 * B-5 (finalised 2026-11-12): a seller may not withdraw an item's earning until that item's
 * return window has expired. Every channel (prepaid, rider COD, courier COD, legacy COD) calls
 * settleSellerCommissions once the platform actually holds the customer's money:
 *
 *   window still open  → OnHold, Seller.onHoldBalance += net            (not withdrawable)
 *   window expired     → Paid,   ledger credit SALE_CREDIT_<commission>  (withdrawable)
 *
 * OnHold → Paid happens only in releaseExpiredEscrow, which also skips items with an open
 * return/exchange (R-05), so a return is always reversed out of escrow, never out of a
 * balance the seller may already have withdrawn.
 *
 * Idempotency: each commission is claimed atomically (findOneAndUpdate on its current status)
 * and every ledger row carries a unique reference, so concurrent or repeated calls credit once.
 */
import mongoose from "mongoose";
import Commission from "../models/Commission";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import Return from "../models/Return";
import { creditWallet } from "./walletManagementService";
import { itemSellerCommission, round2 } from "./financeMath";

export type SettlementChannel = "PREPAID" | "RIDER_COD" | "COURIER_COD" | "UNASSIGNED_COD";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RETURN_WINDOW_DAYS = 7;

/** Return/exchange statuses that are still unresolved (earnings must stay in escrow). */
export const OPEN_RETURN_STATUSES = [
  "Pending",
  "Approved",
  "Pickup Pending",
  "Delivery Partner Assigned",
  "Picked Up",
  "In Transit",
  "Handed To Seller",
  "QC Pending",
  "Reverse Shipment Created",
  "Replacement Ready",
  "Forward Shipment Created",
  "Replacement Shipped",
];

/** Quick-commerce (Olovely rider) item vs courier (Shiprocket) item. */
export const isQcItem = (item: any): boolean => {
  if (!item) return false;
  if (item.fulfillmentType === "COURIER_SHIPPING") return false;
  if (item.fulfillmentType === "LOCAL_DELIVERY") return true;
  return !item.productType || item.productType === "QUICK_COMMERCE";
};

export const computeReturnDeadline = (item: any, deliveredAt: Date): Date => {
  if (item?.returnDeadline) return new Date(item.returnDeadline);
  const days = Number.isFinite(Number(item?.returnWindowDays))
    ? Math.max(0, Number(item.returnWindowDays))
    : DEFAULT_RETURN_WINDOW_DAYS;
  return new Date(deliveredAt.getTime() + days * DAY_MS);
};

export const commissionNet = (comm: { orderAmount: number; commissionAmount: number }): number =>
  round2((Number(comm.orderAmount) || 0) - (Number(comm.commissionAmount) || 0));

const resolveRate = async (item: any): Promise<number> => {
  if (item && typeof item.commissionRate === "number" && Number.isFinite(item.commissionRate)) {
    return item.commissionRate;
  }
  const { getOrderItemCommissionRate } = await import("./commissionService");
  return getOrderItemCommissionRate(item.product.toString(), item.seller.toString());
};

const isDuplicateKey = (e: any) => e?.code === 11000 || /E11000/.test(String(e?.message || ""));

/**
 * Create Pending SELLER commission records for the given items, at most one per order item
 * (any status). Items already Cancelled/Returned get none. Returns the ids of the Pending
 * records for these items (new or pre-existing).
 */
export const ensureSellerCommissions = async (
  orderId: string,
  items: any[],
  channel: SettlementChannel,
  session?: mongoose.ClientSession,
): Promise<mongoose.Types.ObjectId[]> => {
  const ids: mongoose.Types.ObjectId[] = [];
  for (const item of items) {
    if (!item || ["Cancelled", "Returned"].includes(String(item.status))) continue;
    const existing = await Commission.findOne({ orderItem: item._id, type: "SELLER" }).session(session || null);
    if (existing) {
      if (existing.status === "Pending") {
        if (!existing.settlementChannel) {
          existing.settlementChannel = channel;
          await existing.save({ session });
        }
        ids.push(existing._id as any);
      }
      continue;
    }
    const rate = await resolveRate(item);
    try {
      const [created] = await Commission.create(
        [
          {
            order: orderId,
            orderItem: item._id,
            seller: item.seller,
            type: "SELLER",
            orderAmount: item.total,
            commissionRate: rate,
            commissionAmount: itemSellerCommission(item, rate),
            status: "Pending",
            settlementChannel: channel,
          },
        ],
        { session },
      );
      ids.push(created._id as any);
    } catch (e: any) {
      // R-07: a concurrent creator won the unique (orderItem, type) index → reuse its record
      if (!isDuplicateKey(e)) throw e;
      const winner = await Commission.findOne({ orderItem: item._id, type: "SELLER" }).session(session || null);
      if (winner && winner.status === "Pending") ids.push(winner._id as any);
    }
  }
  return ids;
};

export interface SettlementResult {
  held: number;
  credited: number;
  heldAmount: number;
  creditedAmount: number;
  skipped: number;
}

/**
 * Move Pending seller commissions to OnHold / Paid (see file header). The money for these
 * commissions must already be with the platform when this is called.
 */
export const settleSellerCommissions = async (
  commissionIds: Array<mongoose.Types.ObjectId | string>,
  options: { session?: mongoose.ClientSession; deliveredAt?: Date; description?: string } = {},
): Promise<SettlementResult> => {
  const { session } = options;
  const result: SettlementResult = { held: 0, credited: 0, heldAmount: 0, creditedAmount: 0, skipped: 0 };
  const now = new Date();

  for (const id of commissionIds) {
    const comm = await Commission.findOne({ _id: id, type: "SELLER", status: "Pending" }).session(session || null);
    if (!comm || !comm.seller) {
      result.skipped++;
      continue;
    }
    const order = await Order.findById(comm.order).select("orderNumber deliveredAt").session(session || null);
    const deliveredAt = options.deliveredAt || order?.deliveredAt || now;

    let deadline = new Date(deliveredAt.getTime() + DEFAULT_RETURN_WINDOW_DAYS * DAY_MS);
    if (comm.orderItem) {
      const item = await OrderItem.findById(comm.orderItem).session(session || null);
      if (item) {
        deadline = computeReturnDeadline(item, deliveredAt);
        if (!item.returnDeadline) {
          item.returnDeadline = deadline;
          await item.save({ session });
        }
      }
    }

    const hold = deadline.getTime() > now.getTime();
    const claimed = await Commission.findOneAndUpdate(
      { _id: comm._id, status: "Pending" },
      hold
        ? { $set: { status: "OnHold", onHoldUntil: deadline } }
        : { $set: { status: "Paid", paidAt: now } },
      { session, new: true },
    );
    if (!claimed) {
      result.skipped++;
      continue;
    }

    const net = commissionNet(claimed);
    const sellerId = claimed.seller!.toString();
    if (net <= 0) continue;

    if (hold) {
      await Seller.findByIdAndUpdate(sellerId, { $inc: { onHoldBalance: net } }, { session });
      result.held++;
      result.heldAmount = round2(result.heldAmount + net);
    } else {
      const res = await creditWallet(
        sellerId,
        "SELLER",
        net,
        options.description || `Sale proceeds for order ${order?.orderNumber || claimed.order}`,
        claimed.order.toString(),
        claimed._id.toString(),
        session,
        `SALE_CREDIT_${claimed._id.toString()}`,
      );
      if (!res.success) throw new Error(`Seller credit failed for commission ${claimed._id}: ${res.message}`);
      result.credited++;
      result.creditedAmount = round2(result.creditedAmount + net);
    }
  }
  return result;
};

/** True when the commission's item has a return/exchange that is not resolved yet. */
export const hasOpenReturn = async (comm: any, session?: mongoose.ClientSession): Promise<boolean> => {
  if (!comm?.orderItem) return false;
  const open = await Return.exists({ orderItem: comm.orderItem, status: { $in: OPEN_RETURN_STATUSES } }).session(
    session || null,
  );
  return !!open;
};

/**
 * B-1: credit 100% of the customer's tip to the rider who delivered the order's
 * quick-commerce part. Exactly once per order (atomic claim on Order.tipCreditedAt plus the
 * unique ledger reference TIP_<orderId>). Never counted as platform or seller money.
 */
export const creditOrderTip = async (
  orderId: string,
  riderId: string | undefined,
  session?: mongoose.ClientSession,
): Promise<number> => {
  if (!riderId) return 0;
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, tipAmount: { $gt: 0 }, tipCreditedAt: null },
    { $set: { tipCreditedAt: new Date(), tipCreditedTo: new mongoose.Types.ObjectId(riderId) } },
    { session, new: true },
  );
  if (!claimed) return 0;
  const tip = round2(claimed.tipAmount || 0);
  const res = await creditWallet(
    riderId,
    "DELIVERY_BOY",
    tip,
    `Customer tip for order ${claimed.orderNumber}`,
    orderId,
    undefined,
    session,
    `TIP_${orderId}`,
  );
  if (!res.success) throw new Error(`Tip credit failed for order ${orderId}: ${res.message}`);
  return tip;
};

/** Rider who delivered the quick-commerce part of an order (group rider first). */
export const resolveQcRiderId = (order: any): string | undefined => {
  const groups: any[] = Array.isArray(order?.fulfillmentGroups) ? order.fulfillmentGroups : [];
  const qc = groups.find((g) => g.fulfillmentType === "LOCAL_DELIVERY" && g.deliveryBoy);
  const id = qc?.deliveryBoy || order?.deliveryBoy;
  return id ? id.toString() : undefined;
};

/**
 * R-12: earning breakdown for ONE seller on an order, built only from that seller's own items
 * and commission records. Never exposes other sellers' commissions, the rider's share or
 * order-level platform totals.
 */
export const buildSellerOrderEarning = async (orderId: string, sellerId: string) => {
  const order = await Order.findById(orderId).select("orderNumber paymentMethod");
  const items = await OrderItem.find({ order: orderId, seller: sellerId });
  const comms = await Commission.find({ order: orderId, seller: sellerId, type: "SELLER" });
  const byItem = new Map(comms.map((c) => [String(c.orderItem), c]));
  const { itemIncludedGst, itemTaxableValue } = await import("./financeMath");

  let itemsTotal = 0;
  let gstIncluded = 0;
  let taxableValue = 0;
  let commission = 0;
  let earning = 0;
  const status = { pending: 0, onHold: 0, paid: 0, cancelled: 0 };
  let holdUntil: Date | undefined;

  for (const item of items) {
    const c: any = byItem.get(String(item._id));
    if (c) {
      const net = commissionNet(c);
      if (c.status === "Cancelled") {
        status.cancelled = round2(status.cancelled + net);
        continue;
      }
      itemsTotal += c.orderAmount;
      gstIncluded += itemIncludedGst({ ...item.toObject(), total: c.orderAmount } as any);
      taxableValue += itemTaxableValue({ ...item.toObject(), total: c.orderAmount } as any);
      commission += c.commissionAmount;
      earning += net;
      if (c.status === "Pending") status.pending = round2(status.pending + net);
      if (c.status === "OnHold") {
        status.onHold = round2(status.onHold + net);
        if (c.onHoldUntil && (!holdUntil || c.onHoldUntil > holdUntil)) holdUntil = c.onHoldUntil;
      }
      if (c.status === "Paid") status.paid = round2(status.paid + net);
    } else if (!["Cancelled", "Returned"].includes(String(item.status))) {
      const rate = await resolveRate(item);
      const itemComm = itemSellerCommission(item as any, rate);
      itemsTotal += item.total;
      gstIncluded += itemIncludedGst(item as any);
      taxableValue += itemTaxableValue(item as any);
      commission += itemComm;
      earning += item.total - itemComm;
      status.pending = round2(status.pending + item.total - itemComm);
    }
  }

  return {
    orderId,
    orderNumber: order?.orderNumber,
    paymentMethod: order?.paymentMethod,
    yourItemsTotal: round2(itemsTotal),
    gstIncluded: round2(gstIncluded),
    taxableValue: round2(taxableValue),
    yourCommission: round2(commission),
    yourEarning: round2(earning),
    settlement: { ...status, holdUntil },
    // Backward-compatible keys for older clients — now scoped to THIS seller only
    adminProductCommission: round2(commission),
    totalAdminEarning: round2(commission),
    note: "Commission is charged on the taxable value (excluding GST) of your items. You keep the GST and remit it.",
  };
};
