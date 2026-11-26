/**
 * Is a customer still eligible for "Free shipping on first order"? If the benefit was used on an
 * order that was later cancelled/rejected (and never given back), --restore releases it.
 *
 * READ-ONLY unless --restore is passed.
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkFirstOrderFreeShipping.ts 8200475014
 *   npx tsx src/scripts/checkFirstOrderFreeShipping.ts 8200475014 --restore
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Customer from "../models/Customer";
import Order from "../models/Order";
import AppSettings from "../models/AppSettings";
import {
  isCustomerEligibleForFirstOrderFreeShipping,
  releaseFirstOrderFreeShippingClaim,
} from "../services/shipping/shippingPromotionService";

const args = process.argv.slice(2);
const RESTORE = args.includes("--restore");
const phone = String(args.find((a) => !a.startsWith("--")) || "").replace(/\D/g, "").slice(-10);
const CLOSED = ["Cancelled", "Rejected"];

(async () => {
  if (!phone) throw new Error("Usage: checkFirstOrderFreeShipping.ts <customer phone> [--restore]");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const settings: any = await (AppSettings as any).getSettings();
  console.log(`Feature "Free shipping on first order": ${settings?.firstOrderFreeShippingEnabled ? "ON" : "OFF"}`);

  const customer: any = await Customer.findOne({ phone: { $regex: `${phone}$` } })
    .select("name phone firstOrderFreeShippingConsumed")
    .lean();
  if (!customer) throw new Error(`No customer with phone …${phone}`);
  console.log(`Customer: ${customer.name} (${customer.phone})`);
  console.log(`  benefit marked as used (firstOrderFreeShippingConsumed): ${customer.firstOrderFreeShippingConsumed ? "YES" : "no"}`);

  const orders: any[] = await Order.find({ customer: customer._id })
    .select("orderNumber status paymentMethod paymentStatus shipping normalShippingAmount firstOrderFreeShippingApplied createdAt")
    .sort({ createdAt: 1 })
    .lean();
  console.log(`\nOrders (${orders.length}):`);
  for (const o of orders) {
    console.log(
      `  #${o.orderNumber} ${new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " ")} ` +
      `status=${o.status} ${o.paymentMethod}/${o.paymentStatus} delivery charged ₹${o.shipping ?? 0}` +
      (o.firstOrderFreeShippingApplied ? ` ← FREE SHIPPING USED (normal ₹${o.normalShippingAmount ?? 0})` : "")
    );
  }

  const eligible = await isCustomerEligibleForFirstOrderFreeShipping(customer._id);
  console.log(`\n→ Next order gets free delivery: ${settings?.firstOrderFreeShippingEnabled && eligible ? "YES" : "NO"}` +
    (!settings?.firstOrderFreeShippingEnabled ? " (feature is OFF)" : ""));

  // Lost benefit: flag says used, but every order that used it is cancelled/rejected and there is
  // no other live/completed order that would make the customer ineligible anyway.
  const promoOrders = orders.filter((o) => o.firstOrderFreeShippingApplied);
  const lost =
    customer.firstOrderFreeShippingConsumed &&
    promoOrders.length > 0 &&
    promoOrders.every((o) => CLOSED.includes(o.status)) &&
    !orders.some((o) => !CLOSED.includes(o.status) && (o.paymentStatus === "Paid" || o.paymentMethod === "COD"));

  if (lost) {
    console.log("⚠️  The benefit was used on an order that was cancelled/rejected and never given back.");
    if (RESTORE) {
      await releaseFirstOrderFreeShippingClaim(customer._id);
      const after = await isCustomerEligibleForFirstOrderFreeShipping(customer._id);
      console.log(`✅ Restored. Next order gets free delivery: ${settings?.firstOrderFreeShippingEnabled && after ? "YES" : "NO"}`);
    } else {
      console.log("   Run again with --restore to give it back.");
    }
  } else if (RESTORE) {
    console.log("Nothing to restore: the benefit was not lost on a cancelled/rejected order.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
