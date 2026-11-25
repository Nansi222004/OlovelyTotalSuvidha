/**
 * READ-ONLY: today's POS UPI QR codes on the live Razorpay account and the payments made to them.
 * Use when a customer paid at the POS but the sale was not completed.
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkPosUpiPayments.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { applyRazorpayMode } from "../config/razorpayEnv";
import { getRazorpayInstance } from "../services/paymentService";

(async () => {
  applyRazorpayMode();
  const rzp: any = getRazorpayInstance();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = Math.floor(start.getTime() / 1000);

  const qrs: any = await rzp.qrCode.all({ from, count: 50 });
  const items: any[] = qrs?.items || [];
  console.log(`QR codes created today: ${items.length}`);
  for (const qr of items) {
    const created = new Date(Number(qr.created_at) * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(
      `\n${qr.id} | ${created} | status=${qr.status}${qr.close_reason ? ` (${qr.close_reason})` : ""} | ` +
      `amount=₹${Number(qr.payment_amount || 0) / 100} | source=${qr.notes?.source || "-"} | received=${qr.payments_count_received ?? "?"}`
    );
    try {
      const pays: any = await rzp.qrCode.fetchAllPayments(qr.id);
      for (const p of pays?.items || []) {
        console.log(`   payment ${p.id} | ${p.status} | ₹${Number(p.amount) / 100} | ${p.method} | vpa=${p.vpa || "-"}`);
      }
    } catch (e: any) {
      console.log(`   (could not list payments: ${e?.error?.description || e?.message})`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e?.error?.description || e?.message || e);
  process.exit(1);
});
