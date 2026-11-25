/**
 * READ-ONLY: list the Shiprocket pickup locations on the live account and compare them with what
 * each seller has stored (shippingConfig.shiprocketPickupLocationId / Name).
 * Explains "stored seller pickup ID did not resolve to the verified vendor pickup location".
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkShiprocketPickups.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Seller from "../models/Seller";
import { shiprocketPickupApi } from "../services/shipping/shiprocketPickupService";

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const locations: any[] = await shiprocketPickupApi.listPickupLocations();
  console.log(`Shiprocket pickup locations: ${locations.length}`);
  for (const l of locations) {
    const id = l.id ?? l.pickup_location_id ?? l.pickup_id ?? l.pickup_code;
    console.log(
      `  id=${id} name="${l.pickup_location}" primary=${l.is_primary ?? l.is_primary_location ?? "-"} ` +
      `status=${l.status ?? "-"} pin=${l.pin_code ?? l.pincode ?? "-"} city=${l.city ?? "-"}`
    );
  }

  const sellers: any[] = await Seller.find({ "shippingConfig.shiprocketPickupLocationId": { $exists: true, $ne: null } })
    .select("storeName isPlatform shippingConfig.shiprocketPickupLocationId shippingConfig.shiprocketPickupLocationName")
    .lean();
  console.log("\nSellers with a stored pickup:");
  for (const s of sellers) {
    const storedId = String(s.shippingConfig?.shiprocketPickupLocationId);
    const storedName = s.shippingConfig?.shiprocketPickupLocationName;
    const remote = locations.find((l: any) => String(l.id ?? l.pickup_location_id ?? l.pickup_id ?? l.pickup_code ?? "") === storedId);
    let verdict = "OK";
    if (!remote) verdict = "ID NOT FOUND in Shiprocket";
    else if (String(remote.pickup_location || "").trim() !== storedName) verdict = `NAME MISMATCH (Shiprocket has "${remote.pickup_location}")`;
    else if (remote.is_primary === true || remote.is_primary === 1 || remote.is_primary_location === true || remote.is_primary_location === 1) verdict = "IS PRIMARY in Shiprocket (blocked by safety check)";
    console.log(`  ${s.storeName}${s.isPlatform ? " [PLATFORM]" : ""}: id=${storedId} name=${storedName} -> ${verdict}`);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
