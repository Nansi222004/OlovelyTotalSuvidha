/**
 * Re-book the courier (Shiprocket) shipment for one order whose automatic booking failed.
 *
 *   cd /root/olovelytotal/backend
 *   npx tsx src/scripts/retryEcommerceShipment.ts <ORDER_NUMBER>            # dry run: shows courier groups only
 *   npx tsx src/scripts/retryEcommerceShipment.ts <ORDER_NUMBER> --apply    # books the shipment
 *
 * Uses the normal createEcommerceShipment path (same validations + idempotency key), so running it
 * twice never creates a second Shiprocket order.
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "../models/Order";
// Register every model the shipping code populates (a standalone script does not load the app's models).
import "../models/Product";
import "../models/OrderItem";
import "../models/Seller";
import "../models/Customer";
import "../models/Category";
import { createEcommerceShipment } from "../services/shipping/shippingService";

const [orderNumber] = process.argv.slice(2);
const apply = process.argv.includes("--apply");

(async () => {
  if (!orderNumber) throw new Error("Usage: npx tsx src/scripts/retryEcommerceShipment.ts <ORDER_NUMBER> [--apply]");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const order: any = await Order.findOne({ orderNumber }).lean();
  if (!order) throw new Error(`Order ${orderNumber} not found`);
  console.log(`Order ${order.orderNumber} | ${order.orderType} | status=${order.status} | ${order.paymentMethod}/${order.paymentStatus}`);
  if (["Cancelled", "Rejected", "Returned", "Delivered"].includes(order.status)) {
    throw new Error(`Order is ${order.status}; nothing to ship.`);
  }
  if (order.paymentMethod !== "COD" && order.paymentStatus !== "Paid") {
    throw new Error("Online order is not paid yet; it cannot be shipped.");
  }

  const groups = (order.fulfillmentGroups || []).filter((g: any) => g.fulfillmentType === "COURIER_SHIPPING");
  if (groups.length === 0) throw new Error("Order has no courier (Ecommerce) group.");

  for (const g of groups) {
    const awb = g.shippingDetails?.awbNumber;
    console.log(`  group ${g.groupId} | status=${g.status} | AWB=${awb || "none"}`);
    if (awb) {
      console.log("    already booked, skipping");
      continue;
    }
    if (!apply) {
      console.log("    would book now (dry run). Re-run with --apply.");
      continue;
    }
    try {
      const res: any = await createEcommerceShipment(String(order._id), g.groupId);
      console.log(`    ✅ booked: AWB=${res?.awbNumber || res?.trackingNumber || "?"} courier=${res?.carrier || res?.courierName || "?"}`);
    } catch (e: any) {
      console.log(`    ❌ failed: ${e?.message || e}`);
    }
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
