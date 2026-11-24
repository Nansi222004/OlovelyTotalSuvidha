/**
 * Mark ONE online order as Paid when Razorpay captured the money but our server never got the
 * confirmation (app verify call lost, webhook not configured).
 *
 * Usage (on the server, from /root/olovelytotal/backend):
 *   npx tsx src/scripts/reconcileRazorpayPayment.ts <ORDER_NUMBER> <pay_ID>            # dry run, changes nothing
 *   npx tsx src/scripts/reconcileRazorpayPayment.ts <ORDER_NUMBER> <pay_ID> --apply    # actually mark Paid
 *
 * Safety checks (all must pass, against Razorpay's own records):
 *  - the payment exists in Razorpay and its status is "captured", currency INR
 *  - the payment belongs to a Razorpay order created for THIS order (receipt / notes.orderId)
 *  - the captured amount equals what the order still owes online
 *  - the payment id is not already attached to a different order
 * Then it runs the same handler as the "payment.captured" webhook (order Paid -> Received,
 * Payment record, commissions, customer notification). Running it twice is harmless.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order";
import Payment from "../models/Payment";
import { getRazorpayInstance, handlePaymentCaptured } from "../services/paymentService";
import { getOnlineAmountDue } from "../services/financeMath";
import { applyRazorpayMode } from "../config/razorpayEnv";

dotenv.config();
// Same key selection as server.ts (RAZORPAY_LIVE_MODE -> RAZORPAY_LIVE_* keys).
applyRazorpayMode();

const [orderNumber, payId] = process.argv.slice(2);
const apply = process.argv.includes("--apply");

const fail = (msg: string): never => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

(async () => {
  if (!orderNumber || !payId || !/^pay_/.test(payId)) {
    fail("Usage: npx tsx src/scripts/reconcileRazorpayPayment.ts <ORDER_NUMBER> <pay_ID> [--apply]");
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) fail("MONGODB_URI is not set");
  await mongoose.connect(uri as string);

  const order: any = await Order.findOne({ orderNumber });
  if (!order) fail(`Order ${orderNumber} not found`);
  console.log(`Order ${order.orderNumber} (${order._id}) | method=${order.paymentMethod} | paymentStatus=${order.paymentStatus} | status=${order.status} | total=₹${order.total}`);

  if (order.paymentStatus === "Paid") {
    console.log("✅ Order is already Paid. Nothing to do.");
    await mongoose.disconnect();
    return;
  }
  if (order.paymentMethod !== "Online") fail("Order is not an Online-payment order");

  const razorpay: any = getRazorpayInstance();
  const pay: any = await razorpay.payments.fetch(payId);
  console.log(`Razorpay ${pay.id} | status=${pay.status} | amount=₹${pay.amount / 100} ${pay.currency} | method=${pay.method} | rzp order=${pay.order_id}`);

  if (pay.status !== "captured") fail(`Payment status is "${pay.status}", not "captured". Capture it in the Razorpay dashboard first.`);
  if (pay.currency !== "INR") fail("Currency is not INR");

  // The payment must belong to a Razorpay order created for this Olovely order.
  let belongs = String(pay.notes?.orderId || "") === String(order._id);
  if (!belongs && pay.order_id) {
    const rzpOrder: any = await razorpay.orders.fetch(pay.order_id);
    belongs = String(rzpOrder.receipt || "") === String(order._id) || String(rzpOrder.notes?.orderId || "") === String(order._id);
    if (!pay.notes?.orderId) pay.notes = { ...(pay.notes || {}), orderId: String(order._id) };
  }
  if (!belongs) fail("This Razorpay payment was NOT created for this order (receipt/notes do not match)");

  const due = getOnlineAmountDue(order);
  if (Math.round(due * 100) !== Number(pay.amount)) fail(`Amount mismatch: order owes ₹${due}, Razorpay captured ₹${pay.amount / 100}`);

  const other: any = await Payment.findOne({ razorpayPaymentId: payId, order: { $ne: order._id } });
  if (other) fail(`Payment ${payId} is already linked to another order (${other.order})`);

  console.log("✅ All checks passed: captured, INR, belongs to this order, amount matches.");
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to mark the order Paid.");
    await mongoose.disconnect();
    return;
  }

  await handlePaymentCaptured(pay);
  const after: any = await Order.findById(order._id);
  console.log(`Result: paymentStatus=${after.paymentStatus} | status=${after.status} | paymentId=${after.paymentId}`);
  await mongoose.disconnect();
  process.exit(after.paymentStatus === "Paid" ? 0 : 1);
})().catch(async (e) => {
  console.error("❌ Error:", e?.error?.description || e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
