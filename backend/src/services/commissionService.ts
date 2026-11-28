import Commission from "../models/Commission";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import AppSettings from "../models/AppSettings";
import { creditWallet } from "./walletManagementService";
import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";
import WalletTransaction from "../models/WalletTransaction";
import { itemSellerCommission } from "./financeMath";
import { computeDistanceRiderPay, effectiveRiderKmRate } from "./riderPayService";
import { ensureSellerCommissions, settleSellerCommissions, creditOrderTip, resolveQcRiderId, isQcItem, hasOpenReturn } from "./sellerSettlementService";

/**
 * Get the effective commission rate for a product/item
 * New Priority: Seller's categoryCommissions[headerCategoryId] → 0 (no commission)
 */
export const getOrderItemCommissionRate = async (
  productIdOrProduct: string | any,
  sellerId?: string,
  _settings?: any,
): Promise<number> => {
  try {
    // If productIdOrProduct is already an object (product), use it
    let product;
    if (
      typeof productIdOrProduct === "object" &&
      productIdOrProduct !== null &&
      productIdOrProduct._id
    ) {
      product = productIdOrProduct;
    } else {
      product = await Product.findById(productIdOrProduct);
    }

    if (!product) return 0; // No product = no commission

    const finalSellerId = sellerId || product.seller.toString();

    // Find the product's headerCategoryId
    let headerCategoryId = product.headerCategoryId;

    // If product doesn't have headerCategoryId directly, look it up from Category
    if (!headerCategoryId && product.category) {
      const cat =
        typeof product.category === "object" && product.category !== null
          ? product.category
          : await Category.findById(product.category);
      if (cat?.headerCategoryId) {
        headerCategoryId = cat.headerCategoryId;
      }
    }

    // Fetch settings if not provided
    const settings = _settings || (await AppSettings.getSettings());
    const globalRate = settings?.globalCommissionRate ?? 10;

    const seller = await Seller.findById(finalSellerId);

    // Level 1: Category Commission
    if (headerCategoryId && seller && seller.categoryCommissions && seller.categoryCommissions.length > 0) {
      const headerCatIdStr = headerCategoryId.toString();
      const entry = seller.categoryCommissions.find(
        (cc: any) => cc.headerCategory.toString() === headerCatIdStr,
      );

      if (entry && entry.commissionRate > 0) {
        return entry.commissionRate;
      }
    }

    // Level 2: Seller Profile Commission Rate
    if (seller && typeof seller.commissionRate === "number" && seller.commissionRate > 0) {
      return seller.commissionRate;
    }

    // Level 3: Global AppSettings Commission Rate Default
    return globalRate;
  } catch (error) {
    console.error("Error calculating commission rate:", error);
    return 10; // Default fallback on error
  }
};

/**
 * Get commission rate for a delivery boy
 */
