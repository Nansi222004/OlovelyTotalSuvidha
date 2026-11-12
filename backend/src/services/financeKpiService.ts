/**
 * B-6 / R-08: one definition for every admin financial KPI. Dashboards, the admin wallet and
 * reports must read these numbers instead of re-aggregating `order.total` themselves.
 *
 * Scope: "qualifying orders" = placed orders that were not cancelled or rejected
 *        (status ∉ Pending, Cancelled, Rejected; Pending = online order never paid/placed),
 *        optionally limited to an IST date range on orderDate.
 *
 * GMV               Σ item.total (GST-inclusive merchandise) of qualifying orders, items not
 *                   Cancelled. Returns are NOT deducted (gross, industry convention).
 * Net sales         GMV − platform-funded coupon discount − product refunds on completed returns.
 *                   (A return's refund already excludes that item's coupon share, so coupons are
 *                   not deducted twice.)
 * Net sales ex-GST  Net sales minus the GST included in the non-returned merchandise.
 * Platform earnings gross = Σ seller commissions (non-cancelled, i.e. after return reversals)
 *                         + platform fees + customer delivery/shipping fees
 *                         − rider earnings (non-cancelled) − Shiprocket charges (platform-borne)
 *                   net   = gross − net coupon cost (coupons are platform-funded, B-2)
 *                   Excludes: seller earnings, GST (sellers keep and remit it, B-3), rider tips (B-1).
 * Seller earnings   Σ (commission.orderAmount − commission.commissionAmount), non-cancelled,
 *                   split Pending (money not yet received) / OnHold (return window) / Paid.
 * Refunds           gateway = Σ Payment.refundAmount (cumulative, one row per payment);
 *                   wallet  = Σ customer wallet credits with refund categories (unique ledger refs).
 * COD pending       riders: Σ Delivery.pendingAdminPayout (now); courier: CourierCodSettlement.
 * Tips              collected on qualifying orders; credited to riders; not yet credited.
 *
 * Time zone: every day / month boundary is Asia/Kolkata (UTC+05:30, no DST), independent of
 * the server's own time zone.
 */
import Order from "../models/Order";
import Commission from "../models/Commission";
import Return from "../models/Return";
import Payment from "../models/Payment";
import WalletTransaction from "../models/WalletTransaction";
import Delivery from "../models/Delivery";
import CourierCodRemittance from "../models/CourierCodRemittance";
import { round2 } from "./financeMath";

export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 IST on the IST calendar day containing `date`, shifted by `dayOffset`. */
export const istStartOfDay = (date: Date = new Date(), dayOffset = 0): Date => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const midnightIstAsUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset);
  return new Date(midnightIstAsUtc - IST_OFFSET_MS);
};

/** [start, end) of an IST calendar day. */
export const istDayRange = (date: Date = new Date(), dayOffset = 0): { start: Date; end: Date } => {
  const start = istStartOfDay(date, dayOffset);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** UTC instant of 00:00 IST on the 1st of the IST month containing `date`, shifted by months. */
export const istStartOfMonth = (date: Date = new Date(), monthOffset = 0): Date => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + monthOffset, 1) - IST_OFFSET_MS);
};

/** Parse "YYYY-MM-DD" as an IST calendar date → [start, end-of-day) bounds. */
export const parseIstDateRange = (from?: string, to?: string): { from?: Date; to?: Date } => {
  const parse = (s?: string) => {
    if (!s) return undefined;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return undefined;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_OFFSET_MS);
  };
  const f = parse(from);
  const t = parse(to);
  return { from: f, to: t ? new Date(t.getTime() + DAY_MS) : undefined };
};

export const NON_QUALIFYING_STATUSES = ["Pending", "Cancelled", "Rejected"];

export const qualifyingOrderMatch = (range: { from?: Date; to?: Date } = {}) => {
  const match: any = { status: { $nin: NON_QUALIFYING_STATUSES } };
  if (range.from || range.to) {
    match.orderDate = {};
    if (range.from) match.orderDate.$gte = range.from;
    if (range.to) match.orderDate.$lt = range.to;
  }
  return match;
};

export interface FinanceKpis {
  range: { from?: string; to?: string; timeZone: string };
  orders: number;
  gmv: number;
  gstIncludedInGmv: number;
  couponDiscount: number;
  returnedMerchandise: number;
  returnProductRefunds: number;
  returnedCouponShare: number;
  netSales: number;
  netSalesExGst: number;
  platformFees: number;
  deliveryFees: number;
  sellerCommissions: number;
  riderEarnings: number;
  courierCharges: number;
  couponCostNet: number;
  platformEarningsGross: number;
  platformEarningsNet: number;
  sellerEarnings: { total: number; pending: number; onHold: number; paid: number };
  refunds: { gateway: number; wallet: number; total: number; returnRecords: number };
  codPending: { riders: number; courier: number; courierReceived: number };
  tips: { collected: number; creditedToRiders: number; notYetCredited: number };
}

