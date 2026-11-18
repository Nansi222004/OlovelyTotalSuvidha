/**
 * Step 2 — partial cancellation & refunds. Fully isolated.
 *
 * NEVER reads MONGODB_URI/MONGO_URI: starts an in-memory MongoDB replica set. Shipping is forced
 * to the mock provider and Shiprocket credentials are removed, so no external call is possible.
 * Every expected value is computed by hand from the business rules, not by the implementation.
 *
 * Run: npm run test:partial-cancellation
 */
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

delete process.env.MONGODB_URI;
delete process.env.MONGO_URI;
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;
process.env.SHIPPING_PROVIDER = "mock";
process.env.NODE_ENV = "test";
process.env.USE_MOCK_PAYMENT = "true";
process.env.FINANCE_SCHEDULER_ENABLED = "false";

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Product from "../models/Product";
import Refund from "../models/Refund";
import PlatformWallet from "../models/PlatformWallet";
import WalletTransaction from "../models/WalletTransaction";
import AppSettings from "../models/AppSettings";
import * as paymentService from "../services/paymentService";
import * as refundService from "../services/refundSettlementService";
import { settleCancelledOrderItems } from "../services/orderPartCancellationService";
import { handleShippingWebhook } from "../services/shipping/shippingService";
import { computeCourierGroupCodAmounts } from "../services/courierCodService";
import { areAllFulfillmentGroupsDelivered } from "../utils/fulfillmentStatus";

type Result = { id: string; name: string; pass: boolean; detail: string };
const results: Result[] = [];
const near = (a: number, b: number) => Math.abs((Number(a) || 0) - b) < 0.011;
async function check(id: string, name: string, fn: () => Promise<string | void>) {
  try {
    results.push({ id, name, pass: true, detail: (await fn()) || "" });
  } catch (e: any) {
    results.push({ id, name, pass: false, detail: (process.env.AUDIT_DEBUG ? e?.stack : e?.message) || String(e) });
  }
}
function expectEq(label: string, actual: any, expected: number) {
  if (!near(actual, expected)) throw new Error(`${label}: expected ₹${expected}, got ₹${actual}`);
}
function expectTrue(label: string, value: any) {
  if (!value) throw new Error(label);
}

let seq = 0;
const uniq = () => `${Date.now()}${++seq}`;
const mkCustomer = (walletAmount = 0) => {
  const u = uniq();
  return Customer.create({ name: `Cust ${u}`, email: `c${u}@t.test`, phone: `9${u.slice(-9)}`, walletAmount });
};
const mkSeller = () => {
  const u = uniq();
  return Seller.create({
    sellerName: `Seller ${u}`, storeName: `Store ${u}`, email: `s${u}@t.test`, mobile: `8${u.slice(-9)}`,
    category: "General", commissionRate: 10, commission: 10, balance: 0, onHoldBalance: 0, status: "Approved",
  });
};
const mkProduct = (seller: any, price: number) =>
  Product.create({
    productName: `Prod ${uniq()}`, price, discPrice: price, stock: 100, isReturnable: true, maxReturnDays: 7,
    seller: seller._id, category: new mongoose.Types.ObjectId(), headerCategoryId: new mongoose.Types.ObjectId(),
  });
const stockOf = async (p: any) => Number(((await Product.findById(p._id).lean()) as any).stock);
const refundedTotal = async (o: any) =>
  Math.round((await Refund.find({ order: o._id, status: "Completed" }).lean()).reduce((s, r: any) => s + r.amount, 0) * 100) / 100;

type Line = { key: string; price: number; qty?: number; qc?: boolean };
type GroupSpec = { id: string; courier?: boolean; keys: string[]; shippingFee: number; status?: string; booked?: boolean; codAmount?: number };

