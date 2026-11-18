/**
 * Picks the Razorpay key set based on RAZORPAY_LIVE_MODE.
 *
 *   RAZORPAY_LIVE_MODE=true  -> RAZORPAY_LIVE_KEY_ID / _KEY_SECRET / _WEBHOOK_SECRET
 *   RAZORPAY_LIVE_MODE=false -> RAZORPAY_TEST_KEY_ID / _KEY_SECRET / _WEBHOOK_SECRET
 *
 * The chosen values are copied into RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
 * RAZORPAY_WEBHOOK_SECRET so the rest of the code keeps working unchanged.
 * If the prefixed set is missing, any plain RAZORPAY_* values already set are kept.
 */
export const applyRazorpayMode = (): "live" | "test" => {
  const isLive =
    String(process.env.RAZORPAY_LIVE_MODE || "").trim().toLowerCase() === "true";
  const prefix = isLive ? "RAZORPAY_LIVE_" : "RAZORPAY_TEST_";

  for (const name of ["KEY_ID", "KEY_SECRET", "WEBHOOK_SECRET"]) {
    const value = process.env[`${prefix}${name}`];
    if (value) process.env[`RAZORPAY_${name}`] = value;
  }

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const mode = isLive ? "live" : "test";
  if (keyId && !keyId.startsWith(`rzp_${mode}_`)) {
    console.warn(
      `⚠️  RAZORPAY_LIVE_MODE=${isLive} but RAZORPAY_KEY_ID does not look like a ${mode} key.`
    );
  }
  console.log(`💳 Razorpay running in ${mode.toUpperCase()} mode`);
  return mode;
};
