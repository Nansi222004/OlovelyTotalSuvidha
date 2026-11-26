/**
 * READ-ONLY: show where a cancelled / rejected order's money went
 * (gateway refund to the customer's bank/card, or customer wallet).
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkOrderRefund.ts ORD1795600293067922
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Payment from "../models/Payment";
import Refund from "../models/Refund";
import GatewayRefundIntent from "../models/GatewayRefundIntent";
import WalletTransaction from "../models/WalletTransaction";

const orderNumber = String(process.argv[2] || "").replace(/^#/, "").trim();

(async () => {
  if (!orderNumber) throw new Error("Usage: checkOrderRefund.ts <orderNumber>");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const order: any = await Order.findOne({ orderNumber }).lean();
  if (!order) throw new Error(`Order ${orderNumber} not found`);

  console.log(`ORDER #${order.orderNumber}`);
  console.log(
    `  status=${order.status} orderType=${order.orderType} paymentMethod=${order.paymentMethod} paymentStatus=${order.paymentStatus}\n` +
    `  total=₹${order.total} onlinePaid=₹${order.onlineAmountPaid || 0} walletUsed=₹${order.walletAmountUsed || 0} codPending=₹${order.codAmountPending || 0}\n` +
    `  razorpayPaymentId=${order.paymentId || "-"} cancelledAt=${order.cancelledAt || "-"} reason=${order.cancellationReason || "-"}`
  );

  const items: any[] = await OrderItem.find({ order: order._id })
    .select("productName status sellerStatus ownerType productType cancellationSettledAt")
    .lean();
  console.log(`\nITEMS (${items.length})`);
  for (const i of items) {
    console.log(
      `  ${i.productName || i._id} status=${i.status} sellerStatus=${i.sellerStatus || "-"} ` +
      `${i.ownerType || ""}/${i.productType || ""} settled=${i.cancellationSettledAt ? "yes" : "NO"}`
    );
  }

  const payments: any[] = await Payment.find({
    $or: [{ order: order._id }, ...(order.paymentId ? [{ razorpayPaymentId: order.paymentId }] : [])],
  }).lean();
  console.log(`\nPAYMENTS (${payments.length})`);
  for (const p of payments) {
    console.log(
      `  ${p.razorpayPaymentId || p._id} status=${p.status} amount=₹${p.amount} refunded=₹${p.refundAmount || 0}`
    );
  }

  const intents: any[] = await GatewayRefundIntent.find({ order: order._id }).lean();
  console.log(`\nRAZORPAY REFUND ATTEMPTS (${intents.length})`);
  for (const r of intents) {
    console.log(
      `  ₹${r.amount} ${r.status} razorpayRefundId=${r.gatewayRefundId || "-"} attempts=${r.attempts || 0}` +
      `${r.lastError ? ` error="${r.lastError}"` : ""} at=${r.createdAt?.toISOString?.() || r.createdAt}`
    );
  }

  const refunds: any[] = await Refund.find({ order: order._id }).lean();
  console.log(`\nREFUND RECORDS (${refunds.length})`);
  for (const r of refunds) console.log(`  ₹${r.amount} ${r.status} — ${r.reason || ""}`);

  const wallet: any[] = await WalletTransaction.find({ relatedOrder: order._id, userType: "CUSTOMER" }).lean();
  console.log(`\nCUSTOMER WALLET ENTRIES FOR THIS ORDER (${wallet.length})`);
  for (const w of wallet) console.log(`  ${w.type} ₹${w.amount} ${w.status} — ${w.description}`);

  const gateway = intents.filter((i) => i.status === "SUCCEEDED").reduce((s, i) => s + (i.amount || 0), 0);
  const walletRefund = wallet
    .filter((w) => w.type === "Credit" && w.status === "Completed")
    .reduce((s, w) => s + (w.amount || 0), 0);
  console.log(
    `\nSUMMARY: paid online ₹${order.onlineAmountPaid || 0} + wallet ₹${order.walletAmountUsed || 0} → ` +
    `refunded to bank/card ₹${gateway}, credited to wallet ₹${walletRefund}`
  );

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
