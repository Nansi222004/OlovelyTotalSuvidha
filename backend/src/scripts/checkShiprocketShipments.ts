/**
 * READ-ONLY: list every order / return in our DB that created a Shiprocket shipment,
 * plus orders that tried (have a Shiprocket idempotency key / error) but stored no shipment.
 * Use it to answer "did our app create this courier pickup?".
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkShiprocketShipments.ts [sinceDays=30]
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "../models/Order";
import Return from "../models/Return";

const sinceDays = Number(process.argv[2] || 30);
const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
const fmt = (d?: Date) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : "-");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const orders: any[] = await Order.find({
    updatedAt: { $gte: since },
    $or: [
      { "fulfillmentGroups.thirdPartyOrderDetails.shipmentId": { $exists: true, $nin: [null, ""] } },
      { "fulfillmentGroups.thirdPartyOrderDetails.externalOrderId": { $exists: true, $nin: [null, ""] } },
      { "fulfillmentGroups.thirdPartyOrderDetails.idempotencyKey": { $exists: true, $nin: [null, ""] } },
    ],
  })
    .select("orderNumber status createdAt updatedAt fulfillmentGroups")
    .sort({ updatedAt: -1 })
    .lean();

  console.log(`Orders touching Shiprocket in last ${sinceDays} days: ${orders.length}`);
  for (const o of orders) {
    for (const g of o.fulfillmentGroups || []) {
      const t = g.thirdPartyOrderDetails || {};
      if (!t.shipmentId && !t.externalOrderId && !t.idempotencyKey) continue;
      console.log(
        `  #${o.orderNumber} created=${fmt(o.createdAt)} updated=${fmt(o.updatedAt)} orderStatus=${o.status} ` +
        `group=${g.groupId} groupStatus=${g.status} seller=${g.seller} ` +
        `srOrder=${t.externalOrderId || "-"} shipment=${t.shipmentId || "-"} awb=${g.shippingDetails?.awbNumber || "-"} ` +
        `key=${t.idempotencyKey || "-"} srStatus=${t.status || "-"}${t.lastError ? ` lastError="${t.lastError}"` : ""}`
      );
    }
  }

  const returns: any[] = await Return.find({
    updatedAt: { $gte: since },
    $or: [
      { reverseShipmentId: { $exists: true, $nin: [null, ""] } },
      { reverseExternalOrderId: { $exists: true, $nin: [null, ""] } },
      { returnAwbNumber: { $exists: true, $nin: [null, ""] } },
    ],
  })
    .select("order status createdAt updatedAt reverseShipmentId reverseExternalOrderId returnAwbNumber")
    .sort({ updatedAt: -1 })
    .lean();

  console.log(`\nReturns with a reverse Shiprocket shipment in last ${sinceDays} days: ${returns.length}`);
  for (const r of returns) {
    console.log(
      `  return=${r._id} order=${r.order} status=${r.status} created=${fmt(r.createdAt)} ` +
      `srOrder=${r.reverseExternalOrderId || "-"} shipment=${r.reverseShipmentId || "-"} awb=${r.returnAwbNumber || "-"}`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
