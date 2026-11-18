/**
 * B-4 / R-04: Shiprocket (courier) COD settlement.
 *
 *  1. Courier part of a COD order delivered  → recordCourierCodPending():
 *       - Pending seller commissions (settlementChannel COURIER_COD) for the courier items
 *       - one CourierCodSettlement (PENDING_REMITTANCE) with the cash Shiprocket now holds
 *     Nothing is credited to anyone. "Delivered" is not proof that money was received.
 *
 *  2. Admin verifies a Shiprocket remittance (UTR, date, orders, charges) → verifyCourierCodRemittance():
 *       - amounts must reconcile: Σ order COD − courier charges = amount received
 *       - remittance reference is unique (no double recording)
 *       - each settlement is claimed atomically PENDING_REMITTANCE → REMITTED
 *       - the orders' COURIER_COD seller commissions are settled through the escrow core
 *         (OnHold until the return window ends, then withdrawable)
 *     Orders not in the batch stay pending (batches may be partial).
 *
 *  Courier charges deducted by Shiprocket are borne by the platform (decision 2026-11-12):
 *  they reduce platform earnings, never seller payable.
 */
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Commission from "../models/Commission";
import CourierCodSettlement from "../models/CourierCodSettlement";
import CourierCodRemittance from "../models/CourierCodRemittance";
import { round2 } from "./financeMath";
import { ensureSellerCommissions, isQcItem, settleSellerCommissions, commissionNet } from "./sellerSettlementService";

const isCod = (order: any) => String(order?.paymentMethod || "").toUpperCase() === "COD";

const isCourierGroup = (g: any) => g?.fulfillmentType === "COURIER_SHIPPING" || g?.fulfillmentType === "THIRD_PARTY_API";

/**
 * Cash the rider collects for the QC part (same rule as the rider app), 0 if none.
 * Mixed orders (decision 2026-11-18, option c): QC items + QC shipping + the tip.
 */
const riderCodShare = async (order: any): Promise<number> => {
  const groups: any[] = Array.isArray(order.fulfillmentGroups) ? order.fulfillmentGroups : [];
  const qcGroups = groups.filter((g) => g.fulfillmentType === "LOCAL_DELIVERY");
  const qcGroup = qcGroups[0];
  const hasQcItems = (order.items || []).some((i: any) => isQcItem(i));
  if (!hasQcItems) return 0;
  const fullPending = Number(order.codAmountPending ?? order.total ?? 0);
  const riderId = qcGroup?.deliveryBoy?.toString() || order.deliveryBoy?.toString();
  if (riderId) {
    const { getDeliveryPartnerQcContext } = await import("../modules/delivery/utils/deliveryOrderScopingHelper");
    const ctx = getDeliveryPartnerQcContext(order, riderId);
    if (ctx.isAuthorized) return round2(Math.min(ctx.assignedQcCodAmount, fullPending));
  }
  // No rider yet (e.g. at courier booking time): same rule as the rider app will apply.
  if (qcGroups.length > 0) {
    const qcTotal = qcGroups.reduce((s, g) => s + Number(g.subtotal || 0) + Number(g.shippingFee || 0), 0);
    const tip = Math.max(0, Number(order.tipAmount) || 0);
    return round2(Math.min(qcTotal + tip, fullPending));
  }
  return 0;
};

/**
 * Courier share of the COD cash = everything the rider does not collect: courier items +
 * courier shipping + the platform fee, minus coupon and wallet reductions.
 */
export const computeCourierCodAmount = async (order: any): Promise<number> => {
  const fullPending = Number(order.codAmountPending ?? order.total ?? 0);
  return Math.max(0, round2(fullPending - (await riderCodShare(order))));
};

/**
 * Exact cash each courier shipment must collect, so Shiprocket is told the same amount the
 * platform expects it to remit. The courier share is split across ALL courier groups by value
 * (items + shipping); a cancelled group's share is never collected (its refund/adjustment is
 * handled by partial cancellation). Returns groupId -> amount for non-cancelled courier groups.
 * `order.items` must be populated (product types decide the rider share).
 */
