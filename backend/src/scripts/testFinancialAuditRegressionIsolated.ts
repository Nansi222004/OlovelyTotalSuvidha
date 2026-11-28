/**
 * Financial audit regression suite (Nov 2026 audit) — fully isolated.
 *
 * This script NEVER reads MONGODB_URI/MONGO_URI: it starts an in-memory MongoDB replica set
 * (transactions supported) and cannot touch any external/production database.
 *
 * Every expected value below is computed by hand from the business rules, NOT by calling the
 * implementation under test.
 *
 * Run: node scripts/runTypeScriptTest.cjs src/scripts/testFinancialAuditRegressionIsolated.ts
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

delete process.env.MONGODB_URI;
delete process.env.MONGO_URI;
process.env.NODE_ENV = "test";
process.env.USE_MOCK_PAYMENT = "true";
process.env.RAZORPAY_WEBHOOK_SECRET = "isolated_webhook_secret";
process.env.FINANCE_SCHEDULER_ENABLED = "false";

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Commission from "../models/Commission";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Product from "../models/Product";
import Return from "../models/Return";
import PlatformWallet from "../models/PlatformWallet";
import WalletTransaction from "../models/WalletTransaction";
import AppSettings from "../models/AppSettings";
import * as paymentService from "../services/paymentService";
import * as commissionService from "../services/commissionService";
import * as refundService from "../services/refundSettlementService";
import * as couponService from "../services/couponService";
import * as courierCod from "../services/courierCodService";
import CourierCodSettlement from "../models/CourierCodSettlement";
import "../models/CourierCodRemittance";
import GatewayRefundIntent from "../models/GatewayRefundIntent";
import JobLock from "../models/JobLock";
import WithdrawRequest from "../models/WithdrawRequest";

type Result = { id: string; name: string; pass: boolean; detail: string };
const results: Result[] = [];
const near = (a: number, b: number) => Math.abs((Number(a) || 0) - b) < 0.011;

async function check(id: string, name: string, fn: () => Promise<string | void>) {
  try {
    const detail = (await fn()) || "";
    results.push({ id, name, pass: true, detail });
  } catch (e: any) {
    results.push({ id, name, pass: false, detail: (process.env.AUDIT_DEBUG ? e?.stack : e?.message) || String(e) });
  }
}
function expectEq(label: string, actual: any, expected: number) {
  if (!near(actual, expected)) throw new Error(`${label}: expected ₹${expected}, got ₹${actual}`);
}

let seq = 0;
const uniq = () => `${Date.now()}${++seq}`;

async function mkCustomer(walletAmount = 0) {
  const u = uniq();
  return Customer.create({ name: `Cust ${u}`, email: `c${u}@t.test`, phone: `9${u.slice(-9)}`, walletAmount });
}
async function mkSeller(rate = 10) {
  const u = uniq();
  return Seller.create({
    sellerName: `Seller ${u}`, storeName: `Store ${u}`, email: `s${u}@t.test`, mobile: `8${u.slice(-9)}`,
    category: "General", commissionRate: rate, commission: rate, balance: 0, onHoldBalance: 0, status: "Approved",
  });
}
async function mkRider() {
  const u = uniq();
  return Delivery.create({
    name: `Rider ${u}`, mobile: `7${u.slice(-9)}`, email: `r${u}@t.test`, password: "Password@123",
    commissionRate: 5, balance: 0, cashCollected: 0, pendingAdminPayout: 0,
    location: { type: "Point", coordinates: [75.8, 22.7] },
  });
}
async function mkProduct(seller: any, price: number, returnDays = 7) {
  return Product.create({
    productName: `Prod ${uniq()}`, price, discPrice: price, stock: 100, isReturnable: returnDays > 0,
    maxReturnDays: returnDays, seller: seller._id, category: new mongoose.Types.ObjectId(),
    headerCategoryId: new mongoose.Types.ObjectId(),
  });
}
type Line = {
  prod: any; seller: any; qty: number; price: number; rate?: number; returnDays?: number;
  taxRate?: number; productType?: "QUICK_COMMERCE" | "ECOMMERCE"; fulfillmentType?: "LOCAL_DELIVERY" | "COURIER_SHIPPING";
};
async function mkOrder(cust: any, lines: Line[], opts: {
  paymentMethod?: string; shipping?: number; platformFee?: number; walletAmountUsed?: number;
  deliveryBoy?: any; deliveryPreference?: string; status?: string; paymentStatus?: string; deliveredDaysAgo?: number;
  discount?: number; tipAmount?: number; orderType?: string; groups?: boolean; smallCartFee?: number;
} = {}) {
  const shipping = opts.shipping ?? 40;
  const platformFee = opts.platformFee ?? 2;
  const order = new Order({
    orderNumber: `ORD${uniq()}`, customer: cust._id, customerName: cust.name, customerEmail: cust.email,
    customerPhone: cust.phone, deliveryAddress: { address: "Street", city: "Indore", pincode: "452001" },
    subtotal: 0, tax: 0, shipping, platformFee, discount: 0, total: 0,
    paymentMethod: opts.paymentMethod ?? "Online", paymentStatus: opts.paymentStatus ?? "Pending",
    status: opts.status ?? "Received", items: [], deliveryBoy: opts.deliveryBoy?._id,
    deliveryPreference: opts.deliveryPreference, tipAmount: opts.tipAmount ?? 0, smallCartFee: opts.smallCartFee ?? 0,
    orderType: opts.orderType ?? "QUICK_COMMERCE",
  });
  await order.save();
  let subtotal = 0;
  for (const l of lines) {
    const total = l.price * l.qty;
    subtotal += total;
    const it = await OrderItem.create({
      order: order._id, product: l.prod._id, seller: l.seller._id, productName: l.prod.productName,
      unitPrice: l.price, quantity: l.qty, total, commissionRate: l.rate ?? 10, status: "Pending",
      isReturnable: true, returnWindowDays: l.returnDays ?? 7,
      ...(l.taxRate ? { taxRate: l.taxRate, taxAmount: Math.round((total * l.taxRate / (100 + l.taxRate)) * 100) / 100 } : {}),
      ...(l.productType ? { productType: l.productType } : {}),
      ...(l.fulfillmentType ? { fulfillmentType: l.fulfillmentType } : {}),
    });
    order.items.push(it._id as any);
    (l as any)._itemId = it._id;
  }
  if (opts.groups) {
    const qc = lines.filter((l) => l.fulfillmentType !== "COURIER_SHIPPING");
    const ec = lines.filter((l) => l.fulfillmentType === "COURIER_SHIPPING");
    (order as any).fulfillmentGroups = [
      ...(qc.length ? [{ groupId: "QC", fulfillmentType: "LOCAL_DELIVERY", items: qc.map((l: any) => l._itemId), deliveryBoy: opts.deliveryBoy?._id,
        subtotal: qc.reduce((a, l) => a + l.price * l.qty, 0), shippingFee: shipping, status: "Delivered" }] : []),
      ...(ec.length ? [{ groupId: "EC", fulfillmentType: "COURIER_SHIPPING", items: ec.map((l: any) => l._itemId),
        subtotal: ec.reduce((a, l) => a + l.price * l.qty, 0), shippingFee: 0, status: "Delivered" }] : []),
    ];
  }
  order.subtotal = subtotal;
  order.discount = opts.discount ?? 0;
  order.total = subtotal - (opts.discount ?? 0) + shipping + platformFee + (opts.tipAmount ?? 0) + (opts.smallCartFee ?? 0);
  const wallet = opts.walletAmountUsed || 0;
  order.walletAmountUsed = wallet;
  if (order.paymentMethod === "COD") { order.codAmountPending = order.total - wallet; order.onlineAmountPaid = 0; }
  else if (order.paymentMethod === "Online") { order.onlineAmountPaid = order.total - wallet; }
  if (opts.deliveredDaysAgo !== undefined) order.deliveredAt = new Date(Date.now() - opts.deliveredDaysAgo * 86400000);
  await order.save();
  return order;
}
async function payMock(order: any) {
  const r = await paymentService.capturePayment(order._id.toString(), `order_mock_${uniq()}`, `pay_mock_${uniq()}`, `sig_mock_${uniq()}`);
  if (!r.success) throw new Error(`mock capture failed: ${r.message}`);
  return Order.findById(order._id);
}
async function markDelivered(order: any, daysAgo: number) {
  await Order.updateOne({ _id: order._id }, { $set: { status: "Delivered", deliveredAt: new Date(Date.now() - daysAgo * 86400000) } });
}
const sellerBal = async (s: any) => { const x: any = await Seller.findById(s._id).lean(); return { bal: x.balance || 0, hold: x.onHoldBalance || 0 }; };
const ledgerSum = async (userId: any, type: "Credit" | "Debit") => {
  const txs = await WalletTransaction.find({ userId, type }).lean();
  return Math.round(txs.reduce((s, t: any) => s + t.amount, 0) * 100) / 100;
};

async function run() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  try {
    await mongoose.connect(replSet.getUri("olovely_financial_audit_isolated"));
    // Pre-create collections: a fresh DB cannot implicitly create collections inside a
    // multi-document transaction while index builds race (production collections already exist).
    await import("../models/CashCollection");
    for (const m of Object.values(mongoose.models)) {
      await (m as any).createCollection().catch(() => undefined);
      await (m as any).init().catch(() => undefined);
    }
    await AppSettings.create({ appName: "Olovely", businessName: "Olovely", contactEmail: "x@t.test", contactPhone: "9999999999" });
    await PlatformWallet.create({ totalPlatformEarning: 0, currentPlatformBalance: 0, totalAdminEarning: 0, pendingFromDeliveryBoy: 0, sellerPendingPayouts: 0, deliveryBoyPendingPayouts: 0 });
    await WalletTransaction.syncIndexes();

    // F01 — held escrow (500 @10% → net 450) released exactly once, even if release runs twice
    await check("F01", "Escrow release credits seller once (₹450), ledger == balance", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0); // inside return window → held
      await commissionService.distributeCommissions(o._id.toString());
      const held = await sellerBal(s);
      expectEq("held", held.hold, 450);
      await Commission.updateMany({ order: o._id, status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      await Promise.all([commissionService.releaseExpiredEscrow(), commissionService.releaseExpiredEscrow()]); // concurrent
      await commissionService.releaseExpiredEscrow(); // and a third run must be a no-op
      const after = await sellerBal(s);
      expectEq("seller balance", after.bal, 450);
      expectEq("seller onHold", after.hold, 0);
      expectEq("ledger credits", await ledgerSum(s._id, "Credit"), 450);
      return `balance ₹${after.bal}, onHold ₹${after.hold}`;
    });

    // F02 — active hold then release for multi-item same seller (500 + 300 @10% → 450 + 270 = 720)
    await check("F02", "Multi-item escrow: held ₹720, release → balance ₹720, ledger ₹720", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p1 = await mkProduct(s, 500); const p2 = await mkProduct(s, 300);
      const o = await mkOrder(c, [{ prod: p1, seller: s, qty: 1, price: 500 }, { prod: p2, seller: s, qty: 1, price: 300 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const held = await sellerBal(s);
      expectEq("held", held.hold, 720);
      await Commission.updateMany({ order: o._id, type: "SELLER", status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      await commissionService.releaseExpiredEscrow();
      const after = await sellerBal(s);
      expectEq("balance", after.bal, 720); expectEq("onHold", after.hold, 0);
      expectEq("ledger", await ledgerSum(s._id, "Credit"), 720);
      return `held ₹${held.hold} → balance ₹${after.bal}`;
    });

    // F03 — B-7 (2026-11-12): no seller self-delivery fee. Rider-less prepaid order: seller gets product net ₹450 only
    await check("F03", "B-7: no self-delivery fee; product net ₹450 held then released, nothing stuck", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 40, platformFee: 0, deliveryPreference: "Self" });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const mid = await sellerBal(s);
      await Commission.updateMany({ order: o._id, status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      await commissionService.releaseExpiredEscrow();
      const end = await sellerBal(s);
      expectEq("final balance", end.bal, 450); expectEq("final onHold", end.hold, 0);
      return `mid bal ₹${mid.bal}/hold ₹${mid.hold}; end bal ₹${end.bal}/hold ₹${end.hold}`;
    });

    // F04 — COD multi-item settlement: items 500+300 @10%, shipping 40, fee 2 → rider owes 842; seller net 720
    await check("F04", "COD remittance ₹842 settles seller ₹720 once (B-5: into escrow); admin earning added once", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider();
      const p1 = await mkProduct(s, 500); const p2 = await mkProduct(s, 300);
      const o = await mkOrder(c, [{ prod: p1, seller: s, qty: 1, price: 500 }, { prod: p2, seller: s, qty: 1, price: 300 }],
        { paymentMethod: "COD", shipping: 40, platformFee: 2, deliveryBoy: r, status: "Delivered" });
      await commissionService.processCODOrderDelivery(o._id.toString(), undefined, r._id.toString());
      const rider: any = await Delivery.findById(r._id).lean();
      expectEq("rider owes", rider.pendingAdminPayout, 842);
      const pwBefore: any = await PlatformWallet.findOne().lean();
      const res = await commissionService.processPendingCODPayouts(r._id.toString(), 842);
      const pwAfter: any = await PlatformWallet.findOne().lean();
      const sb = await sellerBal(s);
      // B-5: inside the return window the COD earning is held, not withdrawable
      expectEq("seller held", sb.hold, 720);
      expectEq("seller available", sb.bal, 0);
      await commissionService.processPendingCODPayouts(r._id.toString(), 842); // repeat: no double settle
      await Commission.updateMany({ order: o._id, type: "SELLER", status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      await commissionService.releaseExpiredEscrow();
      const rel = await sellerBal(s);
      expectEq("released balance", rel.bal, 720);
      expectEq("ledger", await ledgerSum(s._id, "Credit"), 720);
      // admin earning = commission 80 + platform fee 2 + shipping 40 − rider share (5% of 800 = 40) = 82
      expectEq("admin earning delta", pwAfter.totalAdminEarning - pwBefore.totalAdminEarning, 82);
      expectEq("remaining", res.remainingAmount, 0);
      const pending = await Commission.countDocuments({ order: o._id, type: "SELLER", status: "Pending" });
      if (pending !== 0) throw new Error(`${pending} seller commissions still Pending`);
      return `seller ₹${sb.bal}, admin +₹${pwAfter.totalAdminEarning - pwBefore.totalAdminEarning}`;
    });

    // F05 — online return: refund once to source, never also to wallet
    await check("F05", "Online return refunds ₹500 to gateway only (wallet stays ₹0)", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 40, platformFee: 2 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const it: any = await OrderItem.findOne({ order: o._id });
      const ret = await Return.create({ order: o._id, orderItem: it._id, customer: c._id, type: "RETURN", reason: "Damaged", quantity: 1, status: "Approved" });
      const res = await refundService.executeReturnRefundAndReversal(ret._id.toString());
      if (!res.success) throw new Error(res.message);
      const cust: any = await Customer.findById(c._id).lean();
      const pay: any = await Payment.findOne({ order: o._id }).lean();
      expectEq("customer wallet", cust.walletAmount, 0);
      expectEq("gateway refunded", pay.refundAmount, 500);
      const sb = await sellerBal(s);
      expectEq("seller held after reversal", sb.hold, 0);
      return `wallet ₹${cust.walletAmount}, gateway ₹${pay.refundAmount}`;
    });

    // F06 — COD + wallet return: ₹100 wallet portion + ₹400 remainder both credited (₹500 total)
    await check("F06", "COD+wallet order return credits full ₹500 to wallet", async () => {
      const s = await mkSeller(); const c = await mkCustomer(0); const r = await mkRider(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { paymentMethod: "COD", walletAmountUsed: 100, deliveryBoy: r, status: "Delivered", paymentStatus: "Paid" });
      const it: any = await OrderItem.findOne({ order: o._id });
      const ret = await Return.create({ order: o._id, orderItem: it._id, customer: c._id, type: "RETURN", reason: "Wrong item", quantity: 1, status: "Approved" });
      const res = await refundService.executeReturnRefundAndReversal(ret._id.toString());
      if (!res.success) throw new Error(res.message);
      const cust: any = await Customer.findById(c._id).lean();
      expectEq("customer wallet", cust.walletAmount, 500);
      return `wallet ₹${cust.walletAmount}`;
    });

    // F07 — partial quantity return: 2 × ₹250 held (net 450); return 1 → hold 225; release → balance 225
    await check("F07", "Partial-qty return keeps remaining escrow releasable (₹225)", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 250);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 2, price: 250 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const it: any = await OrderItem.findOne({ order: o._id });
      const ret = await Return.create({ order: o._id, orderItem: it._id, customer: c._id, type: "RETURN", reason: "Extra", quantity: 1, status: "Approved" });
      const res = await refundService.executeReturnRefundAndReversal(ret._id.toString());
      if (!res.success) throw new Error(res.message);
      const mid = await sellerBal(s);
      expectEq("hold after partial return", mid.hold, 225);
      await Commission.updateMany({ order: o._id, status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      await commissionService.releaseExpiredEscrow();
      const end = await sellerBal(s);
      expectEq("balance", end.bal, 225); expectEq("hold", end.hold, 0);
      return `hold ₹${mid.hold} → balance ₹${end.bal}`;
    });

    // F08 — two partial refunds on one payment both execute (₹200 + ₹100 = ₹300)
    await check("F08", "Second partial refund is executed, cumulative ₹300", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 1000);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1000 }], { shipping: 0, platformFee: 0 });
      await payMock(o);
      const pay: any = await Payment.findOne({ order: o._id });
      const r1 = await paymentService.processRefund(pay._id.toString(), 200, "r1");
      const r2 = await paymentService.processRefund(pay._id.toString(), 100, "r2");
      const after: any = await Payment.findById(pay._id).lean();
      if (!r1.success || !r2.success) throw new Error("refund call failed");
      expectEq("cumulative refundAmount", after.refundAmount, 300);
      if (after.status === "Refunded") throw new Error("status should not be Refunded after partial refunds");
      return `refundAmount ₹${after.refundAmount}, status ${after.status}`;
    });

    // F09 — mock payment identifiers rejected in production
    await check("F09", "Mock payment signature rejected when NODE_ENV=production", async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const ok = paymentService.verifyPaymentSignature("order_x", "pay_mock_123", "anything");
        if (ok) throw new Error("pay_mock_ accepted in production");
      } finally { process.env.NODE_ENV = prev; }
      return "rejected";
    });

    // F10 — a payment captured for order A cannot mark order B as Paid
    await check("F10", "Payment id from order A cannot pay order B", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 10);
      const a = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 10 }], { shipping: 0, platformFee: 0 });
      const b = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 10 }], { shipping: 0, platformFee: 0 });
      const rzpOrder = `order_mock_${uniq()}`; const rzpPay = `pay_mock_${uniq()}`; const sig = `sig_mock_${uniq()}`;
      await paymentService.capturePayment(a._id.toString(), rzpOrder, rzpPay, sig);
      const res = await paymentService.capturePayment(b._id.toString(), rzpOrder, rzpPay, sig);
      const bAfter: any = await Order.findById(b._id).lean();
      if (res.success || bAfter.paymentStatus === "Paid") throw new Error("order B marked Paid with order A's payment");
      return res.message || "rejected";
    });

    // F11 — 100% wallet-paid order: seller earnings created on delivery
    await check("F11", "Wallet-paid order creates commission and holds seller net ₹450", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { paymentMethod: "Wallet", paymentStatus: "Paid", shipping: 0, platformFee: 0, walletAmountUsed: 500 });
      await markDelivered(o, 0);
      const res: any = await commissionService.distributeCommissions(o._id.toString());
      const sb = await sellerBal(s);
      const n = await Commission.countDocuments({ order: o._id, type: "SELLER" });
      if (n !== 1) throw new Error(`expected 1 seller commission, found ${n} (${res?.message})`);
      expectEq("seller held", sb.hold, 450);
      return `commissions ${n}, held ₹${sb.hold}`;
    });

    // F12 — partial refund webhook does not cancel a delivered order
    await check("F12", "Partial refund webhook keeps Delivered order Delivered", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 1000);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1000 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0);
      const pay: any = await Payment.findOne({ order: o._id });
      const body = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: pay.razorpayPaymentId, amount: 30000 } }, payment: { entity: { id: pay.razorpayPaymentId, amount_refunded: 30000 } } } };
      const raw = JSON.stringify(body);
      const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");
      const r = await paymentService.handleWebhook(body, sig, undefined, raw);
      const after: any = await Order.findById(o._id).lean();
      if (!r.success) throw new Error(r.message);
      if (after.status !== "Delivered") throw new Error(`order status became ${after.status}`);
      if (after.paymentStatus === "Refunded") throw new Error("paymentStatus flipped to Refunded on partial refund");
      return `status ${after.status}, paymentStatus ${after.paymentStatus}`;
    });

    // F13 — late payment.failed webhook does not cancel a Paid order
    await check("F13", "payment.failed after capture leaves Paid order intact", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 100);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 100 }], { shipping: 0, platformFee: 0 });
      await payMock(o);
      const pay: any = await Payment.findOne({ order: o._id });
      // simulate the payment record being moved back so the failure handler runs its order logic
      const body = { event: "payment.failed", payload: { payment: { entity: { id: pay.razorpayPaymentId, order_id: pay.razorpayOrderId, error_description: "x" } } } };
      const raw = JSON.stringify(body);
      const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");
      await paymentService.handleWebhook(body, sig, undefined, raw);
      const after: any = await Order.findById(o._id).lean();
      if (after.status === "Cancelled" || after.paymentStatus !== "Paid") throw new Error(`order now ${after.status}/${after.paymentStatus}`);
      return `${after.status}/${after.paymentStatus}`;
    });

    // F14 — reverseCommissions debits seller NET (₹450), not the commission (₹50)
    await check("F14", "reverseCommissions debits seller net ₹450", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500, 0);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500, returnDays: 0 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const mid = await sellerBal(s);
      expectEq("credited", mid.bal, 450);
      await commissionService.reverseCommissions(o._id.toString());
      const end = await sellerBal(s);
      expectEq("after reversal", end.bal, 0);
      return `₹${mid.bal} → ₹${end.bal}`;
    });

    // F15 — pure helpers (only present after the fix)
    await check("F15", "Tip sanitising and coupon scope/limits", async () => {
      const cs: any = couponService;
      if (typeof cs.sanitizeTipAmount !== "function" || typeof cs.computeCouponDiscount !== "function") {
        throw new Error("helpers missing (checkout trusted raw tip; coupon scope never evaluated)");
      }
      expectEq("negative tip", cs.sanitizeTipAmount(-500), 0);
      expectEq("NaN tip", cs.sanitizeTipAmount("abc"), 0);
      expectEq("tip 20.555", cs.sanitizeTipAmount(20.555), 20.56);
      expectEq("tip at cap", cs.sanitizeTipAmount(500), 500);
      expectEq("tip 99999 capped", cs.sanitizeTipAmount(99999), 500);
      const pA = new mongoose.Types.ObjectId().toString(); const pB = new mongoose.Types.ObjectId().toString();
      const lines = [{ productId: pA, total: 400 }, { productId: pB, total: 600 }];
      expectEq("product-scoped 10%", cs.computeCouponDiscount({ discountType: "Percentage", discountValue: 10, applicableTo: "Product", applicableIds: [pA] }, lines).discount, 40);
      expectEq("all 10% capped at 50", cs.computeCouponDiscount({ discountType: "Percentage", discountValue: 10, maximumDiscount: 50 }, lines).discount, 50);
      expectEq("flat 700 on eligible 400", cs.computeCouponDiscount({ discountType: "Flat", discountValue: 700, applicableTo: "Product", applicableIds: [pA] }, lines).discount, 400);
      expectEq("min purchase 2000 unmet", cs.computeCouponDiscount({ discountType: "Flat", discountValue: 100, minimumPurchase: 2000 }, lines).discount, 0);
      const c = await mkCustomer();
      await Order.create({ orderNumber: `ORD${uniq()}`, customer: c._id, customerName: "x", customerPhone: "9000000000", deliveryAddress: { address: "a", city: "b", pincode: "452001" }, subtotal: 1, total: 1, paymentMethod: "COD", status: "Delivered", couponCode: "WELCOME" });
      const limited = await cs.hasReachedPerUserCouponLimit({ code: "welcome", usageLimitPerUser: 1 }, c._id.toString());
      if (!limited) throw new Error("per-user limit not detected");
      return "ok";
    });

    // ───────────────────────── G-series: finalised business rules (2026-11-12) ─────────────────────────

    // G01 — B-3: commission on ex-GST value; platform coupon never reduces seller net
    await check("G01", "B-3: ₹1,180 incl. 18% GST @10% → commission ₹100, seller ₹1,080 even with ₹100 coupon", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 1180, 0);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1180, taxRate: 18, returnDays: 0 }], { shipping: 0, platformFee: 0, discount: 100 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const comm: any = await Commission.findOne({ order: o._id, type: "SELLER" }).lean();
      expectEq("commission", comm.commissionAmount, 100);
      const sb = await sellerBal(s);
      expectEq("seller credited (window 0 days)", sb.bal, 1080);
      const fm = await import("../services/financeMath");
      expectEq("taxable", fm.itemTaxableValue({ total: 1180, taxRate: 18 }), 1000);
      expectEq("no hardcoded rate (5%)", fm.itemSellerCommission({ total: 1050, taxRate: 5 }, 10), 100);
      return `commission ₹${comm.commissionAmount}, seller ₹${sb.bal}`;
    });

    // G02 — B-1: prepaid tip credited 100% to the delivering rider exactly once
    await check("G02", "B-1: prepaid ₹30 tip → rider once (two distributions), not in platform earnings", async () => {
      const kpi = await import("../services/financeKpiService");
      const k0 = await kpi.getFinanceKpis();
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 40, platformFee: 2, deliveryBoy: r, tipAmount: 30 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      await commissionService.distributeCommissions(o._id.toString());
      const tips = await WalletTransaction.countDocuments({ reference: `TIP_${o._id}` });
      if (tips !== 1) throw new Error(`expected 1 tip credit, found ${tips}`);
      const rider: any = await Delivery.findById(r._id).lean();
      expectEq("rider wallet = 5% of 500 + tip", rider.balance, 25 + 30);
      const k1 = await kpi.getFinanceKpis();
      // platform: commission 50 + fee 2 + shipping 40 − rider 25 = 67 (tip excluded)
      expectEq("platform earnings gross delta", k1.platformEarningsGross - k0.platformEarningsGross, 67);
      expectEq("tips collected delta", k1.tips.collected - k0.tips.collected, 30);
      expectEq("tips credited delta", k1.tips.creditedToRiders - k0.tips.creditedToRiders, 30);
      return `rider ₹${rider.balance} (25 earning + 30 tip)`;
    });

    // G03 — B-1: COD tip credited once even when delivery is recorded twice
    await check("G03", "B-1: COD ₹20 tip credited once; rider owes full cash", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider(); const p = await mkProduct(s, 200);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 200 }], { paymentMethod: "COD", shipping: 40, platformFee: 0, deliveryBoy: r, status: "Delivered", tipAmount: 20 });
      await commissionService.processCODOrderDelivery(o._id.toString(), undefined, r._id.toString());
      await commissionService.processCODOrderDelivery(o._id.toString(), undefined, r._id.toString());
      const rider: any = await Delivery.findById(r._id).lean();
      expectEq("rider owes", rider.pendingAdminPayout, 260);
      expectEq("rider wallet = 5% of 200 + 20 tip", rider.balance, 10 + 20);
      return `owes ₹${rider.pendingAdminPayout}, wallet ₹${rider.balance}`;
    });

    // G04 — B-4: courier COD is never credited before a verified remittance; batch is idempotent
    await check("G04", "B-4: Shiprocket COD pending until verified remittance; mismatch/duplicate rejected", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 1000);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1000, productType: "ECOMMERCE", fulfillmentType: "COURIER_SHIPPING" }],
        { paymentMethod: "COD", shipping: 40, platformFee: 2, status: "Delivered", orderType: "ECOMMERCE" });
      await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      await commissionService.distributeCommissions(o._id.toString()); // webhook + admin both fire
      const st: any = await CourierCodSettlement.findOne({ order: o._id }).lean();
      if (!st || st.status !== "PENDING_REMITTANCE") throw new Error("no pending courier settlement");
      expectEq("courier COD", st.codAmount, 1042);
      const before = await sellerBal(s);
      expectEq("seller nothing before remittance", before.bal + before.hold, 0);
      const admin = new mongoose.Types.ObjectId().toString();
      let rejected = false;
      try { await courierCod.verifyCourierCodRemittance({ reference: "UTR1", remittanceDate: new Date(), amountReceived: 1000, courierCharges: 0, orderIds: [o._id.toString()], adminId: admin }); }
      catch { rejected = true; }
      if (!rejected) throw new Error("mismatched remittance accepted");
      const ok = await courierCod.verifyCourierCodRemittance({ reference: "UTR1", remittanceDate: new Date(), amountReceived: 1012, courierCharges: 30, orderIds: [o._id.toString()], adminId: admin });
      let dup = false;
      try { await courierCod.verifyCourierCodRemittance({ reference: "UTR2", remittanceDate: new Date(), amountReceived: 1042, courierCharges: 0, orderIds: [o._id.toString()], adminId: admin }); }
      catch { dup = true; }
      if (!dup) throw new Error("order remitted twice");
      const after = await sellerBal(s);
      expectEq("seller held (return window)", after.hold, 900);
      expectEq("seller available", after.bal, 0);
      const ord: any = await Order.findById(o._id).lean();
      if (!ord.codPaidToAdminAt) throw new Error("codPaidToAdminAt not set");
      return `held ₹${after.hold}; batch ${ok.remittanceId}`;
    });

    // G05 — B-4 + R-04: MIXED COD — rider cash settles only the QC item; courier item waits
    await check("G05", "MIXED COD: rider remittance settles QC item only; courier item waits for remittance", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider();
      const pq = await mkProduct(s, 300); const pe = await mkProduct(s, 700);
      const o = await mkOrder(c, [
        { prod: pq, seller: s, qty: 1, price: 300, productType: "QUICK_COMMERCE", fulfillmentType: "LOCAL_DELIVERY" },
        { prod: pe, seller: s, qty: 1, price: 700, productType: "ECOMMERCE", fulfillmentType: "COURIER_SHIPPING" },
      ], { paymentMethod: "COD", shipping: 40, platformFee: 0, deliveryBoy: r, status: "Delivered", orderType: "MIXED", groups: true });
      await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const rider: any = await Delivery.findById(r._id).lean();
      expectEq("rider owes QC part (300 + 40)", rider.pendingAdminPayout, 340);
      await commissionService.processPendingCODPayouts(r._id.toString(), 340);
      const mid = await sellerBal(s);
      expectEq("QC net held after rider cash", mid.hold, 270);
      const st: any = await CourierCodSettlement.findOne({ order: o._id }).lean();
      expectEq("courier part", st.codAmount, 700);
      const ecomComm: any = await Commission.findOne({ order: o._id, settlementChannel: "COURIER_COD" }).lean();
      if (ecomComm.status !== "Pending") throw new Error(`courier commission ${ecomComm.status} before remittance`);
      await courierCod.verifyCourierCodRemittance({ reference: "UTR-MIX", remittanceDate: new Date(), amountReceived: 700, courierCharges: 0, orderIds: [o._id.toString()], adminId: new mongoose.Types.ObjectId().toString() });
      const end = await sellerBal(s);
      expectEq("both held", end.hold, 900);
      return `after rider ₹${mid.hold}, after remittance ₹${end.hold}`;
    });

    // G06 — B-5 / R-05: escrow is not released while a return is open
    await check("G06", "B-5: expired hold with open return stays locked; released after return rejected", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 0, platformFee: 0 });
      await payMock(o); await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      await Commission.updateMany({ order: o._id, status: "OnHold" }, { $set: { onHoldUntil: new Date(Date.now() - 1000) } });
      const it: any = await OrderItem.findOne({ order: o._id });
      const ret = await Return.create({ order: o._id, orderItem: it._id, customer: c._id, type: "RETURN", reason: "x", quantity: 1, status: "Pending" });
      const r1 = await commissionService.releaseExpiredEscrow({ sellerId: s._id.toString() });
      const mid = await sellerBal(s);
      expectEq("still held", mid.hold, 450);
      if (r1.skippedOpenReturn !== 1) throw new Error("open return not reported as skipped");
      await Return.updateOne({ _id: ret._id }, { $set: { status: "Rejected" } });
      await commissionService.releaseExpiredEscrow({ sellerId: s._id.toString() });
      const end = await sellerBal(s);
      expectEq("released", end.bal, 450);
      return `held ₹${mid.hold} → available ₹${end.bal}`;
    });

    // G07 — B-5: COD whose window already expired when cash arrives is credited directly
    await check("G07", "B-5: COD cash remitted after window → withdrawable immediately", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { paymentMethod: "COD", shipping: 0, platformFee: 0, deliveryBoy: r, status: "Delivered", deliveredDaysAgo: 10 });
      await commissionService.processCODOrderDelivery(o._id.toString(), undefined, r._id.toString());
      await commissionService.processPendingCODPayouts(r._id.toString(), 500);
      const sb = await sellerBal(s);
      expectEq("available", sb.bal, 450); expectEq("held", sb.hold, 0);
      return `available ₹${sb.bal}`;
    });

    // G08 — R-11: concurrent withdrawal requests cannot spend the same funds
    await check("G08", "R-11: two concurrent ₹800 requests on ₹1,000 → one succeeds; reject releases reservation", async () => {
      const s = await mkSeller();
      await Seller.updateOne({ _id: s._id }, { $set: { balance: 1000, bankName: "SBI", accountNumber: "1234567890", ifsc: "SBIN0000001" } });
      const wm = await import("../services/walletManagementService");
      const [a, b] = await Promise.all([
        wm.createWithdrawalRequest(s._id.toString(), "SELLER", 800, "Bank Transfer"),
        wm.createWithdrawalRequest(s._id.toString(), "SELLER", 800, "Bank Transfer"),
      ]);
      const okCount = [a, b].filter((x: any) => x.success).length;
      if (okCount !== 1) throw new Error(`${okCount} requests succeeded`);
      const mid: any = await Seller.findById(s._id).lean();
      expectEq("reserved", mid.pendingWithdrawalAmount, 800);
      expectEq("withdrawable", await wm.getWithdrawableBalance(s._id.toString(), "SELLER"), 200);
      const req: any = await WithdrawRequest.findOne({ userId: s._id });
      await wm.releaseWithdrawalReservation(req);
      const end: any = await Seller.findById(s._id).lean();
      expectEq("released", end.pendingWithdrawalAmount, 0);
      return `1 of 2 accepted, reserved ₹${mid.pendingWithdrawalAmount}`;
    });

    // G09 — R-06: an aborted transaction after a gateway refund never refunds twice
    await check("G09", "R-06: refund in aborted txn + retry → one gateway refund, cumulative applied once", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 1000);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1000 }], { shipping: 0, platformFee: 0 });
      await payMock(o);
      const pay: any = await Payment.findOne({ order: o._id });
      const key = `RETURN_TEST_${uniq()}`;
      const session = await mongoose.startSession();
      session.startTransaction();
      const r1 = await paymentService.processRefund(pay._id.toString(), 250, "t", session, key);
      await session.abortTransaction(); await session.endSession(); // business txn failed AFTER gateway success
      const rolled: any = await Payment.findById(pay._id).lean();
      expectEq("payment rolled back", rolled.refundAmount || 0, 0);
      const r2 = await paymentService.processRefund(pay._id.toString(), 250, "t", undefined, key); // retry
      const r3 = await paymentService.processRefund(pay._id.toString(), 250, "t", undefined, key); // late duplicate
      const after: any = await Payment.findById(pay._id).lean();
      const intents = await GatewayRefundIntent.find({ key }).lean();
      if (!r1.success || !r2.success || !r3.success) throw new Error("refund call failed");
      if (intents.length !== 1 || intents[0].status !== "SUCCEEDED") throw new Error("intent not unique/succeeded");
      if (r1.data?.refundId !== r2.data?.refundId) throw new Error("retry produced a new gateway refund");
      expectEq("refundAmount", after.refundAmount, 250);
      return `one refund ${r2.data?.refundId}, Payment ₹${after.refundAmount}`;
    });

    // G10 — R-07: unique index blocks duplicate seller commissions under concurrency
    await check("G10", "R-07: unique index + concurrent creators → one seller commission per item", async () => {
      const mig = await import("./migrations/createCommissionUniqueIndexes");
      const d = await mig.findDuplicateCommissions();
      if (d.seller.length || d.rider.length) throw new Error("fixture DB already has duplicates");
      await mig.createCommissionUniqueIndexes();
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 400);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 400 }], { shipping: 0, platformFee: 0 });
      const items = await OrderItem.find({ order: o._id });
      const ss = await import("../services/sellerSettlementService");
      await Promise.all([1, 2, 3].map(() => ss.ensureSellerCommissions(o._id.toString(), items, "PREPAID")));
      const n = await Commission.countDocuments({ order: o._id, type: "SELLER" });
      if (n !== 1) throw new Error(`${n} seller commissions`);
      let blocked = false;
      try { await Commission.create({ order: o._id, orderItem: items[0]._id, seller: s._id, type: "SELLER", orderAmount: 400, commissionRate: 10, commissionAmount: 40 }); }
      catch (e: any) { blocked = e?.code === 11000; }
      if (!blocked) throw new Error("duplicate insert not blocked by index");
      return "1 record, duplicate blocked";
    });

    // G11 — R-09: unpaid online order cancellation is not a refund; capture records real amount
    await check("G11", "R-09: unpaid online cancel stays unpaid; webhook capture stores captured amount", async () => {
      const c = await mkCustomer(); const s = await mkSeller(); const p = await mkProduct(s, 600);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 600 }], { shipping: 0, platformFee: 0, status: "Pending" });
      await Order.updateOne({ _id: o._id }, { $set: { onlineAmountDue: 600, onlineAmountPaid: 600 } }); // legacy-style intended amount
      const res = await refundService.handleOnlineOrderCancellation(o._id.toString(), "test");
      const after: any = await Order.findById(o._id).lean();
      if (!res.success) throw new Error(res.message);
      if (after.paymentStatus === "Refunded") throw new Error("unpaid order reported as Refunded");
      if ((res.data as any)?.onlineRefunded) throw new Error("refunded money never received");
      // webhook: wallet ₹100 + online ₹400 → Payment.amount must be 400 (captured), not 500
      const c2 = await mkCustomer();
      const o2 = await mkOrder(c2, [{ prod: p, seller: s, qty: 1, price: 500 }], { shipping: 0, platformFee: 0, walletAmountUsed: 100, status: "Pending" });
      await Order.updateOne({ _id: o2._id }, { $set: { onlineAmountDue: 400, onlineAmountPaid: 0 } });
      const body = { event: "payment.captured", payload: { payment: { entity: { id: `pay_mock_${uniq()}`, order_id: `order_mock_${uniq()}`, amount: 40000, notes: { orderId: o2._id.toString() } } } } };
      const raw = JSON.stringify(body);
      const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");
      await paymentService.handleWebhook(body, sig, undefined, raw);
      const pay2: any = await Payment.findOne({ order: o2._id }).lean();
      const o2a: any = await Order.findById(o2._id).lean();
      expectEq("Payment.amount", pay2.amount, 400);
      expectEq("onlineAmountPaid", o2a.onlineAmountPaid, 400);
      return `cancel → ${after.paymentStatus}; captured ₹${pay2.amount}`;
    });

    // G12 — B-7: rider-less quick-commerce COD earns nothing until admin confirms cash; no fee to seller
    await check("G12", "B-7: rider-less QC COD → Pending UNASSIGNED_COD, no delivery fee to seller", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 500);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 500 }], { paymentMethod: "COD", shipping: 40, platformFee: 0, status: "Delivered", deliveryPreference: "Self" });
      await markDelivered(o, 0);
      await commissionService.distributeCommissions(o._id.toString());
      const mid = await sellerBal(s);
      expectEq("nothing before cash", mid.bal + mid.hold, 0);
      await commissionService.settleUnassignedCod(o._id.toString());
      const end = await sellerBal(s);
      expectEq("product net only (no ₹40 fee)", end.hold, 450);
      return `held ₹${end.hold}`;
    });

    // G13 — R-03: scheduler lease lets only one instance run the job at a time
    await check("G13", "R-03: concurrent scheduler instances → one run, the other skips", async () => {
      const sch = await import("../services/financeScheduler");
      const [a, b] = await Promise.all([sch.runEscrowReleaseJob("host-a:1"), sch.runEscrowReleaseJob("host-b:2")]);
      const ran = [a, b].filter((x: any) => x.ran).length;
      if (ran < 1) throw new Error("no instance ran");
      const lock: any = await JobLock.findOne({ name: "escrow-release" }).lean();
      if (!lock?.lastRunAt) throw new Error("lastRunAt not recorded");
      return `ran ${ran} (lease serialises; job itself idempotent)`;
    });

    // G14 — B-6: IST boundaries and KPI identities
    await check("G14", "B-6: IST day boundary + Net sales = GMV − coupons − return refunds", async () => {
      const kpi = await import("../services/financeKpiService");
      const start = kpi.istStartOfDay(new Date("2026-11-12T20:00:00Z")); // 13 Nov 01:30 IST
      if (start.toISOString() !== "2026-11-12T18:30:00.000Z") throw new Error(`IST start ${start.toISOString()}`);
      const k0 = await kpi.getFinanceKpis();
      const s = await mkSeller(); const c = await mkCustomer(); const p = await mkProduct(s, 1000);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 1000 }], { shipping: 40, platformFee: 5, discount: 100 });
      await payMock(o);
      const cancelled = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 999 }], { status: "Cancelled" });
      void cancelled;
      const k = await kpi.getFinanceKpis();
      expectEq("GMV delta (cancelled excluded)", k.gmv - k0.gmv, 1000);
      expectEq("net sales delta", k.netSales - k0.netSales, 900);
      expectEq("orders delta", k.orders - k0.orders, 1);
      const range = kpi.parseIstDateRange("2026-11-12", "2026-11-12");
      if (range.from!.toISOString() !== "2026-11-11T18:30:00.000Z" || range.to!.toISOString() !== "2026-11-12T18:30:00.000Z") {
        throw new Error(`IST range ${range.from!.toISOString()} – ${range.to!.toISOString()}`);
      }
      return `ΔGMV ₹${k.gmv - k0.gmv}, Δnet ₹${k.netSales - k0.netSales}`;
    });

    // G15 — R-12: seller breakdown never exposes another seller's commission
    await check("G15", "R-12: seller A breakdown excludes seller B's items and commission", async () => {
      const a = await mkSeller(10); const b = await mkSeller(20); const c = await mkCustomer();
      const pa = await mkProduct(a, 100); const pb = await mkProduct(b, 900);
      const o = await mkOrder(c, [{ prod: pa, seller: a, qty: 1, price: 100 }, { prod: pb, seller: b, qty: 1, price: 900, rate: 20 }], { shipping: 0, platformFee: 0 });
      const ss = await import("../services/sellerSettlementService");
      const ba: any = await ss.buildSellerOrderEarning(o._id.toString(), a._id.toString());
      expectEq("A items", ba.yourItemsTotal, 100); expectEq("A commission", ba.yourCommission, 10);
      expectEq("legacy key scoped", ba.totalAdminEarning, 10);
      if (JSON.stringify(ba).includes("180")) throw new Error("seller B commission (₹180) leaked");
      return `A sees ₹${ba.yourCommission} only`;
    });

    // G16 — gift packaging removed: checkout code path no longer reads the setting
    await check("G16", "Gift packaging removed from settings schema", async () => {
      if ((AppSettings.schema as any).path("giftPackagingFee")) throw new Error("AppSettings.giftPackagingFee still defined");
      return "absent";
    });

    // G17 — R-16: every read-only reconciliation query runs on real data and finds a planted drift
    await check("G17", "R-16: reconciliation queries execute; planted ledger drift is detected", async () => {
      const rec = await import("./reconciliation/financialReconciliationReport");
      const db = mongoose.connection.db!;
      const s = await mkSeller();
      await Seller.updateOne({ _id: s._id }, { $set: { balance: 123 } }); // balance with no ledger rows
      const q: any = rec.reconciliationQueries;
      const out: any = {};
      for (const [name, fn] of Object.entries(q)) out[name] = await (fn as any)(db);
      const drift = out.sellerBalanceVsLedger.find((r: any) => String(r._id) === String(s._id));
      if (!drift || Math.abs(drift.diff - 123) > 0.01) throw new Error("planted seller drift not reported");
      if (out.duplicateCommissions.seller.length) throw new Error("unexpected duplicate commissions");
      return `${Object.keys(out).length} queries ran; drift ₹${drift.diff} found`;
    });

    // G18 — Small cart fee is platform income and part of the rider's COD cash
    await check("G18", "Small cart fee: COD ₹20 + ₹40 fee → rider owes full cash, fee in admin earning", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider(); const p = await mkProduct(s, 20);
      const o = await mkOrder(c, [{ prod: p, seller: s, qty: 1, price: 20 }],
        { paymentMethod: "COD", shipping: 27, platformFee: 3, deliveryBoy: r, status: "Delivered", smallCartFee: 40 });
      expectEq("order total 20+27+3+40", o.total, 90);
      const b: any = await commissionService.getOrderEarningBreakdown(o._id.toString());
      expectEq("breakdown small cart fee", b.smallCartFee, 40);
      // admin = commission 2 + handling 3 + fee 40 + delivery 27 − rider pay (5% of 20 = 1)
      expectEq("admin earning includes the fee", b.totalAdminEarning, 2 + 3 + 40 + 27 - 1);
      await commissionService.processCODOrderDelivery(o._id.toString(), undefined, r._id.toString());
      const rider: any = await Delivery.findById(r._id).lean();
      expectEq("rider owes full COD incl. fee", rider.pendingAdminPayout, 90);
      return `admin ₹${b.totalAdminEarning}, rider owes ₹${rider.pendingAdminPayout}`;
    });

    // G19 — Mixed COD: the small cart fee is collected by the rider, not the courier
    await check("G19", "Small cart fee on MIXED COD → rider share QC 20 + 27 + 40, courier share 800", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider();
      const pq = await mkProduct(s, 20); const pe = await mkProduct(s, 800);
      const o = await mkOrder(c, [
        { prod: pq, seller: s, qty: 1, price: 20, productType: "QUICK_COMMERCE", fulfillmentType: "LOCAL_DELIVERY" },
        { prod: pe, seller: s, qty: 1, price: 800, productType: "ECOMMERCE", fulfillmentType: "COURIER_SHIPPING" },
      ], { paymentMethod: "COD", shipping: 27, platformFee: 0, deliveryBoy: r, status: "Processed", orderType: "MIXED", groups: true, smallCartFee: 40 });
      const full: any = await Order.findById(o._id).populate("items");
      const courierShare = await courierCod.computeCourierCodAmount(full);
      expectEq("courier collects only the courier item", courierShare, 800);
      expectEq("rider collects the rest", full.total - courierShare, 20 + 27 + 40);
      return `rider ₹${full.total - courierShare}, courier ₹${courierShare}`;
    });

    // G20 — Cancelling the whole Quick Commerce part returns the small cart fee
    await check("G20", "Small cart fee refunded when the QC part is cancelled (COD drops by 20 + 27 + 40)", async () => {
      const s = await mkSeller(); const c = await mkCustomer(); const r = await mkRider();
      const pq = await mkProduct(s, 20); const pe = await mkProduct(s, 800);
      const lines: any[] = [
        { prod: pq, seller: s, qty: 1, price: 20, productType: "QUICK_COMMERCE", fulfillmentType: "LOCAL_DELIVERY" },
        { prod: pe, seller: s, qty: 1, price: 800, productType: "ECOMMERCE", fulfillmentType: "COURIER_SHIPPING" },
      ];
      const o: any = await mkOrder(c, lines, { paymentMethod: "COD", shipping: 27, platformFee: 0, deliveryBoy: r, status: "Processed", orderType: "MIXED", groups: true, smallCartFee: 40 });
      for (const g of o.fulfillmentGroups) g.status = "Processing";
      await o.save();
      const before = o.codAmountPending;
      const { settleCancelledOrderItems } = await import("../services/orderPartCancellationService");
      const res: any = await settleCancelledOrderItems(o._id.toString(), [String(lines[0]._itemId)], { reason: "test: QC part cancelled" });
      if (!res.success) throw new Error(res.message);
      const after: any = await Order.findById(o._id).lean();
      expectEq("COD reduced by QC item + QC delivery + small cart fee", before - after.codAmountPending, 20 + 27 + 40);
      return `COD ₹${before} → ₹${after.codAmountPending}`;
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