export const getDeliveryBoyCommissionRate = async (
  deliveryBoyId: string,
): Promise<number> => {
  try {
    const deliveryBoy = await Delivery.findById(deliveryBoyId);
    if (!deliveryBoy) {
      throw new Error("Delivery boy not found");
    }

    // Use individual rate if set, otherwise use global default
    if (
      deliveryBoy.commissionRate !== undefined &&
      deliveryBoy.commissionRate !== null
    ) {
      return deliveryBoy.commissionRate;
    }

    return 5; // Default 5%
  } catch (error) {
    console.error("Error getting delivery boy commission rate:", error);
    return 5; // Default fallback
  }
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Commission rate for an order item. The rate snapshotted on the OrderItem at checkout is
 * authoritative so that later rule changes never rewrite historical orders. `??` (not `||`)
 * so that a legitimate 0% snapshot is respected. Falls back to the live rule only for
 * legacy items without a snapshot.
 */
export const resolveItemCommissionRate = async (item: any): Promise<number> => {
  if (item && typeof item.commissionRate === "number" && Number.isFinite(item.commissionRate)) {
    return item.commissionRate;
  }
  return getOrderItemCommissionRate(item.product.toString(), item.seller.toString());
};

/**
 * B-7 (finalised 2026-11-12): Olovely has NO seller self-delivery. Delivery is either an Olovely
 * rider (quick commerce) or Shiprocket (courier). The former "self-delivery fee" (delivery charge
 * credited to sellers when no rider delivered) is removed: the customer's delivery charge is
 * platform income, out of which the rider's earning is paid.
 */

/**
 * Rider earning for the quick-commerce part of an order:
 * distance mode → base pay + km beyond the partner's base distance × deliveryBoyKmRate
 * (see riderPayService); otherwise rate% × QC-scoped subtotal.
 */
export const computeRiderCommission = async (
  order: any,
  riderId: string,
  session?: mongoose.ClientSession,
): Promise<{ amount: number; rate: number; base: number; usedDistance: boolean }> => {
  try {
    // @ts-ignore
    const settings = await AppSettings.getSettings();
    const distancePay = computeDistanceRiderPay(settings?.deliveryConfig, order.deliveryDistanceKm);
    if (distancePay !== null) {
      return {
        amount: distancePay,
        rate: effectiveRiderKmRate(distancePay, order.deliveryDistanceKm),
        base: order.deliveryDistanceKm,
        usedDistance: true,
      };
    }
  } catch (err) {
    console.error("Error reading delivery settings for rider commission:", err);
  }
  let base = Number(order.subtotal || 0);
  try {
    const { getDeliveryPartnerQcContext } = await import("../modules/delivery/utils/deliveryOrderScopingHelper");
    const populated = await Order.findById(order._id).populate("items").session(session || null);
    const qcCtx = getDeliveryPartnerQcContext(populated, riderId);
    if (qcCtx.isAuthorized && qcCtx.hasQcItems && !qcCtx.isEcommerceOnly) base = qcCtx.assignedQcSubtotal;
  } catch (scopeErr) {
    console.error("Rider QC scoping failed; using order subtotal:", scopeErr);
  }
  const rate = await getDeliveryBoyCommissionRate(riderId);
  return { amount: round2((base * rate) / 100), rate, base, usedDistance: false };
};

/**
 * Create (once) the rider's Paid DELIVERY_BOY commission for a prepaid order and credit it.
 * Ledger reference RIDER_EARNING_<orderId> makes the credit idempotent.
 */
const ensureRiderCommissionPaid = async (order: any, riderId: string, session: mongoose.ClientSession) => {
  const orderId = order._id.toString();
  let comm = await Commission.findOne({ order: order._id, type: "DELIVERY_BOY" }).session(session);
  if (!comm) {
    const calc = await computeRiderCommission(order, riderId, session);
    [comm] = await Commission.create(
      [
        {
          order: order._id,
          deliveryBoy: riderId,
          type: "DELIVERY_BOY",
          orderAmount: calc.base,
          commissionRate: calc.rate,
          commissionAmount: calc.amount,
          status: "Paid",
          paidAt: new Date(),
        },
      ],
      { session },
    );
  } else if (comm.status === "Pending") {
    comm.status = "Paid";
    comm.paidAt = new Date();
    await comm.save({ session });
  } else if (comm.status !== "Paid") {
    return comm;
  }
  if (comm.commissionAmount > 0) {
    const res = await creditWallet(
      (comm.deliveryBoy || riderId).toString(),
      "DELIVERY_BOY",
      comm.commissionAmount,
      `Delivery earning for order ${order.orderNumber}`,
      orderId,
      comm._id.toString(),
      session,
      `RIDER_EARNING_${orderId}`,
    );
    if (!res.success) throw new Error(`Rider credit failed for order ${order.orderNumber}: ${res.message}`);
  }
  return comm;
};

/**
 * Prepaid (Online / Wallet) orders: create Pending seller commissions if missing (Razorpay capture
 * normally creates them; 100% wallet orders never did), then settle through the escrow core.
 */
export const createPendingCommissions = async (orderId: string, session?: mongoose.ClientSession) => {
  const order = await Order.findById(orderId).session(session || null);
  if (!order) throw new Error("Order not found");
  if (String(order.paymentMethod || "").toUpperCase() === "COD") return; // COD has its own channels
  const items = await OrderItem.find({ order: orderId }).session(session || null);
  await ensureSellerCommissions(orderId, items, "PREPAID", session);
};

/**
 * Single entry point when an order reaches Delivered (admin, seller, rider, Shiprocket webhook).
 * Idempotent: safe to call more than once for the same order.
 */
export const distributeCommissions = async (orderId: string) => {
  const order = await Order.findById(orderId);
  if (!order) return { success: false, message: "Order not found" };
  if (order.status !== "Delivered") {
    return { success: false, message: "Commissions can only be distributed for delivered orders" };
  }
  if (String(order.paymentMethod || "").toUpperCase() === "COD") {
    return handleCodOrderDelivered(orderId);
  }

  const session = await mongoose.startSession();
  try {
    let summary: any = null;
    await session.withTransaction(async () => {
      const fresh = await Order.findById(orderId).session(session);
      if (!fresh) throw new Error("Order not found");
      const deliveredAt = fresh.deliveredAt || new Date();
      if (!fresh.deliveredAt) {
        fresh.deliveredAt = deliveredAt;
        await fresh.save({ session });
      }

      const items = await OrderItem.find({ order: orderId }).session(session);
      const pendingIds = await ensureSellerCommissions(orderId, items, "PREPAID", session);
      const settled = await settleSellerCommissions(pendingIds, { session, deliveredAt });

      const riderId = items.some((i) => isQcItem(i)) ? resolveQcRiderId(fresh) : undefined;
      let tip = 0;
      if (riderId) {
        await ensureRiderCommissionPaid(fresh, riderId, session);
        tip = await creditOrderTip(orderId, riderId, session);
      }
      summary = { ...settled, riderId, tipCredited: tip };
    });
    const commissions = await Commission.find({ order: orderId });
    return { success: true, message: "Commissions distributed successfully", data: { commissions, summary } };
  } catch (error: any) {
    console.error("Error distributing commissions:", error);
    return { success: false, message: error.message || "Failed to distribute commissions" };
  } finally {
    await session.endSession();
  }
};

/**
 * COD order delivered. Money is NOT with the platform yet, so nothing is credited to sellers here:
 *  - QC part delivered by an Olovely rider → rider owes the cash (processCODOrderDelivery)
 *  - QC part with no rider (legacy self-delivered orders only) → Pending UNASSIGNED_COD,
 *    settled when an admin confirms the cash (settleUnassignedCod)
 *  - courier part → Pending COURIER_COD + CourierCodSettlement awaiting verified remittance
 */
export const handleCodOrderDelivered = async (orderId: string) => {
  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) return { success: false, message: "Order not found" };
    const items: any[] = (order.items as any[]) || [];
    const qcItems = items.filter((i) => isQcItem(i));
    const courierItems = items.filter((i) => !isQcItem(i));
    const out: any = {};

    if (qcItems.length > 0) {
      const riderId = resolveQcRiderId(order);
      if (riderId) {
        await processCODOrderDelivery(orderId, undefined, riderId);
        out.riderCod = "recorded";
      } else {
        await recordUnassignedCodPending(orderId);
        out.riderCod = "unassigned_pending_admin_confirmation";
      }
    }
    if (courierItems.length > 0) {
      const { recordCourierCodPending } = await import("./courierCodService");
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          out.courierCod = await recordCourierCodPending(orderId, session);
        });
      } finally {
        await session.endSession();
      }
    }
    const commissions = await Commission.find({ order: orderId });
    return { success: true, message: "COD delivery recorded; seller earnings await cash/remittance", data: { commissions, ...out } };
  } catch (error: any) {
    console.error("Error handling COD delivery:", error);
    return { success: false, message: error.message || "Failed to record COD delivery" };
  }
};