export const getFinanceKpis = async (range: { from?: Date; to?: Date } = {}): Promise<FinanceKpis> => {
  const orderMatch = qualifyingOrderMatch(range);

  const [orderAgg] = await Order.aggregate([
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        discount: { $sum: { $ifNull: ["$discount", 0] } },
        platformFees: { $sum: { $ifNull: ["$platformFee", 0] } },
        deliveryFees: { $sum: { $ifNull: ["$shipping", 0] } },
        tips: { $sum: { $ifNull: ["$tipAmount", 0] } },
        tipsCredited: { $sum: { $cond: [{ $ifNull: ["$tipCreditedAt", false] }, { $ifNull: ["$tipAmount", 0] }, 0] } },
      },
    },
  ]);

  const [itemAgg] = await Order.aggregate([
    { $match: orderMatch },
    { $lookup: { from: "orderitems", localField: "_id", foreignField: "order", as: "it" } },
    { $unwind: "$it" },
    { $match: { "it.status": { $ne: "Cancelled" } } },
    {
      $group: {
        _id: null,
        gmv: { $sum: { $ifNull: ["$it.total", 0] } },
        gst: { $sum: { $ifNull: ["$it.taxAmount", 0] } },
      },
    },
  ]);

  // Completed returns of qualifying orders: returned value (proportional item value), its GST,
  // and the product refund actually paid (coupon share already excluded by the refund rule).
  const [retAgg] = await Return.aggregate([
    { $match: { status: "Completed" } },
    { $lookup: { from: "orders", localField: "order", foreignField: "_id", as: "o" } },
    { $unwind: "$o" },
    { $match: Object.fromEntries(Object.entries(orderMatch).map(([k, v]) => [`o.${k}`, v])) },
    { $lookup: { from: "orderitems", localField: "orderItem", foreignField: "_id", as: "it" } },
    { $unwind: "$it" },
    {
      $project: {
        refund: { $ifNull: ["$refundAmount", 0] },
        frac: {
          $cond: [
            { $gt: [{ $ifNull: ["$it.quantity", 0] }, 0] },
            { $min: [1, { $divide: [{ $ifNull: ["$quantity", 0] }, "$it.quantity"] }] },
            0,
          ],
        },
        itemTotal: { $ifNull: ["$it.total", 0] },
        itemTax: { $ifNull: ["$it.taxAmount", 0] },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        refund: { $sum: "$refund" },
        value: { $sum: { $multiply: ["$itemTotal", "$frac"] } },
        tax: { $sum: { $multiply: ["$itemTax", "$frac"] } },
      },
    },
  ]);

  const orderIdsStage = [
    { $lookup: { from: "orders", localField: "order", foreignField: "_id", as: "o" } },
    { $unwind: "$o" },
    { $match: Object.fromEntries(Object.entries(orderMatch).map(([k, v]) => [`o.${k}`, v])) },
  ];

  const commAgg = await Commission.aggregate([
    { $match: { status: { $ne: "Cancelled" } } },
    ...orderIdsStage,
    {
      $group: {
        _id: { type: "$type", status: "$status" },
        commission: { $sum: "$commissionAmount" },
        net: { $sum: { $subtract: ["$orderAmount", "$commissionAmount"] } },
      },
    },
  ]);

  const [payAgg] = await Payment.aggregate([
    { $match: { refundAmount: { $gt: 0 } } },
    ...orderIdsStage,
    { $group: { _id: null, refunded: { $sum: "$refundAmount" } } },
  ]);

  const [walletRefundAgg] = await WalletTransaction.aggregate([
    {
      $match: {
        userType: "CUSTOMER",
        type: "Credit",
        status: "Completed",
        category: { $in: ["COD_RETURN_REFUND", "ORDER_CANCELLATION_REFUND"] },
      },
    },
    { $lookup: { from: "orders", localField: "relatedOrder", foreignField: "_id", as: "o" } },
    { $unwind: "$o" },
    // cancellation refunds belong to cancelled orders, so only the date range applies here
    ...(range.from || range.to
      ? [{ $match: { "o.orderDate": { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lt: range.to } : {}) } } }]
      : []),
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const remitMatch: any = {};
  if (range.from || range.to) {
    remitMatch.remittanceDate = {};
    if (range.from) remitMatch.remittanceDate.$gte = range.from;
    if (range.to) remitMatch.remittanceDate.$lt = range.to;
  }
  const [remitAgg] = await CourierCodRemittance.aggregate([
    { $match: remitMatch },
    { $group: { _id: null, charges: { $sum: "$courierCharges" }, received: { $sum: "$amountReceived" } } },
  ]);

  const [riderDebt] = await Delivery.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ["$pendingAdminPayout", 0] } } } }]);
  const { getCourierCodSummary } = await import("./courierCodService");
  const courier = await getCourierCodSummary();

  const sum = (type: string, field: "commission" | "net", status?: string) =>
    commAgg
      .filter((r) => r._id.type === type && (!status || r._id.status === status))
      .reduce((s, r) => s + (r[field] || 0), 0);

  const gmv = round2(itemAgg?.gmv || 0);
  const gst = round2(itemAgg?.gst || 0);
  const couponDiscount = round2(orderAgg?.discount || 0);
  const returnProductRefunds = round2(retAgg?.refund || 0);
  const returnedMerchandise = round2(retAgg?.value || 0);
  const returnedCouponShare = round2(Math.max(0, returnedMerchandise - returnProductRefunds));
  const netSales = round2(gmv - couponDiscount - returnProductRefunds);
  const netSalesExGst = round2(netSales - (gst - (retAgg?.tax || 0)));

  const sellerCommissions = round2(sum("SELLER", "commission"));
  const riderEarnings = round2(sum("DELIVERY_BOY", "commission"));
  const platformFees = round2(orderAgg?.platformFees || 0);
  const deliveryFees = round2(orderAgg?.deliveryFees || 0);
  const courierCharges = round2(remitAgg?.charges || 0);
  const couponCostNet = round2(couponDiscount - returnedCouponShare);
  const platformEarningsGross = round2(sellerCommissions + platformFees + deliveryFees - riderEarnings - courierCharges);

  const gateway = round2(payAgg?.refunded || 0);
  const wallet = round2(walletRefundAgg?.total || 0);
  const tipsCollected = round2(orderAgg?.tips || 0);
  const tipsCredited = round2(orderAgg?.tipsCredited || 0);

  return {
    range: {
      from: range.from?.toISOString(),
      to: range.to?.toISOString(),
      timeZone: IST_TZ,
    },
    orders: orderAgg?.orders || 0,
    gmv,
    gstIncludedInGmv: gst,
    couponDiscount,
    returnedMerchandise,
    returnProductRefunds,
    returnedCouponShare,
    netSales,
    netSalesExGst,
    platformFees,
    deliveryFees,
    sellerCommissions,
    riderEarnings,
    courierCharges,
    couponCostNet,
    platformEarningsGross,
    platformEarningsNet: round2(platformEarningsGross - couponCostNet),
    sellerEarnings: {
      total: round2(sum("SELLER", "net")),
      pending: round2(sum("SELLER", "net", "Pending")),
      onHold: round2(sum("SELLER", "net", "OnHold")),
      paid: round2(sum("SELLER", "net", "Paid")),
    },
    refunds: { gateway, wallet, total: round2(gateway + wallet), returnRecords: retAgg?.count || 0 },
    codPending: {
      riders: round2(riderDebt?.total || 0),
      courier: courier.codPendingFromCourier,
      courierReceived: round2(remitAgg?.received || 0),
    },
    tips: { collected: tipsCollected, creditedToRiders: tipsCredited, notYetCredited: round2(tipsCollected - tipsCredited) },
  };
};

/** Sales (net merchandise of qualifying orders) per IST day for [start, end). */
export const getDailyNetSales = async (start: Date, end: Date) => {
  const rows = await Order.aggregate([
    { $match: qualifyingOrderMatch({ from: start, to: end }) },
    { $lookup: { from: "orderitems", localField: "_id", foreignField: "order", as: "it" } },
    {
      $project: {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate", timezone: IST_TZ } },
        merch: {
          $sum: {
            $map: {
              input: { $filter: { input: "$it", as: "i", cond: { $ne: ["$$i.status", "Cancelled"] } } },
              as: "i",
              in: { $ifNull: ["$$i.total", 0] },
            },
          },
        },
        discount: { $ifNull: ["$discount", 0] },
      },
    },
    { $group: { _id: "$day", value: { $sum: { $subtract: ["$merch", "$discount"] } } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, value: round2(r.value) }));
};
