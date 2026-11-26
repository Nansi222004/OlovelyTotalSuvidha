/**
 * READ-ONLY: has any Shiprocket tracking webhook ever reached (and passed auth in) this backend?
 * Only webhooks with a valid x-api-key and an awb + status are recorded, so an empty list means
 * Shiprocket is not reaching us, or the token does not match SHIPROCKET_WEBHOOK_TOKEN.
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkShippingWebhooks.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import ProcessedWebhookEvent from "../models/ProcessedWebhookEvent";

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const token = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  console.log(
    `SHIPROCKET_WEBHOOK_TOKEN in .env: ${
      !token
        ? "NOT SET (every webhook is rejected with 401)"
        : token === "your_shiprocket_webhook_security_token"
          ? "still the placeholder value (every webhook is rejected with 401)"
          : `set, ${token.length} chars, starts "${token.slice(0, 4)}…" ends "…${token.slice(-4)}"`
    }`
  );

  await mongoose.connect(uri);
  const total = await ProcessedWebhookEvent.countDocuments({ provider: "shiprocket" });
  const events: any[] = await ProcessedWebhookEvent.find({ provider: "shiprocket" })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  console.log(`\nShiprocket webhooks accepted (kept 90 days): ${total}`);
  for (const e of events) {
    console.log(
      `  ${new Date(e.createdAt).toISOString().replace("T", " ").slice(0, 19)} awb=${e.awbNumber || "-"} ` +
      `status=${e.statusUpdate || "-"} state=${e.processingState || "-"} order=${e.orderId || "-"}`
    );
  }
  if (total === 0) {
    console.log("  (none) → Shiprocket has not delivered a single authenticated webhook to this backend.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