/** Legacy: QC COD delivered without an Olovely rider (old seller self-delivery). No credit. */
export const recordUnassignedCodPending = async (orderId: string) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const items = (await OrderItem.find({ order: orderId }).session(session)).filter((i) => isQcItem(i));
      const ids = await ensureSellerCommissions(orderId, items, "UNASSIGNED_COD", session);
      if (ids.length) {
        console.warn(
          `[COD] Order ${orderId} delivered without an Olovely rider; ${ids.length} seller commission(s) wait for admin cash confirmation.`,
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

/** Admin confirmed the cash for a legacy rider-less COD order → settle via escrow core. */
export const settleUnassignedCod = async (orderId: string) => {
  const session = await mongoose.startSession();
  try {
    let res: any = null;
    await session.withTransaction(async () => {
      const comms = await Commission.find({
        order: orderId,
        type: "SELLER",
        status: "Pending",
        settlementChannel: "UNASSIGNED_COD",
      }).session(session);
      res = await settleSellerCommissions(comms.map((c) => c._id), { session });
    });
    return res;
  } finally {
    await session.endSession();
  }
};

/**
 * Rider remitted COD cash. Orders are settled FIFO and only when the remittance covers the
 * order's full debt. Only that order's RIDER_COD (quick-commerce) seller commissions are
 * settled here; courier items wait for the Shiprocket remittance (R-04).
 */
export const processPendingCODPayouts = async (
  deliveryBoyId: string,
  amountPaid: number,
  session?: mongoose.ClientSession,
) => {
  let remainingAmount = round2(amountPaid);
  const pendingCommissions = await Commission.find({
    type: "SELLER",
    status: "Pending",
    settlementChannel: { $nin: ["COURIER_COD", "UNASSIGNED_COD", "PREPAID"] },
  })
    .populate({ path: "order", match: { deliveryBoy: deliveryBoyId, paymentMethod: "COD" } })
    .session(session || null)
    .sort({ createdAt: 1 });
  const validCommissions = pendingCommissions.filter((c) => c.order !== null);

  const PlatformWallet = (await import("../models/PlatformWallet")).default;
  const platformWallet = await PlatformWallet.findOne().session(session || null);

  const byOrder = new Map<string, { order: any; comms: any[] }>();
  for (const comm of validCommissions) {
    const order = comm.order as any;
    const key = order._id.toString();
    if (!byOrder.has(key)) byOrder.set(key, { order, comms: [] });
    byOrder.get(key)!.comms.push(comm);
  }

  const processedOrders = new Set<string>();
  for (const [orderKey, { order, comms }] of byOrder.entries()) {
    if (remainingAmount <= 0.01) break;
    const deliveryComm = await Commission.findOne({ order: order._id, type: "DELIVERY_BOY" }).session(session || null);
    if (!deliveryComm) continue;

    const breakdown = await calculateCODOrderBreakdown(orderKey, deliveryBoyId);
    const owed = round2(breakdown.amountDeliveryBoyOwesAdmin);
    if (owed <= 0) continue;
    if (remainingAmount < owed - 0.01) continue;

    // Legacy records have no channel: settle only quick-commerce items with the rider's cash.
    const itemIds = comms.map((c) => c.orderItem).filter(Boolean);
    const items = await OrderItem.find({ _id: { $in: itemIds } }).session(session || null);
    const qcItemIds = new Set(items.filter((i) => isQcItem(i)).map((i) => i._id.toString()));
    const qcComms = comms.filter((c) => c.orderItem && qcItemIds.has(c.orderItem.toString()));

    const res = await settleSellerCommissions(
      qcComms.map((c) => c._id),
      { session, description: `Sale proceeds for COD order ${order.orderNumber} (rider cash remitted)` },
    );
    if (platformWallet) {
      platformWallet.sellerPendingPayouts = Math.max(0, round2(platformWallet.sellerPendingPayouts + res.creditedAmount));
      platformWallet.totalAdminEarning += breakdown.totalAdminEarning;
    }
    remainingAmount = round2(remainingAmount - owed);
    processedOrders.add(order.orderNumber);
  }
  if (platformWallet) await platformWallet.save({ session });

  console.log(
    `[COD Payout] Processed ${processedOrders.size} orders for delivery boy ${deliveryBoyId}. Remaining payment: ${remainingAmount}`,
  );
  return { success: true, processedCount: processedOrders.size, remainingAmount: Math.max(0, remainingAmount) };
};


/**
 * Get commission summary for a user
 */
export const getCommissionSummary = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
) => {
  try {
    // Filter by type too, so the totals use the same basis as the seller wallet
    // stats and the delivery dashboard/earnings aggregations.
    const query =
      userType === "SELLER"
        ? { seller: userId, type: "SELLER" }
        : { deliveryBoy: userId, type: "DELIVERY_BOY" };

    const commissions = await Commission.find(query).sort({ createdAt: -1 });

    const summary = {
      total: 0,
      paid: 0,
      pending: 0,
      onHold: 0,
      cancelled: 0,
      count: commissions.length,
      commissions: commissions.map((c) => ({
        id: c._id,
        orderId: c.order,
        amount: c.commissionAmount,
        rate: c.commissionRate,
        orderAmount: c.orderAmount,
        status: c.status,
        paidAt: c.paidAt,
        createdAt: c.createdAt,
      })),
    };

    commissions.forEach((c) => {
      // For Sellers, earning is Order Amount - Commission Amount
      // For Delivery Boys, earning is the Commission Amount itself
      const earningAmount =
        userType === "SELLER"
          ? c.orderAmount - c.commissionAmount
          : c.commissionAmount;

      // Cancelled (cancelled/returned orders) is NOT earning. Previously it was counted in
      // `total`, and OnHold (escrow) was in neither bucket, so total ≠ paid + pending.
      if (c.status === "Cancelled") {
        summary.cancelled += earningAmount;
        return;
      }
      summary.total += earningAmount;
      if (c.status === "Paid") {
        summary.paid += earningAmount;
      } else if (c.status === "Pending") {
        summary.pending += earningAmount;
      } else if (c.status === "OnHold") {
        summary.onHold += earningAmount;
      }
    });
    summary.total = round2(summary.total);
    summary.paid = round2(summary.paid);
    summary.pending = round2(summary.pending);
    summary.onHold = round2(summary.onHold);
    summary.cancelled = round2(summary.cancelled);

    return {
      success: true,
      data: summary,
    };
  } catch (error: any) {
    console.error("Error getting commission summary:", error);
    return {
      success: false,
      message: error.message || "Failed to get commission summary",
    };
  }
};

/**
 * Reverse commissions for a cancelled/returned order
 */
export const reverseCommissions = async (orderId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commissions = await Commission.find({ order: orderId }).session(
      session,
    );

    if (commissions.length === 0) {
      // No commissions to reverse
      return {
        success: true,
        message: "No commissions to reverse",
      };
    }

    for (const commission of commissions) {
      // Only reverse if status is Paid
      if (commission.status === "Paid") {
        commission.status = "Cancelled";
        await commission.save({ session });

        // Debit from wallet
        const userId =
          commission.type === "SELLER"
            ? commission.seller
            : commission.deliveryBoy;
        const userType = commission.type;

        if (userId) {
          const { debitWallet } = await import("./walletManagementService");
          // Seller was credited orderAmount - commissionAmount (net), not the commission itself.
          const amountToReverse =
            commission.type === "SELLER"
              ? round2(commission.orderAmount - commission.commissionAmount)
              : commission.commissionAmount;
          await debitWallet(
            userId.toString(),
            userType,
            amountToReverse,
            `Commission reversal for cancelled order`,
            orderId,
            session,
          );
        }
      }
    }

    await session.commitTransaction();

    return {
      success: true,
      message: "Commissions reversed successfully",
    };
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error reversing commissions:", error);
    return {
      success: false,
      message: error.message || "Failed to reverse commissions",
    };
  } finally {
    session.endSession();
  }
};

