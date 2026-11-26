/**
 * READ-ONLY pre-flight for a Quick Commerce test order on PLATFORM (admin) products:
 * can this customer order, and which delivery partners can admin assign?
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkQcReadiness.ts 8200475014
 *   (argument = customer phone; defaults to the newest customer)
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Customer from "../models/Customer";
import Address from "../models/Address";
import Delivery from "../models/Delivery";
import Product from "../models/Product";
import AppSettings from "../models/AppSettings";
import { calculateDistance } from "../utils/locationHelper";
import { evaluatePlatformQuickCommerce, validatePlatformQuickCommerceFulfillment } from "../services/productServiceabilityService";

const ok = (b: boolean) => (b ? "✅" : "❌");
const phoneArg = String(process.argv[2] || "").replace(/\D/g, "").slice(-10);

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  const settings: any = await (AppSettings as any).getSettings();

  // ── 1. Platform QC warehouse ───────────────────────────────────────────────
  const wh = settings?.platformQuickCommerceFulfillment || {};
  const whValid = validatePlatformQuickCommerceFulfillment(wh);
  console.log("1) PLATFORM QUICK COMMERCE WAREHOUSE");
  console.log(`   ${ok(whValid.valid)} ${wh.warehouseName || "-"}, ${wh.city || "-"} ${wh.pincode || ""} @ ${wh.latitude},${wh.longitude}, radius ${wh.serviceRadiusKm ?? "-"} km`);
  if (!whValid.valid) console.log(`   → ${whValid.message} (Admin → Manage Location / platform fulfillment)`);

  // ── 2. Customer + saved addresses ──────────────────────────────────────────
  const customer: any = phoneArg
    ? await Customer.findOne({ phone: { $regex: `${phoneArg}$` } }).lean()
    : await Customer.findOne({ refCode: { $nin: ["WALKIN"] } }).sort({ createdAt: -1 }).lean();
  console.log("\n2) CUSTOMER");
  if (!customer) {
    console.log(`   ❌ No customer found${phoneArg ? ` with phone …${phoneArg}` : ""}`);
  } else {
    console.log(`   ${ok(customer.status === "Active")} ${customer.name} (${customer.phone}) status=${customer.status}`);
    const addresses: any[] = await Address.find({ customer: customer._id }).lean();
    if (addresses.length === 0) console.log("   ❌ No saved address — the customer must add one (with map pin) at checkout");
    for (const a of addresses) {
      const res = evaluatePlatformQuickCommerce(wh, a.latitude, a.longitude);
      const where = `${a.type}${a.isDefault ? " (default)" : ""}: ${a.address}, ${a.city} ${a.pincode}`;
      if (res.status === "SERVICEABLE") {
        console.log(`   ✅ ${where} → ${res.distanceKm?.toFixed(2)} km from warehouse (within ${res.serviceRadiusKm} km)`);
      } else if (res.status === "UNSERVICEABLE") {
        console.log(`   ❌ ${where} → ${res.distanceKm?.toFixed(2)} km, OUTSIDE ${res.serviceRadiusKm} km radius`);
      } else {
        console.log(`   ❌ ${where} → ${res.status}: ${res.message || "no map location on this address"}`);
      }
    }
  }

  // ── 3. Platform QC products that can be bought ─────────────────────────────
  const products: any[] = await Product.find({ ownerType: "PLATFORM", productType: "QUICK_COMMERCE" })
    .select("productName status publish stock variations")
    .lean();
  const sellable = products.filter(
    (p) =>
      p.status === "Active" &&
      p.publish !== false &&
      ((p.stock || 0) > 0 || (p.variations || []).some((v: any) => (v.stock || 0) > 0 || v.unlimitedStock))
  );
  console.log("\n3) PLATFORM QUICK COMMERCE PRODUCTS");
  console.log(`   ${ok(sellable.length > 0)} ${sellable.length} sellable (active, published, in stock) of ${products.length}`);

  // ── 4. Delivery partners ───────────────────────────────────────────────────
  const riders: any[] = await Delivery.find({})
    .select("name mobile status isOnline available location commissionRate createdAt")
    .sort({ createdAt: -1 })
    .lean();
  console.log("\n4) DELIVERY PARTNERS (admin can assign only: Active + Online + Available)");
  for (const r of riders) {
    const assignable = r.status === "Active" && r.isOnline === true && r.available === "Available";
    const coords = r.location?.coordinates;
    const dist =
      coords?.length === 2 && Number.isFinite(Number(wh.latitude))
        ? `${calculateDistance(Number(wh.latitude), Number(wh.longitude), coords[1], coords[0]).toFixed(1)} km from warehouse`
        : "no location yet";
    const missing = [
      r.status !== "Active" && `status=${r.status} → admin must activate`,
      r.isOnline !== true && "offline → partner must go Online in the app",
      r.available !== "Available" && `available=${r.available}`,
    ].filter(Boolean);
    console.log(
      `   ${ok(assignable)} ${r.name} (${r.mobile}) registered ${new Date(r.createdAt).toISOString().slice(0, 10)}, ` +
      `${dist}, commission ${r.commissionRate ?? "default"}%` +
      (missing.length ? `\n       → ${missing.join("; ")}` : "")
    );
  }
  if (riders.length === 0) console.log("   ❌ No delivery partners registered");

  // ── 5. Delivery pricing in force ───────────────────────────────────────────
  const dc = settings?.deliveryConfig || {};
  console.log("\n5) DELIVERY PRICING");
  console.log(
    dc.isDistanceBased
      ? `   Distance Based (Instant only): customer ₹${dc.baseCharge} for ${dc.baseDistance} km + ₹${dc.kmRate}/km; ` +
        `partner ₹${dc.deliveryBoyBaseCharge || 0} for ${dc.deliveryBoyBaseDistance || 0} km + ₹${dc.deliveryBoyKmRate || 0}/km`
      : `   Fixed Price: ₹${settings?.deliveryCharges ?? 0}; partner gets commission % of order value`
  );
  console.log(`   Free delivery above ₹${settings?.freeDeliveryThreshold || 0}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
