/**
 * Reconcile orders whose Shiprocket shipment was CANCELLED at Shiprocket (dashboard / missed
 * webhook) while our DB still shows it as live.
 *
 * Shiprocket is the source of truth: a group is only touched when Shiprocket itself reports the
 * order as CANCELED. Settlement reuses settleCancelledOrderItems — the same idempotent path the
 * Shiprocket "Cancelled" webhook runs (stock restore, items Cancelled, commissions cancelled,
 * COD reduced / refund, order Cancelled when nothing deliverable is left).
 *
 * DRY RUN by default (read-only). Add --apply to write.
 *
 *   npx tsx src/scripts/syncShiprocketCancellations.ts                 # scan last 60 days, dry run
 *   npx tsx src/scripts/syncShiprocketCancellations.ts --days=90
 *   npx tsx src/scripts/syncShiprocketCancellations.ts --orders=ORD1794981440459161,ORD1794981328904439
 *   npx tsx src/scripts/syncShiprocketCancellations.ts --apply
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import { shiprocketHttpClient } from "../services/shipping/shiprocketHttpClient";
import { settleCancelledOrderItems } from "../services/orderPartCancellationService";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const days = Number((args.find((a) => a.startsWith("--days=")) || "--days=60").split("=")[1]) || 60;
const onlyOrders = (args.find((a) => a.startsWith("--orders=")) || "")
  .split("=")[1]
  ?.split(",")
  .map((s) => s.trim().replace(/^#/, ""))
  .filter(Boolean);

const FINAL_ORDER_STATUSES = ["Cancelled", "Delivered", "Returned"];
const isCourier = (g: any) => g.fulfillmentType === "COURIER_SHIPPING" || g.fulfillmentType === "THIRD_PARTY_API";

/** Live Shiprocket order, looked up the same way the provider does (channel_order_id = idempotency key). */
async function fetchShiprocketOrder(group: any): Promise<{ id: string; status: string; awb?: string } | null> {
  const key = group.thirdPartyOrderDetails?.idempotencyKey;
  const externalId = String(group.thirdPartyOrderDetails?.externalOrderId || "");
  if (!key) return null;
  const response: any = await shiprocketHttpClient.request({
    method: "GET",
    url: "/v1/external/orders",
    params: { filter_by: "channel_order_id", filter: key, per_page: 5 },
  });
  const rows: any[] = Array.isArray(response?.data) ? response.data : [];
  const row =
    rows.find((r) => String(r.id) === externalId) ||
    rows.find((r) => String(r.channel_order_id) === key);
  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status || "").toUpperCase(),
    awb: row.shipments?.[0]?.awb || row.awb_code,
  };
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!shiprocketHttpClient.hasCredentials()) throw new Error("Shiprocket credentials are not set");
  await mongoose.connect(uri);

  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no changes)"}`);

  const filter: any = {
    "fulfillmentGroups.thirdPartyOrderDetails.externalOrderId": { $exists: true, $nin: [null, ""] },
  };
  if (onlyOrders?.length) filter.orderNumber = { $in: onlyOrders };
  else filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };

  const orders: any[] = await Order.find(filter).sort({ createdAt: -1 });
  console.log(`Orders with a Shiprocket booking to check: ${orders.length}\n`);

  let fixed = 0;
  let needsAttention = 0;

  for (const order of orders) {
    for (const group of order.fulfillmentGroups || []) {
      if (!isCourier(group) || !group.thirdPartyOrderDetails?.externalOrderId) continue;

      const dbGroupStatus = group.status;
      const dbSrStatus = group.thirdPartyOrderDetails?.status;
      const groupOutOfSync = dbGroupStatus !== "Cancelled" || dbSrStatus !== "Cancelled";
      const orderOutOfSync = !FINAL_ORDER_STATUSES.includes(String(order.status));
      if (!groupOutOfSync && !orderOutOfSync) continue; // already consistent

      const label =
        `#${order.orderNumber} group=${group.groupId} awb=${group.shippingDetails?.awbNumber || "-"} ` +
        `srOrder=${group.thirdPartyOrderDetails.externalOrderId}`;

      let remote;
      try {
        remote = await fetchShiprocketOrder(group);
      } catch (e: any) {
        console.log(`⚠️  ${label}: Shiprocket lookup failed (${e?.message}). Skipped.`);
        needsAttention++;
        continue;
      }
      if (!remote) {
        console.log(`⚠️  ${label}: not found at Shiprocket. Skipped — check the dashboard manually.`);
        needsAttention++;
        continue;
      }

      const remoteCancelled = remote.status === "CANCELED" || remote.status === "CANCELLED";
      console.log(
        `${remoteCancelled ? "🔴" : "🟢"} ${label}\n` +
        `     DB: order=${order.status} group=${dbGroupStatus} shiprocketStatus=${dbSrStatus}\n` +
        `     Shiprocket: ${remote.status}${remote.awb ? ` (awb ${remote.awb})` : ""}`
      );

      if (!remoteCancelled) {
        if (orderOutOfSync && dbGroupStatus === "Cancelled") {
          console.log(`     ⚠️  Our group is Cancelled but Shiprocket is ${remote.status}: cancel it in the Shiprocket dashboard.`);
          needsAttention++;
        } else {
          console.log("     Live at Shiprocket — left unchanged.");
        }
        continue;
      }

      const items = await OrderItem.find({ _id: { $in: group.items || [] } })
        .select("status cancellationSettledAt")
        .lean();
      const unsettled = items.filter(
        (i: any) => !i.cancellationSettledAt && !["Delivered", "Returned"].includes(String(i.status))
      );
      console.log(
        `     Items: ${items.length} (${unsettled.length} without settlement marker) → ` +
        (!orderOutOfSync
          ? `order already ${order.status}: its cancellation already handled stock/money — only the group status is synced`
          : unsettled.length
            ? "will restore stock, cancel items/commissions, adjust COD/refund"
            : "already settled")
      );

      if (!APPLY) {
        console.log(
          `     (dry run) would mark group Cancelled${orderOutOfSync ? " and settle the items" : ""}\n`
        );
        continue;
      }

      // 1. Close the courier group exactly like the "Cancelled" webhook does.
      await Order.updateOne(
        { _id: order._id, "fulfillmentGroups.groupId": group.groupId },
        {
          $set: {
            "fulfillmentGroups.$.status": "Cancelled",
            "fulfillmentGroups.$.thirdPartyOrderDetails.status": "Cancelled",
          },
        }
      );

      // 2. Settle its items (idempotent; no-op for items already settled).
      if (orderOutOfSync) {
        const res = await settleCancelledOrderItems(
          String(order._id),
          (group.items || []).map((id: any) => String(id)),
          { reason: "Courier shipment was cancelled at Shiprocket (reconciled)" }
        );
        console.log(`     Settlement: ${res.success ? "ok" : "FAILED"} mode=${res.mode} — ${res.message}`);
        if (!res.success) {
          needsAttention++;
          continue;
        }

        // 3. Items were already settled earlier but the order status never followed: close it
        //    only when every item of the order is Cancelled (nothing left to deliver).
        const fresh: any = await Order.findById(order._id).select("status").lean();
        if (!FINAL_ORDER_STATUSES.includes(String(fresh?.status))) {
          const allItems = await OrderItem.find({ order: order._id }).select("status").lean();
          const allCancelled = allItems.length > 0 && allItems.every((i: any) => i.status === "Cancelled");
          if (allCancelled) {
            await Order.updateOne(
              { _id: order._id },
              {
                $set: {
                  status: "Cancelled",
                  cancelledAt: new Date(),
                  cancellationReason: "Courier shipment was cancelled at Shiprocket (reconciled)",
                  codAmountPending: 0,
                },
              }
            );
            console.log("     Order status set to Cancelled (all items were already cancelled).");
          } else {
            console.log(`     Order left as '${fresh?.status}': it still has deliverable items.`);
          }
        }
      }
      fixed++;
      console.log("     ✅ reconciled\n");
    }
  }

  console.log(
    `\nDone. ${APPLY ? `Reconciled ${fixed} group(s).` : "Dry run — rerun with --apply to write."}` +
    (needsAttention ? ` ${needsAttention} need manual attention (see ⚠️ above).` : "")
  );
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