/**
 * COD Order Breakdown Interface
 */
export interface ICODOrderBreakdown {
  orderId: string;
  orderNumber: string;

  // Product breakdown
  productCost: number; // Subtotal of all products
  adminProductCommission: number; // Admin's commission on products
  sellerEarnings: Map<string, number>; // Seller ID -> their earning (product cost - admin commission)

  // Fees
  platformFee: number;
  /** Small cart fee (Quick Commerce below the admin threshold) — 100% platform income. */
  smallCartFee: number;

  // Delivery breakdown
  totalDeliveryCharge: number;
  deliveryBoyCommission: number; // Delivery boy's earning from delivery
  adminDeliveryCommission: number; // Admin's portion of delivery charge

  // Totals
  totalAdminEarning: number; // adminProductCommission + platformFee + adminDeliveryCommission
  totalOrderAmount: number; // Grand total customer pays
  amountDeliveryBoyOwesAdmin: number; // Total - deliveryBoyCommission

  // Metadata
  deliveryBoyId?: string;
  deliveryDistanceKm?: number;
  /** True when no Olovely rider delivered (courier-only or legacy). No delivery fee goes to sellers (B-7). */
  isSelfAssign?: boolean;
}

/**
 * Calculate complete COD order breakdown
 * This function calculates how money flows for a COD order:
 * - Product commission (admin vs seller)
 * - Platform fee (goes to admin)
 * - Delivery charge split (delivery boy commission vs admin commission)
 */