export const computeCourierGroupCodAmounts = async (order: any): Promise<Map<string, number>> => {
  const amounts = new Map<string, number>();
  if (!isCod(order)) return amounts;
  const courierGroups: any[] = (order.fulfillmentGroups || []).filter(isCourierGroup);
  if (courierGroups.length === 0) return amounts;

  const courierTotal = await computeCourierCodAmount(order);
  const weightOf = (g: any) => Math.max(0, Number(g.subtotal || 0) + Number(g.shippingFee || 0));
  const totalWeight = courierGroups.reduce((s, g) => s + weightOf(g), 0);
  const shareOf = (g: any) =>
    totalWeight > 0 ? (courierTotal * weightOf(g)) / totalWeight : courierTotal / courierGroups.length;

  const active = courierGroups.filter((g) => g.status !== "Cancelled");
  const activeTotal = round2(active.reduce((s, g) => s + shareOf(g), 0));
  let allocated = 0;
  active.forEach((g, index) => {
    const amount = index === active.length - 1 ? round2(activeTotal - allocated) : round2(shareOf(g));
    allocated = round2(allocated + amount);
    amounts.set(String(g.groupId), Math.max(0, amount));
  });
  return amounts;
};

const pushHistory = (action: string, by?: string, note?: string) => ({
  $push: {
    history: {
      action,
      at: new Date(),
      ...(by ? { by: new mongoose.Types.ObjectId(by) } : {}),
      ...(note ? { note } : {}),
    },
  },
});

/** Step 1 (idempotent). Safe to call from webhook, admin status change, or a retry. */
export const recordCourierCodPending = async (
  orderId: string,
  session?: mongoose.ClientSession,
): Promise<{ created: boolean; settlementId?: string; codAmount?: number }> => {
  const order = await Order.findById(orderId).populate("items").session(session || null);
  if (!order || !isCod(order)) return { created: false };
  const items: any[] = (order.items as any[]) || [];
  const courierGroups: any[] = ((order as any).fulfillmentGroups || []).filter(isCourierGroup);
  // Items of cancelled courier shipments (seller-rejected, or cancelled at the carrier) were never
  // delivered by the courier: no cash for them and no seller payable.
  const cancelledGroupItemIds = new Set(
    courierGroups
      .filter((g) => g.status === "Cancelled")
      .flatMap((g) => (g.items || []).map((id: any) => String(id))),
  );
  const courierItems = items.filter(
    (i) => !isQcItem(i) && i.status !== "Cancelled" && !cancelledGroupItemIds.has(String(i._id)),
  );
  if (courierItems.length === 0) return { created: false };

  const existing = await CourierCodSettlement.findOne({ order: order._id }).session(session || null);
  if (existing) return { created: false, settlementId: existing._id.toString(), codAmount: existing.codAmount };

  const commissionIds = await ensureSellerCommissions(orderId, courierItems, "COURIER_COD", session);
  const comms = await Commission.find({ _id: { $in: commissionIds } }).session(session || null);
  const sellerPayable = round2(comms.reduce((s, c) => s + commissionNet(c), 0));
  // Exactly what the courier was told to collect for its non-cancelled shipments. The tip is
  // collected by the rider (decision 2026-11-18, option c), so none of this cash is a tip.
  // Orders without courier fulfillment groups (legacy shape) carry the whole courier share.
  const codAmount =
    courierGroups.length > 0
      ? round2([...(await computeCourierGroupCodAmounts(order)).values()].reduce((s, a) => s + a, 0))
      : await computeCourierCodAmount(order);
  const awbCodes = ((order as any).fulfillmentGroups || [])
    .filter((g: any) => isCourierGroup(g) && g.status !== "Cancelled")
    .map((g: any) => g.shippingDetails?.awbNumber || g.shippingDetails?.trackingNumber)
    .filter(Boolean);

  try {
    const [doc] = await CourierCodSettlement.create(
      [
        {
          order: order._id,
          orderNumber: order.orderNumber,
          provider: (order as any).shippingProvider || "SHIPROCKET",
          awbCodes,
          codAmount,
          sellerPayable,
          platformEarning: round2(codAmount - sellerPayable),
          sellerCommissions: commissionIds,
          status: "PENDING_REMITTANCE",
          deliveredAt: order.deliveredAt || new Date(),
          history: [{ action: "CREATED_PENDING_REMITTANCE", at: new Date(), note: `COD ₹${codAmount} with courier` }],
        },
      ],
      { session },
    );
    return { created: true, settlementId: doc._id.toString(), codAmount };
  } catch (e: any) {
    if (e?.code === 11000) return { created: false }; // concurrent creator (unique order)
    throw e;
  }
};