/** Builds an order exactly like checkout stores it; returns order, items by key, products by key. */
async function mkOrder(cust: any, lines: Line[], groups: GroupSpec[], opts: {
  paymentMethod?: string; platformFee?: number; discount?: number; tipAmount?: number; walletAmountUsed?: number; orderType?: string;
} = {}) {
  const items: Record<string, any> = {};
  const products: Record<string, any> = {};
  const sellers: Record<string, any> = {};
  const order: any = new Order({
    orderNumber: `ORD${uniq()}`, customer: cust._id, customerName: cust.name, customerEmail: cust.email,
    customerPhone: cust.phone, deliveryAddress: { address: "Street", city: "Indore", pincode: "452001" },
    subtotal: 0, tax: 0, shipping: 0, platformFee: opts.platformFee ?? 2, discount: opts.discount ?? 0, total: 0,
    paymentMethod: opts.paymentMethod ?? "Online", paymentStatus: "Pending", status: "Accepted", items: [],
    tipAmount: opts.tipAmount ?? 0, orderType: opts.orderType ?? "QUICK_COMMERCE",
  });
  await order.save();
  let subtotal = 0;
  for (const l of lines) {
    const seller = await mkSeller();
    const prod = await mkProduct(seller, l.price);
    const qty = l.qty ?? 1;
    const it = await OrderItem.create({
      order: order._id, product: prod._id, seller: seller._id, productName: prod.productName,
      unitPrice: l.price, quantity: qty, total: l.price * qty, commissionRate: 10, status: "Pending",
      productType: l.qc === false ? "ECOMMERCE" : "QUICK_COMMERCE",
      fulfillmentType: l.qc === false ? "COURIER_SHIPPING" : "LOCAL_DELIVERY",
    });
    order.items.push(it._id);
    items[l.key] = it; products[l.key] = prod; sellers[l.key] = seller;
    subtotal += l.price * qty;
  }
  let shipping = 0;
  order.fulfillmentGroups = groups.map((g) => {
    shipping += g.shippingFee;
    return {
      groupId: g.id,
      fulfillmentType: g.courier ? "COURIER_SHIPPING" : "LOCAL_DELIVERY",
      items: g.keys.map((k) => items[k]._id),
      subtotal: g.keys.reduce((s, k) => s + items[k].total, 0),
      shippingFee: g.shippingFee,
      status: g.status ?? (g.courier ? "Shipped" : "Processing"),
      ...(g.courier && g.booked !== false
        ? {
            shippingDetails: { awbNumber: `AWB${uniq()}`, carrier: "Mock" },
            thirdPartyOrderDetails: { providerId: "mock_provider", externalOrderId: `${uniq()}`, status: "Manifested", ...(g.codAmount !== undefined ? { codAmount: g.codAmount } : {}) },
          }
        : {}),
    };
  });
  order.subtotal = subtotal;
  order.shipping = shipping;
  order.total = subtotal - (opts.discount ?? 0) + shipping + (opts.platformFee ?? 2) + (opts.tipAmount ?? 0);
  order.walletAmountUsed = opts.walletAmountUsed ?? 0;
  if (order.paymentMethod === "COD") { order.codAmountPending = order.total - order.walletAmountUsed; order.onlineAmountPaid = 0; }
  else if (order.paymentMethod === "Online") order.onlineAmountPaid = order.total - order.walletAmountUsed;
  else if (order.paymentMethod === "Wallet") { order.paymentStatus = "Paid"; order.onlineAmountPaid = 0; order.codAmountPending = 0; }
  await order.save();
  return { order, items, products, sellers };
}
async function payMock(order: any) {
  const r = await paymentService.capturePayment(order._id.toString(), `order_mock_${uniq()}`, `pay_mock_${uniq()}`, `sig_mock_${uniq()}`);
  if (!r.success) throw new Error(`mock capture failed: ${r.message}`);
  return Order.findById(order._id);
}

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  try {
    await mongoose.connect(replSet.getUri("olovely_partial_cancellation_isolated"));
    await import("../models/CashCollection");
    await import("../models/CourierCodSettlement");
    await import("../models/GatewayRefundIntent");
    await import("../models/ProcessedWebhookEvent");
    await import("../models/InventoryTransaction");
    for (const m of Object.values(mongoose.models)) {
      await (m as any).createCollection().catch(() => undefined);
      await (m as any).init().catch(() => undefined);
    }
    await AppSettings.create({ appName: "Olovely", businessName: "Olovely", contactEmail: "x@t.test", contactPhone: "9999999999" });
    await PlatformWallet.create({ totalPlatformEarning: 0, currentPlatformBalance: 0, totalAdminEarning: 0, pendingFromDeliveryBoy: 0, sellerPendingPayouts: 0, deliveryBoyPendingPayouts: 0 });
    await WalletTransaction.syncIndexes();

    // P01 — prepaid multi-seller, one seller rejects: refund only that item (₹200; delivery fee
    // stays because the shared QC delivery still happens); stock back; only that commission cancelled.
    let p01: any;
    await check("P01", "Prepaid multi-seller partial reject refunds only the rejected item", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "A", price: 300 }, { key: "B", price: 200 }], [{ id: "QC", keys: ["A", "B"], shippingFee: 40 }]);
      p01 = o;
      await payMock(o.order); // ₹542 captured; Pending commissions created for A and B
      await OrderItem.updateOne({ _id: o.items.B._id }, { $set: { status: "Cancelled", sellerStatus: "Rejected" } }); // what seller reject does
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.B._id.toString()], { reason: "Seller rejected" });
      expectTrue(`mode partial (got ${r.mode}: ${r.message})`, r.success && r.mode === "partial");
      expectEq("refund", r.refunded, 200);
      expectEq("Refund docs", await refundedTotal(o.order), 200);
      const pay: any = await Payment.findOne({ order: o.order._id }).lean();
      expectEq("gateway refunded", pay.refundAmount, 200);
      expectEq("stock B restored", await stockOf(o.products.B), 101);
      expectEq("stock A untouched", await stockOf(o.products.A), 100);
      const commB: any = await Commission.findOne({ orderItem: o.items.B._id, type: "SELLER" }).lean();
      const commA: any = await Commission.findOne({ orderItem: o.items.A._id, type: "SELLER" }).lean();
      expectTrue(`commission B cancelled (got ${commB?.status})`, commB?.status === "Cancelled");
      expectTrue(`commission A still pending (got ${commA?.status})`, commA?.status === "Pending");
      const fresh: any = await Order.findById(o.order._id).lean();
      expectTrue(`order still active (got ${fresh.status})`, fresh.status === "Accepted");
      expectTrue(`payment not fully refunded (got ${fresh.paymentStatus})`, fresh.paymentStatus === "Paid");
      return "refund ₹200, stock 100→101, commission B cancelled";
    });

    // P02 — the same settlement again (webhook retry / overlapping caller) changes nothing.
    await check("P02", "Settlement is idempotent (second call is a no-op)", async () => {
      const r = await settleCancelledOrderItems(p01.order._id.toString(), [p01.items.B._id.toString()]);
      expectTrue(`mode none (got ${r.mode})`, r.mode === "none");
      expectEq("Refund docs", await refundedTotal(p01.order), 200);
      expectEq("stock B", await stockOf(p01.products.B), 101);
      return "no double refund, no double stock";
    });

    // P03 — partial then the customer cancels the rest: the full cancellation refunds only the
    // remaining ₹342, never the full ₹542 again.
    await check("P03", "Full cancel after a partial refund refunds only what is left", async () => {
      const res = await refundService.handleOnlineOrderCancellation(p01.order._id.toString(), "Customer cancelled");
      expectTrue(`full cancel ok (${res.message})`, res.success);
      expectEq("online refunded now", res.data?.onlineRefunded, 342);
      const pay: any = await Payment.findOne({ order: p01.order._id }).lean();
      expectEq("gateway refunded in total", pay.refundAmount, 542);
      return "₹200 + ₹342 = ₹542 paid";
    });

    // P04 — COD, one seller rejects, ₹50 coupon on ₹500 of items: the cash still to collect
    // drops by 200 − (50 × 200/500 = 20) = ₹180, nothing is refunded.
    await check("P04", "COD partial reject lowers the cash to collect (coupon-aware)", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "A", price: 300 }, { key: "B", price: 200 }], [{ id: "QC", keys: ["A", "B"], shippingFee: 40 }],
        { paymentMethod: "COD", discount: 50 }); // total 300+200−50+40+2 = 492
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.B._id.toString()]);
      expectEq("refund", r.refunded, 0);
      expectEq("COD reduced", r.codReduced, 180);
      const fresh: any = await Order.findById(o.order._id).lean();
      expectEq("COD still to collect", fresh.codAmountPending, 312);
      return "₹492 → ₹312 to collect";
    });

    // P05 — mixed COD, carrier cancels the courier part (₹200 + ₹40 shipping): COD drops by ₹240;
    // the rider part (₹100 + ₹20 + tip ₹10) is untouched; the cancelled shipment collects nothing.
    await check("P05", "Mixed COD: cancelled courier part lowers COD; courier collects nothing", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "A", price: 100 }, { key: "C", price: 200, qc: false }],
        [{ id: "QC", keys: ["A"], shippingFee: 20 }, { id: "EC", courier: true, keys: ["C"], shippingFee: 40, codAmount: 242, status: "Cancelled" }],
        { paymentMethod: "COD", tipAmount: 10, orderType: "MIXED" }); // 100+200+20+40+2+10 = 372
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.C._id.toString()], { reason: "Courier shipment was cancelled" });
      expectEq("COD reduced", r.codReduced, 240);
      const fresh: any = await Order.findById(o.order._id).populate("items").lean();
      expectEq("COD still to collect", fresh.codAmountPending, 132);
      expectTrue("cancelled courier shipment collects nothing", (await computeCourierGroupCodAmounts(fresh)).size === 0);
      expectTrue(`order still active (got ${fresh.status})`, fresh.status === "Accepted");
      return "₹372 → ₹132 (rider ₹130 + platform fee ₹2)";
    });

    // P06 — prepaid mixed, the QC seller rejects: refund ₹100 item + ₹20 QC delivery + ₹10 tip
    // (no QC part is left to deliver it) = ₹130.
    await check("P06", "Prepaid mixed: QC part rejected refunds item + QC delivery + tip", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "A", price: 100 }, { key: "C", price: 200, qc: false }],
        [{ id: "QC", keys: ["A"], shippingFee: 20 }, { id: "EC", courier: true, keys: ["C"], shippingFee: 40 }],
        { tipAmount: 10, orderType: "MIXED" }); // 372 online
      await payMock(o.order);
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.A._id.toString()]);
      expectEq("refund", r.refunded, 130);
      const fresh: any = await Order.findById(o.order._id).lean();
      const qc = fresh.fulfillmentGroups.find((g: any) => g.groupId === "QC");
      expectTrue(`QC group cancelled (got ${qc.status})`, qc.status === "Cancelled");
      return "refund ₹130, QC shipment closed";
    });

    // P07 — prepaid mixed, QC already delivered, carrier cancels the courier part: refund ₹240
    // and the order COMPLETES (Delivered) so the delivered seller is paid; the cancelled item is not.
    await check("P07", "Cancelled courier part on an otherwise delivered order completes the order", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "A", price: 100 }, { key: "C", price: 200, qc: false }],
        [{ id: "QC", keys: ["A"], shippingFee: 20 }, { id: "EC", courier: true, keys: ["C"], shippingFee: 40 }],
        { orderType: "MIXED" }); // 362 online
      await payMock(o.order);
      await Order.updateOne({ _id: o.order._id, "fulfillmentGroups.groupId": "QC" }, { $set: { "fulfillmentGroups.$.status": "Delivered" } });
      await Order.updateOne({ _id: o.order._id, "fulfillmentGroups.groupId": "EC" }, { $set: { "fulfillmentGroups.$.status": "Cancelled" } });
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.C._id.toString()]);
      expectEq("refund", r.refunded, 240);
      expectTrue("order completed", r.orderCompleted);
      const fresh: any = await Order.findById(o.order._id).lean();
      expectTrue(`order Delivered (got ${fresh.status})`, fresh.status === "Delivered");
      const commA: any = await Commission.findOne({ orderItem: o.items.A._id, type: "SELLER" }).lean();
      const commC: any = await Commission.findOne({ orderItem: o.items.C._id, type: "SELLER" }).lean();
      expectTrue(`delivered item's commission settled (got ${commA?.status})`, commA && commA.status !== "Pending" && commA.status !== "Cancelled");
      expectTrue(`cancelled item's commission cancelled (got ${commC?.status})`, commC?.status === "Cancelled");
      return `Delivered; A commission ${commA.status}, C cancelled`;
    });

    // P08 — wallet-only order, every item rejected (full mode): the full ₹102 comes back to the
    // wallet, order Cancelled + Refunded, stock restored. (Before step 2 wallet orders got nothing.)
    await check("P08", "All items rejected on a wallet-paid order refunds the wallet in full", async () => {
      const c = await mkCustomer(0);
      const o = await mkOrder(c, [{ key: "A", price: 100 }], [{ id: "QC", keys: ["A"], shippingFee: 0 }],
        { paymentMethod: "Wallet", walletAmountUsed: 102 }); // 100 + 2 fee
      await OrderItem.updateOne({ _id: o.items.A._id }, { $set: { status: "Cancelled", sellerStatus: "Rejected" } });
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.A._id.toString()]);
      expectTrue(`mode full (got ${r.mode})`, r.mode === "full");
      expectEq("refund", r.refunded, 102);
      const fresh: any = await Order.findById(o.order._id).lean();
      expectTrue(`Cancelled (got ${fresh.status})`, fresh.status === "Cancelled");
      expectTrue(`Refunded (got ${fresh.paymentStatus})`, fresh.paymentStatus === "Refunded");
      const cust: any = await Customer.findById(c._id).lean();
      expectEq("customer wallet", cust.walletAmount, 102);
      expectEq("stock", await stockOf(o.products.A), 101);
      return "wallet +₹102, order Cancelled/Refunded";
    });

    // P09 — courier-only prepaid order cancelled from the Shiprocket side (webhook CANCELED):
    // the whole order is cancelled and the full ₹242 refunded automatically.
    await check("P09", "Carrier cancellation webhook fully cancels and refunds a courier-only order", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "C", price: 200, qc: false }], [{ id: "EC", courier: true, keys: ["C"], shippingFee: 40 }],
        { orderType: "ECOMMERCE" }); // 242 online
      await payMock(o.order);
      const before: any = await Order.findById(o.order._id).lean();
      const awb = before.fulfillmentGroups[0].shippingDetails.awbNumber;
      await handleShippingWebhook({ awb, current_status: "CANCELED", eventId: `evt-${uniq()}` }, undefined, "shiprocket");
      const fresh: any = await Order.findById(o.order._id).lean();
      expectTrue(`Cancelled (got ${fresh.status})`, fresh.status === "Cancelled");
      expectTrue(`Refunded (got ${fresh.paymentStatus})`, fresh.paymentStatus === "Refunded");
      expectEq("Refund docs", await refundedTotal(o.order), 242);
      expectEq("stock", await stockOf(o.products.C), 101);
      // The same webhook again must not refund twice.
      await handleShippingWebhook({ awb, current_status: "CANCELED", eventId: `evt-${uniq()}` }, undefined, "shiprocket");
      expectEq("Refund docs after retry", await refundedTotal(o.order), 242);
      return "order Cancelled, ₹242 refunded once";
    });

    // P10 — a full cancellation via the old path (Refunded, no Refund doc) followed by a late
    // carrier webhook must never refund again.
    await check("P10", "Late carrier webhook after a customer cancellation refunds nothing", async () => {
      const c = await mkCustomer();
      const o = await mkOrder(c, [{ key: "C", price: 200, qc: false }], [{ id: "EC", courier: true, keys: ["C"], shippingFee: 40 }],
        { orderType: "ECOMMERCE" });
      await payMock(o.order);
      const res = await refundService.handleOnlineOrderCancellation(o.order._id.toString(), "Customer cancelled");
      expectTrue("full cancel ok", res.success);
      const r = await settleCancelledOrderItems(o.order._id.toString(), [o.items.C._id.toString()]);
      expectEq("extra refund", r.refunded, 0);
      const pay: any = await Payment.findOne({ order: o.order._id }).lean();
      expectEq("gateway refunded in total", pay.refundAmount, 242);
      return "no second refund";
    });

    // P11 — completion rule: a cancelled part counts as finished, but something must be delivered.
    await check("P11", "Order completion rule treats cancelled parts as finished", async () => {
      expectTrue("Delivered + Cancelled → complete", areAllFulfillmentGroupsDelivered([{ status: "Delivered" }, { status: "Cancelled" }]));
      expectTrue("Cancelled only → not delivered", !areAllFulfillmentGroupsDelivered([{ status: "Cancelled" }]));
      expectTrue("Delivered + Shipped → not complete", !areAllFulfillmentGroupsDelivered([{ status: "Delivered" }, { status: "Shipped" }]));
      return "3 cases";
    });
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.name}${r.detail ? `  —  ${r.detail}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