export const calculateCODOrderBreakdown = async (
  orderId: string,
  deliveryBoyId?: string,
): Promise<ICODOrderBreakdown> => {
  try {
    const order = await Order.findById(orderId).populate("items");
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentMethod !== "COD") {
      throw new Error("This function is only for COD orders");
    }

    const resolvedDeliveryBoyId = deliveryBoyId || order.deliveryBoy?.toString();
    let assignedCodAmount = (order.orderType === "ECOMMERCE") ? 0 : order.total;
    let deliveryScopedSubtotal = Number(order.subtotal || 0);
    let deliveryScopedShipping = Number(order.shipping || 0);

    if (resolvedDeliveryBoyId) {
      const { getDeliveryPartnerQcContext } = await import(
        "../modules/delivery/utils/deliveryOrderScopingHelper"
      );
      const qcCtx = getDeliveryPartnerQcContext(order, resolvedDeliveryBoyId);
      if (qcCtx.isAuthorized && qcCtx.hasQcItems && !qcCtx.isEcommerceOnly) {
        assignedCodAmount = qcCtx.assignedQcCodAmount;
        deliveryScopedSubtotal = qcCtx.assignedQcSubtotal;
        deliveryScopedShipping = qcCtx.assignedQcShippingFee;
      } else if (qcCtx.isEcommerceOnly) {
        assignedCodAmount = 0;
        deliveryScopedSubtotal = 0;
        deliveryScopedShipping = 0;
      }
    } else if (order.orderType === "MIXED") {
      const qcGroup = order.fulfillmentGroups?.find(
        (g: any) => g.fulfillmentType === "LOCAL_DELIVERY"
      );
      if (qcGroup) {
        const qcBoyId = qcGroup?.deliveryBoy?.toString() || order.deliveryBoy?.toString();
        if (qcBoyId) {
          const { getDeliveryPartnerQcContext } = await import(
            "../modules/delivery/utils/deliveryOrderScopingHelper"
          );
          const qcCtx = getDeliveryPartnerQcContext(order, qcBoyId);
          assignedCodAmount = qcCtx.assignedQcCodAmount;
        } else {
          // If no rider assigned yet, the QC portion is strictly the QC group total
          const qcGroupGross = Number(qcGroup.subtotal || 0) + Number(qcGroup.shippingFee || 0);
          const fullCodPending = Number(order.codAmountPending ?? order.total ?? 0);
          assignedCodAmount = Math.min(qcGroupGross, fullCodPending);
          deliveryScopedSubtotal = Number(qcGroup.subtotal || 0);
          deliveryScopedShipping = Number(qcGroup.shippingFee || 0);
        }
      } else {
        assignedCodAmount = 0;
      }
    }

    const isSelfAssign = !order.deliveryBoy;
    const breakdown: ICODOrderBreakdown = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      productCost: order.subtotal,
      adminProductCommission: 0,
      sellerEarnings: new Map<string, number>(),
      platformFee: order.platformFee || 0,
      smallCartFee: Math.max(0, Number((order as any).smallCartFee) || 0),
      totalDeliveryCharge: deliveryScopedShipping,
      deliveryBoyCommission: 0,
      adminDeliveryCommission: 0,
      totalAdminEarning: 0,
      totalOrderAmount: assignedCodAmount,
      amountDeliveryBoyOwesAdmin: 0,
      deliveryBoyId: resolvedDeliveryBoyId,
      deliveryDistanceKm: order.deliveryDistanceKm,
      isSelfAssign,
    };

    // 1. Calculate Product Commissions (Admin vs Seller)
    for (const itemId of order.items) {
      const item = await OrderItem.findById(itemId);
      if (!item) continue;
      if (item.status === "Cancelled") continue; // never delivered → no earning, no commission
      // Note: a later-deleted product must not erase the seller's earning for an item they sold.

      const commissionRate = await resolveItemCommissionRate(item);

      // Calculate commission and seller earning for this item
      const itemCommission = itemSellerCommission(item as any, commissionRate);
      const itemSellerEarning = item.total - itemCommission;

      breakdown.adminProductCommission += itemCommission;

      // Aggregate seller earnings
      const sellerId = item.seller.toString();
      const currentEarning = breakdown.sellerEarnings.get(sellerId) || 0;
      breakdown.sellerEarnings.set(
        sellerId,
        currentEarning + itemSellerEarning,
      );
    }

    // 2. Calculate Delivery Commission Split
    if (!order.deliveryBoy) {
      // No Olovely rider (courier-only / legacy): no rider share; delivery charge stays with the platform
      breakdown.deliveryBoyCommission = 0;
      breakdown.adminDeliveryCommission = 0;
      breakdown.amountDeliveryBoyOwesAdmin = 0;
      // totalAdminEarning computed below (no delivery share for admin)
    } else if (order.deliveryBoy) {
      const settings = await AppSettings.getSettings();

      // Distance-based partner pay: base pay for the first km + extra per km after that
      const distancePay = computeDistanceRiderPay(settings?.deliveryConfig, order.deliveryDistanceKm);
      if (distancePay !== null) {
        breakdown.deliveryBoyCommission = distancePay;

        // Admin gets the rest of the delivery charge (possibly negative if they pay extra)
        breakdown.adminDeliveryCommission =
          breakdown.totalDeliveryCharge - breakdown.deliveryBoyCommission;
      } else {
        // Fallback: If no distance-based config, use percentage of order subtotal (matches prepaid logic)
        // Get delivery boy commission rate (default 5%)
        const deliveryBoy = await Delivery.findById(order.deliveryBoy);
        // `??` (not `||`): a rider configured at 0% must not silently get 5% on COD orders only
        // (prepaid orders already respected 0% via getDeliveryBoyCommissionRate).
        const deliveryBoyRate = deliveryBoy?.commissionRate ?? 5;

        // Use subtotal instead of shipping charge to avoid zero commission on free delivery.
        // This ensures the delivery boy always gets paid even if shipping is free.
        breakdown.deliveryBoyCommission = round2(
          (deliveryScopedSubtotal * deliveryBoyRate) / 100);

        // Use subtotal based delivery boy pay, but admin still keeps the full delivery charge 
        // We will subtract the DB commission from total admin earning later
        breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
      }
    } else {
      // No delivery boy assigned (and not Self), all delivery charge goes to admin
      breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
    }

    // B-7: no seller self-delivery fee. The delivery charge is platform income (rider paid from it).
    for (const [sid, amt] of breakdown.sellerEarnings.entries()) breakdown.sellerEarnings.set(sid, round2(amt));
    breakdown.adminProductCommission = round2(breakdown.adminProductCommission);

    // 3. Calculate Total Admin Net Earning (Product Commission + Platform Fee + Shipping - Delivery Partner Share)
    const deliveryPartnerShare = (isSelfAssign || !order.deliveryBoy) ? 0 : breakdown.deliveryBoyCommission;
    const customerShipping = round2(breakdown.totalDeliveryCharge);
    breakdown.totalAdminEarning = Math.round(
      (breakdown.adminProductCommission + breakdown.platformFee + breakdown.smallCartFee + customerShipping - deliveryPartnerShare) * 100
    ) / 100;

    // 4. Amount Delivery Boy Owes Admin (only when delivery boy assigned)
    breakdown.amountDeliveryBoyOwesAdmin = (order.deliveryBoy || resolvedDeliveryBoyId) ? breakdown.totalOrderAmount : 0;

    console.log(`[COD Breakdown] Order ${order.orderNumber}:`, {
      productCost: breakdown.productCost,
      adminProductCommission: breakdown.adminProductCommission,
      platformFee: breakdown.platformFee,
      deliveryCharge: breakdown.totalDeliveryCharge,
      deliveryBoyCommission: breakdown.deliveryBoyCommission,
      adminDeliveryCommission: breakdown.adminDeliveryCommission,
      totalAdminEarning: breakdown.totalAdminEarning,
      amountDeliveryBoyOwes: breakdown.amountDeliveryBoyOwesAdmin,
    });

    return breakdown;
  } catch (error: any) {
    console.error("Error calculating COD order breakdown:", error);
    throw error;
  }
};