export interface VerifyRemittanceInput {
  provider?: string;
  reference: string;
  remittanceDate: Date | string;
  amountReceived: number;
  courierCharges?: number;
  orderIds: string[];
  notes?: string;
  adminId: string;
}

/** Step 2: admin-verified remittance. All-or-nothing per batch. */
export const verifyCourierCodRemittance = async (input: VerifyRemittanceInput) => {
  const reference = String(input.reference || "").trim();
  if (!reference) throw new Error("Remittance reference (UTR / Shiprocket remittance id) is required");
  const orderIds = Array.from(new Set((input.orderIds || []).map(String))).filter(Boolean);
  if (orderIds.length === 0) throw new Error("Select at least one order covered by this remittance");
  const amountReceived = round2(Number(input.amountReceived));
  const courierCharges = round2(Number(input.courierCharges || 0));
  if (!(amountReceived >= 0) || !(courierCharges >= 0)) throw new Error("Amounts must be non-negative numbers");
  const remittanceDate = new Date(input.remittanceDate);
  if (isNaN(remittanceDate.getTime())) throw new Error("Invalid remittance date");
  const provider = input.provider || "SHIPROCKET";

  const session = await mongoose.startSession();
  try {
    let output: any;
    await session.withTransaction(async () => {
      const settlements = await CourierCodSettlement.find({ order: { $in: orderIds } }).session(session);
      const missing = orderIds.filter((id) => !settlements.some((s) => s.order.toString() === id));
      if (missing.length) throw new Error(`No courier COD settlement for order(s): ${missing.join(", ")}`);
      const notPending = settlements.filter((s) => s.status !== "PENDING_REMITTANCE");
      if (notPending.length) {
        throw new Error(
          `Already ${notPending[0].status.toLowerCase()}: ${notPending.map((s) => s.orderNumber).join(", ")}`,
        );
      }
      const gross = round2(settlements.reduce((s, x) => s + x.codAmount, 0));
      if (Math.abs(round2(gross - courierCharges) - amountReceived) > 0.01) {
        throw new Error(
          `Amounts do not reconcile: orders' COD ₹${gross} − courier charges ₹${courierCharges} = ₹${round2(
            gross - courierCharges,
          )}, but amount received is ₹${amountReceived}`,
        );
      }

      const [remittance] = await CourierCodRemittance.create(
        [
          {
            provider,
            reference,
            remittanceDate,
            grossCodAmount: gross,
            courierCharges,
            amountReceived,
            lines: settlements.map((s) => ({ order: s.order, orderNumber: s.orderNumber, codAmount: s.codAmount })),
            verifiedBy: new mongoose.Types.ObjectId(input.adminId),
            notes: input.notes,
          },
        ],
        { session },
      );

      let sellerCredited = 0;
      let sellerHeld = 0;
      for (const s of settlements) {
        const claimed = await CourierCodSettlement.findOneAndUpdate(
          { _id: s._id, status: "PENDING_REMITTANCE" },
          {
            $set: {
              status: "REMITTED",
              remittance: remittance._id,
              remittedAmount: s.codAmount,
              remittedAt: remittanceDate,
              verifiedBy: new mongoose.Types.ObjectId(input.adminId),
            },
            ...pushHistory("REMITTANCE_VERIFIED", input.adminId, `Ref ${reference}`),
          },
          { session, new: true },
        );
        if (!claimed) throw new Error(`Order ${s.orderNumber} was settled concurrently; nothing was changed`);
        // Same marker the rider cash-collection flow sets: Olovely has received this COD cash
        await Order.updateOne(
          { _id: claimed.order, codPaidToAdminAt: null },
          { $set: { codPaidToAdminAt: remittanceDate } },
          { session },
        );

        const res = await settleSellerCommissions(claimed.sellerCommissions, {
          session,
          description: `Sale proceeds for COD order ${claimed.orderNumber} (courier remittance ${reference})`,
        });
        sellerCredited = round2(sellerCredited + res.creditedAmount);
        sellerHeld = round2(sellerHeld + res.heldAmount);
      }
      output = {
        remittanceId: remittance._id.toString(),
        orders: settlements.length,
        grossCodAmount: gross,
        courierCharges,
        amountReceived,
        sellerCreditedAvailable: sellerCredited,
        sellerHeldInEscrow: sellerHeld,
      };
    });
    return output;
  } catch (e: any) {
    if (e?.code === 11000) throw new Error(`Remittance ${reference} is already recorded`);
    throw e;
  } finally {
    await session.endSession();
  }
};

