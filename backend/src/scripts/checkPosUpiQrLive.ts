/**
 * Smoke test for POS UPI QR: creates a ₹1 single-use Razorpay QR with the configured keys,
 * reads its status, then closes it immediately. Never prints key values.
 * Run: npx tsx src/scripts/checkPosUpiQrLive.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { applyRazorpayMode } from "../config/razorpayEnv";
import { createPosUpiQr, getPosUpiQrStatus, closePosUpiQr } from "../services/posUpiQrService";

(async () => {
  const mode = applyRazorpayMode();
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  console.log(`Key ID present: ${Boolean(keyId)} | prefix: ${keyId.slice(0, 9) || "(none)"} | secret present: ${Boolean(process.env.RAZORPAY_KEY_SECRET)}`);

  try {
    const qr = await createPosUpiQr(1, { businessName: "Olovely POS test" });
    console.log(`CREATE OK (${mode}) → id=${qr.qrCodeId}, image=${qr.imageUrl ? "yes" : "MISSING"}`);
    const status = await getPosUpiQrStatus(qr.qrCodeId);
    console.log(`STATUS OK → qrStatus=${status.qrStatus}, isPos=${status.isPos}, paid=${status.paid}`);
    await closePosUpiQr(qr.qrCodeId);
    console.log("CLOSE OK → test QR cancelled");
  } catch (err: any) {
    console.log(`FAILED → [${err?.statusCode ?? "?"}] ${err?.message}`);
    process.exitCode = 1;
  }
})();