/**
 * Unified earning breakdown for any order (COD or Online).
 * For COD returns same as calculateCODOrderBreakdown.
 * For Online computes: product commission, platform fee, seller earnings, delivery split (Self → seller gets delivery; else delivery boy share).
 */
export const getOrderEarningBreakdown = async (
  orderId: string,
): Promise<ICODOrderBreakdown> => {
  const order = await Order.findById(orderId).populate("items");
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentMethod === "COD") {
    return calculateCODOrderBreakdown(orderId);
  }

  // Online / Prepaid: compute same-shaped breakdown
  const isSelfAssign = !order.deliveryBoy;
  let deliveryScopedSubtotal = Number(order.subtotal || 0);
  let deliveryScopedShipping = Number(order.shipping || 0);
  if (order.deliveryBoy) {
    const { getDeliveryPartnerQcContext } = await import(
      "../modules/delivery/utils/deliveryOrderScopingHelper"
    );
    const qcCtx = getDeliveryPartnerQcContext(order, order.deliveryBoy.toString());
    if (qcCtx.isAuthorized && qcCtx.hasQcItems && !qcCtx.isEcommerceOnly) {
      deliveryScopedSubtotal = qcCtx.assignedQcSubtotal;
      deliveryScopedShipping = qcCtx.assignedQcShippingFee;
    }
  }
  const breakdown: ICODOrderBreakdown = {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    productCost: order.subtotal,
    adminProductCommission: 0,
    sellerEarnings: new Map<string, number>(),
    platformFee: order.platformFee || 0,
    smallCartFee: Math.max(0, Number((order as any).smallCartFee) || 0),
    totalDeliveryCharge: deliveryScopedShipping,
    deliveryBoyCommission: 0,
    adminDeliveryCommission: 0,
    totalAdminEarning: 0,
    totalOrderAmount: order.total,
    amountDeliveryBoyOwesAdmin: 0,
    deliveryBoyId: order.deliveryBoy?.toString(),
    deliveryDistanceKm: order.deliveryDistanceKm,
    isSelfAssign,
  };

  const itemRefs = Array.isArray(order.items) ? order.items : [];
  for (const itemRef of itemRefs) {
    const item =
      itemRef &&
      typeof itemRef === "object" &&
      (itemRef as any).total != null
        ? (itemRef as any)
        : await OrderItem.findById((itemRef as any)?._id ?? itemRef);
    if (!item) continue;
    if (item.status === "Cancelled") continue; // never delivered → no earning (matches createPendingCommissions)

    const commissionRate = await resolveItemCommissionRate(item);
    const itemCommission = itemSellerCommission(item as any, commissionRate);
    const itemSellerEarning = item.total - itemCommission;

    breakdown.adminProductCommission += itemCommission;
    const sellerId = (item.seller?.toString?.() ?? item.seller).toString();
    const current = breakdown.sellerEarnings.get(sellerId) || 0;
    breakdown.sellerEarnings.set(sellerId, current + itemSellerEarning);
  }

  // B-7: no seller self-delivery fee; without a rider the whole delivery charge is platform income.
  if (isSelfAssign) {
    breakdown.deliveryBoyCommission = 0;
    breakdown.adminDeliveryCommission = round2(breakdown.totalDeliveryCharge);
  } else if (order.deliveryBoy) {
    const settings = await AppSettings.getSettings();
    const distancePay = computeDistanceRiderPay(settings?.deliveryConfig, order.deliveryDistanceKm);
    if (distancePay !== null) {
      breakdown.deliveryBoyCommission = distancePay;
      breakdown.adminDeliveryCommission =
        breakdown.totalDeliveryCharge - breakdown.deliveryBoyCommission;
    } else {
      const deliveryBoy = await Delivery.findById(order.deliveryBoy);
      const rate = deliveryBoy?.commissionRate ?? 5;
      breakdown.deliveryBoyCommission = (deliveryScopedSubtotal * rate) / 100;
      breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
    }
  } else {
    breakdown.adminDeliveryCommission = breakdown.totalDeliveryCharge;
  }

  breakdown.deliveryBoyCommission = round2(breakdown.deliveryBoyCommission);
  const deliveryPartnerShare = (isSelfAssign || !order.deliveryBoy) ? 0 : breakdown.deliveryBoyCommission;
  const customerShipping = round2(breakdown.totalDeliveryCharge);
  breakdown.totalAdminEarning = Math.round(
    (breakdown.adminProductCommission + breakdown.platformFee + breakdown.smallCartFee + customerShipping - deliveryPartnerShare) * 100
  ) / 100;

  return breakdown;
};