/** RTO / never-collected courier COD: closes the pending record and cancels its Pending commissions. */
export const cancelCourierCodSettlement = async (orderId: string, adminId: string | undefined, note: string) => {
  const session = await mongoose.startSession();
  try {
    let out: any = null;
    await session.withTransaction(async () => {
      const s = await CourierCodSettlement.findOneAndUpdate(
        { order: orderId, status: "PENDING_REMITTANCE" },
        { $set: { status: "CANCELLED" }, ...pushHistory("CANCELLED", adminId, note) },
        { session, new: true },
      );
      if (!s) throw new Error("No pending courier COD settlement for this order");
      await Commission.updateMany(
        { _id: { $in: s.sellerCommissions }, status: "Pending" },
        { $set: { status: "Cancelled" } },
        { session },
      );
      out = s;
    });
    return out;
  } finally {
    await session.endSession();
  }
};

/** Admin finance view (B-4): collected / pending / received / seller payable / platform / charges. */
export const getCourierCodSummary = async () => {
  const byStatus = await CourierCodSettlement.aggregate([
    {
      $group: {
        _id: "$status",
        orders: { $sum: 1 },
        codAmount: { $sum: "$codAmount" },
        sellerPayable: { $sum: "$sellerPayable" },
        platformEarning: { $sum: "$platformEarning" },
      },
    },
  ]);
  const [rem] = await CourierCodRemittance.aggregate([
    {
      $group: {
        _id: null,
        batches: { $sum: 1 },
        gross: { $sum: "$grossCodAmount" },
        charges: { $sum: "$courierCharges" },
        received: { $sum: "$amountReceived" },
      },
    },
  ]);
  const pick = (st: string) => byStatus.find((b) => b._id === st) || { orders: 0, codAmount: 0, sellerPayable: 0, platformEarning: 0 };
  const pending = pick("PENDING_REMITTANCE");
  const remitted = pick("REMITTED");
  return {
    codCollectedByCourier: round2(pending.codAmount + remitted.codAmount),
    codPendingFromCourier: round2(pending.codAmount),
    pendingOrders: pending.orders,
    codRemittedGross: round2(rem?.gross || 0),
    amountReceived: round2(rem?.received || 0),
    courierCharges: round2(rem?.charges || 0),
    remittanceBatches: rem?.batches || 0,
    sellerPayablePending: round2(pending.sellerPayable),
    sellerPayableRemitted: round2(remitted.sellerPayable),
    // Platform bears courier charges (decision 2026-11-12)
    platformEarningRemitted: round2(remitted.platformEarning - (rem?.charges || 0)),
    platformEarningPending: round2(pending.platformEarning),
    cancelledOrders: pick("CANCELLED").orders,
  };
};

export const listCourierCodSettlements = async (status?: string, page = 1, limit = 50) => {
  const q: any = {};
  if (status) q.status = status;
  const [rows, total] = await Promise.all([
    CourierCodSettlement.find(q)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("remittance", "reference remittanceDate")
      .lean(),
    CourierCodSettlement.countDocuments(q),
  ]);
  return { rows, total, page, limit };
};

export const listCourierCodRemittances = async (page = 1, limit = 50) => {
  const [rows, total] = await Promise.all([
    CourierCodRemittance.find({}).sort({ remittanceDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CourierCodRemittance.countDocuments({}),
  ]);
  return { rows, total, page, limit };
};

/** Items of an order handled by the courier channel (helper for callers/tests). */
export const getCourierItems = async (orderId: string, session?: mongoose.ClientSession) =>
  (await OrderItem.find({ order: orderId }).session(session || null)).filter((i) => !isQcItem(i));