/**
 * COD order whose quick-commerce part was delivered by an Olovely rider.
 * Records the rider's cash debt and earning, creates Pending RIDER_COD seller commissions for the
 * QC items only, and credits the tip (B-1). Seller money is settled later by
 * processPendingCODPayouts once the rider remits the cash. Idempotent per order.
 */
export const processCODOrderDelivery = async (
  orderId: string,
  session?: mongoose.ClientSession,
  deliveryBoyId?: string,
): Promise<void> => {
  const useExternalSession = !!session;
  if (!session) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");
    if (order.paymentMethod !== "COD") throw new Error("This function is only for COD orders");

    const resolvedDeliveryBoyId = deliveryBoyId || resolveQcRiderId(order);
    if (!resolvedDeliveryBoyId) {
      throw new Error("COD quick-commerce delivery requires an assigned Olovely rider (no seller self-delivery)");
    }

    const breakdown = await calculateCODOrderBreakdown(orderId, resolvedDeliveryBoyId);
    const PlatformWallet = (await import("../models/PlatformWallet")).default;

    const existingRiderComm = await Commission.findOne({ order: orderId, type: "DELIVERY_BOY" }).session(session);
    const legacyTx = await WalletTransaction.findOne({
      userId: resolvedDeliveryBoyId,
      relatedOrder: orderId,
      description: { $regex: /Delivery earning for COD order/i },
    }).session(session);

    if (existingRiderComm || legacyTx) {
      console.log(`[COD Delivery] Order ${order.orderNumber} already processed. Skipping cash/earning updates.`);
    } else {
      const deliveryBoy = await Delivery.findById(resolvedDeliveryBoyId).session(session);
      if (!deliveryBoy) throw new Error("Delivery boy not found");

      deliveryBoy.pendingAdminPayout = round2((deliveryBoy.pendingAdminPayout || 0) + breakdown.amountDeliveryBoyOwesAdmin);
      deliveryBoy.cashCollected = round2((deliveryBoy.cashCollected || 0) + breakdown.amountDeliveryBoyOwesAdmin);
      await deliveryBoy.save({ session });

      const [riderComm] = await Commission.create(
        [
          {
            order: orderId,
            deliveryBoy: deliveryBoy._id,
            type: "DELIVERY_BOY",
            orderAmount: breakdown.deliveryDistanceKm || breakdown.totalDeliveryCharge,
            commissionRate:
              breakdown.deliveryDistanceKm && breakdown.deliveryDistanceKm > 0
                ? breakdown.deliveryBoyCommission / breakdown.deliveryDistanceKm
                : breakdown.totalDeliveryCharge && breakdown.totalDeliveryCharge > 0
                  ? Math.min(100, (breakdown.deliveryBoyCommission / breakdown.totalDeliveryCharge) * 100)
                  : 5,
            commissionAmount: breakdown.deliveryBoyCommission,
            status: "Paid",
            paidAt: new Date(),
          },
        ],
        { session },
      );

      if (breakdown.deliveryBoyCommission > 0) {
        const res = await creditWallet(
          resolvedDeliveryBoyId,
          "DELIVERY_BOY",
          breakdown.deliveryBoyCommission,
          `Delivery earning for COD order ${order.orderNumber}`,
          orderId,
          riderComm._id.toString(),
          session,
          `RIDER_EARNING_${orderId}`,
        );
        if (!res.success) throw new Error(`Rider credit failed: ${res.message}`);
      }

      const platformWallet = await PlatformWallet.findOne().session(session);
      if (!platformWallet) {
        await PlatformWallet.create(
          [
            {
              totalPlatformEarning: 0,
              currentPlatformBalance: 0,
              totalAdminEarning: 0,
              pendingFromDeliveryBoy: breakdown.amountDeliveryBoyOwesAdmin,
              sellerPendingPayouts: 0,
              deliveryBoyPendingPayouts: breakdown.deliveryBoyCommission,
            },
          ],
          { session },
        );
      } else {
        platformWallet.pendingFromDeliveryBoy += breakdown.amountDeliveryBoyOwesAdmin;
        platformWallet.deliveryBoyPendingPayouts += breakdown.deliveryBoyCommission;
        await platformWallet.save({ session });
      }

      // Seller commissions for the QUICK-COMMERCE items only (courier items: courierCodService)
      const qcItems = (await OrderItem.find({ order: orderId }).session(session)).filter((i) => isQcItem(i));
      await ensureSellerCommissions(orderId, qcItems, "RIDER_COD", session);

      const { default: CashCollection } = await import("../models/CashCollection");
      await CashCollection.create(
        [
          {
            deliveryBoy: deliveryBoy._id,
            order: orderId,
            amount: breakdown.amountDeliveryBoyOwesAdmin,
            remark: `Auto-generated from delivered COD order ${order.orderNumber} (QC fulfillment assignment)`,
            status: "Pending",
          },
        ],
        { session },
      );
      console.log(`[COD Delivery] Order ${order.orderNumber} recorded (rider owes ₹${breakdown.amountDeliveryBoyOwesAdmin}).`);
    }

    // B-1: tip belongs 100% to the rider (idempotent; also covers orders processed before tips were paid)
    await creditOrderTip(orderId, resolvedDeliveryBoyId, session);

    if (!useExternalSession) await session.commitTransaction();
  } catch (error: any) {
    if (!useExternalSession && session.inTransaction()) await session.abortTransaction();
    console.error("Error processing COD order delivery:", error);
    throw error;
  } finally {
    if (!useExternalSession) session.endSession();
  }
};

/**
 * R-03 / B-5: release OnHold seller earnings whose return window has ended.
 * Each commission is released in its own short transaction (atomic OnHold → Paid claim +
 * unique ledger reference ESCROW_RELEASE_<id>), so concurrent runs (scheduler on several
 * instances, wallet page loads) can never double-credit. Items with an open return/exchange
 * stay on hold (R-05) and are retried on the next run.
 */
export const releaseExpiredEscrow = async (
  options: { limit?: number; sellerId?: string } = {},
): Promise<{
  success: boolean;
  releasedCount: number;
  releasedAmount: number;
  skippedOpenReturn: number;
  failed: number;
}> => {
  const limit = options.limit ?? 500;
  const result = { success: true, releasedCount: 0, releasedAmount: 0, skippedOpenReturn: 0, failed: 0 };
  const candidates = await Commission.find({
    type: "SELLER",
    status: "OnHold",
    onHoldUntil: { $lte: new Date() },
    ...(options.sellerId ? { seller: options.sellerId } : {}),
  })
    .sort({ onHoldUntil: 1 })
    .limit(limit);

  for (const comm of candidates) {
    if (!comm.seller) continue;
    if (await hasOpenReturn(comm)) {
      result.skippedOpenReturn++;
      console.log(`[Escrow] Skipped commission ${comm._id}: return/exchange still open`);
      continue;
    }
    const session = await mongoose.startSession();
    try {
      let released = 0;
      await session.withTransaction(async () => {
        released = 0;
        const claimed = await Commission.findOneAndUpdate(
          { _id: comm._id, status: "OnHold" },
          { $set: { status: "Paid", paidAt: new Date() } },
          { session, new: true },
        );
        if (!claimed) return;
        const net = round2(claimed.orderAmount - claimed.commissionAmount);
        await Seller.findByIdAndUpdate(claimed.seller, { $inc: { onHoldBalance: -net } }, { session });
        if (net > 0) {
          const res = await creditWallet(
            claimed.seller!.toString(),
            "SELLER",
            net,
            `Released held sale proceeds after return window expired (Order ${claimed.order})`,
            claimed.order.toString(),
            claimed._id.toString(),
            session,
            `ESCROW_RELEASE_${claimed._id.toString()}`,
          );
          if (!res.success) throw new Error(`Escrow release credit failed: ${res.message}`);
        }
        released = net;
      });
      if (released > 0) {
        result.releasedCount++;
        result.releasedAmount = round2(result.releasedAmount + released);
        console.log(`[Escrow] Released ₹${released} for commission ${comm._id} (seller ${comm.seller})`);
      }
    } catch (error: any) {
      result.failed++;
      result.success = false;
      console.error(`[Escrow] Release failed for commission ${comm._id}:`, error?.message || error);
    } finally {
      await session.endSession();
    }
  }
  return result;
};

/**
 * Single hook for every "delivered" event (rider OTP, rider status update, admin, seller,
 * Shiprocket webhook). Records the rider's COD cash as soon as the quick-commerce part is
 * delivered (even if a MIXED order's courier part is still in transit) and runs the full,
 * idempotent settlement once the whole order is Delivered.
 */
export const recordDeliveryFinancials = async (orderId: string, riderIdHint?: string) => {
  const order = await Order.findById(orderId).populate("items");
  if (!order) return { success: false, message: "Order not found" };
  const isCod = String(order.paymentMethod || "").toUpperCase() === "COD";
  const hasQc = ((order.items as any[]) || []).some((i) => isQcItem(i));
  if (isCod && hasQc) {
    const riderId = riderIdHint || resolveQcRiderId(order);
    if (riderId) await processCODOrderDelivery(orderId, undefined, riderId);
  }
  // A delivered COD order means the customer has paid (the rider OTP path already sets this).
  // Admin/seller "Delivered" left it "Pending", which hid the sale from revenue (counts Delivered + Paid).
  // Cash hand-over to admin is tracked separately (codPaidToAdminAt), so this does not affect it.
  if (isCod && order.status === "Delivered" && !["Paid", "Refunded"].includes(String(order.paymentStatus))) {
    await Order.updateOne({ _id: order._id, paymentStatus: order.paymentStatus }, { $set: { paymentStatus: "Paid" } });
  }
  if (order.status === "Delivered") return distributeCommissions(orderId);
  return { success: true, message: "Partial delivery recorded; settlement runs when the order is fully delivered" };
};
