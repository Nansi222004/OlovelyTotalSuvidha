import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Admin from "../models/Admin";
import Customer from "../models/Customer";
import Notification from "../models/Notification";
import { login, sendOTP as disabledAdminSendOtp, verifyOTP as disabledAdminVerifyOtp } from "../modules/admin/controllers/adminAuthController";
import { sendOrderStatusNotification } from "../services/notificationService";
import { verifyToken } from "../services/jwtService";
import { sendSmsOtp, verifySmsOtp } from "../services/otpService";
import { isDefaultOtpMode } from "../services/deliveryOtpService";
import { getFulfillmentTrackingMessage, getOrderTrackingHeader } from "../../../frontend/src/utils/orderTrackingMessaging";

type Result = { status: number; body: any };
const results: string[] = [];
const pass = (name: string) => results.push(name);

function invoke(handler: any, body: Record<string, unknown>): Promise<Result> {
  return new Promise((resolve, reject) => {
    let status = 200;
    const response = {
      status(code: number) { status = code; return this; },
      json(payload: any) { resolve({ status, body: payload }); return this; },
    };
    handler({ body } as any, response as any, reject);
  });
}

async function main() {
  const memory = await MongoMemoryServer.create();
  const oldJwt = process.env.JWT_SECRET;
  const oldOtpMode = process.env.USE_DEFAULT_OTP;
  process.env.JWT_SECRET = "three-issue-isolated-test-secret";

  try {
    await mongoose.connect(memory.getUri());
    await Notification.syncIndexes();

    const admin = await Admin.create({
      firstName: "Test",
      lastName: "Admin",
      mobile: "9876543210",
      email: "admin-test@example.com",
      password: "CorrectPassword123!",
      role: "Admin",
    });
    const storedAdmin = await Admin.findById(admin._id).select("+password");
    assert.ok(storedAdmin?.password.startsWith("$2"), "admin password must be bcrypt hashed");

    const valid = await invoke(login, { email: "ADMIN-TEST@EXAMPLE.COM", password: "CorrectPassword123!" });
    assert.equal(valid.status, 200);
    assert.equal(verifyToken(valid.body.data.token).userType, "Admin");
    assert.equal(valid.body.data.user.password, undefined);
    pass("admin valid credentials issue existing Admin JWT without exposing hash");

    const wrongPassword = await invoke(login, { email: "admin-test@example.com", password: "wrong" });
    const wrongEmail = await invoke(login, { email: "missing@example.com", password: "wrong" });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongEmail.status, 401);
    assert.equal(wrongPassword.body.message, wrongEmail.body.message);
    pass("admin invalid email/password use the same safe rejection");

    assert.equal((await invoke(disabledAdminSendOtp, { mobile: "9876543210" })).status, 410);
    assert.equal((await invoke(disabledAdminVerifyOtp, { mobile: "9876543210", otp: "9999" })).status, 410);
    const adminControllerSource = fs.readFileSync(path.join(process.cwd(), "src/modules/admin/controllers/adminAuthController.ts"), "utf8");
    assert.ok(!adminControllerSource.includes("services/otpService"));
    pass("admin login has zero OTP/SMS service dependency and legacy endpoints are disabled");

    process.env.USE_DEFAULT_OTP = "true";
    const customerOtp = await sendSmsOtp("9123456789", "Customer");
    assert.equal(customerOtp.success, true);
    assert.equal(await verifySmsOtp(customerOtp.sessionId!, "9999", "9123456789", "Customer"), true);
    assert.equal(isDefaultOtpMode(), true);
    process.env.USE_DEFAULT_OTP = "false";
    assert.equal(isDefaultOtpMode(), false);
    const otpSource = fs.readFileSync(path.join(process.cwd(), "src/services/otpService.ts"), "utf8");
    assert.ok(otpSource.includes("await deliverOtp(mobileStr, otp)"));
    const returnOtpSource = fs.readFileSync(path.join(process.cwd(), "src/services/returnLifecycleService.ts"), "utf8");
    assert.ok(returnOtpSource.includes("USE_DEFAULT_OTP"));
    pass("customer, delivery, and return OTP flows retain the shared switch; real mode retains SMS delivery path");

    const customer = await Customer.create({ name: "Notification Test", phone: "9123456790" });
    const customerId = customer._id.toString();
    const orderId = new mongoose.Types.ObjectId().toString();
    const emitted: any[] = [];
    const io = { to: (room: string) => ({ emit: (event: string, payload: any) => emitted.push({ room, event, payload }) }) };
    await sendOrderStatusNotification(orderId, customerId, "Accepted", io);
    await sendOrderStatusNotification(orderId, customerId, "Accepted", io);
    assert.equal(await Notification.countDocuments({ recipientId: customerId, eventId: `order:${orderId}:status:accepted` }), 1);
    assert.equal(emitted.length, 2, "one logical event emits one update to each intentional Socket.IO room");
    assert.ok(emitted.every((entry) => entry.payload.eventId === `order:${orderId}:status:accepted`));
    pass("one accepted event persists once; reprocessing creates no record, push, or socket duplicate");

    await Admin.findByIdAndUpdate(admin._id, [{ $set: { fcmTokens: { $slice: [{ $setUnion: [{ $ifNull: ["$fcmTokens", []] }, ["same-token"]] }, -10] } } }]);
    await Admin.findByIdAndUpdate(admin._id, [{ $set: { fcmTokens: { $slice: [{ $setUnion: [{ $ifNull: ["$fcmTokens", []] }, ["same-token"]] }, -10] } } }]);
    assert.deepEqual((await Admin.findById(admin._id).lean())?.fcmTokens, ["same-token"]);
    pass("duplicate token registration leaves one effective subscription");

    const qcGroup = { fulfillmentType: "LOCAL_DELIVERY", status: "OutForDelivery" };
    const ecomGroup = { fulfillmentType: "COURIER_SHIPPING", status: "Shipped", shippingDetails: { carrier: "Shiprocket", awbNumber: "AWB123", estimatedDelivery: "2026-10-07T00:00:00.000Z" } };
    assert.equal(getFulfillmentTrackingMessage(qcGroup, {}, 12), "Arriving in 12 mins");
    assert.match(getFulfillmentTrackingMessage(ecomGroup, {}), /^Expected delivery:/);
    assert.ok(!getFulfillmentTrackingMessage(ecomGroup, {}).includes("mins"));
    const mixed = { orderType: "MIXED", fulfillmentGroups: [qcGroup, ecomGroup] };
    assert.equal(getOrderTrackingHeader(mixed, 12)?.isLocalEta, true);
    assert.match(getFulfillmentTrackingMessage(mixed.fulfillmentGroups[1], mixed), /^Expected delivery:/);
    pass("QC, Ecommerce, and Mixed fulfillment messages are group-aware and use stored ETA/AWB data");

    const adminUi = fs.readFileSync(path.join(process.cwd(), "../frontend/src/modules/admin/pages/AdminLogin.tsx"), "utf8");
    assert.ok(adminUi.includes("Email") && adminUi.includes("Password") && adminUi.includes('"Login"'));
    assert.ok(!/Mobile Number|OTPInput|Send OTP|verifyOTP|sendOTP/.test(adminUi));
    const pushClient = fs.readFileSync(path.join(process.cwd(), "../frontend/src/services/pushNotificationService.ts"), "utf8");
    const worker = fs.readFileSync(path.join(process.cwd(), "../frontend/public/firebase-messaging-sw.js"), "utf8");
    assert.ok(pushClient.includes("foregroundUnsubscribe") && pushClient.includes("SHOW_FCM_NOTIFICATION"));
    assert.equal((worker.match(/showNotification\(/g) || []).length, 1);
    assert.ok(worker.includes("recentlyDisplayedEvents"));
    pass("StrictMode listener setup and multi-tab/service-worker OS display have one coordinated path");

    console.log(`PASS ${results.length}/${results.length}`);
    results.forEach((result, index) => console.log(`${index + 1}. PASS - ${result}`));
  } finally {
    await mongoose.disconnect();
    await memory.stop();
    if (oldJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldJwt;
    if (oldOtpMode === undefined) delete process.env.USE_DEFAULT_OTP; else process.env.USE_DEFAULT_OTP = oldOtpMode;
  }
}

main().catch((error) => {
  console.error("FAIL", error);
  process.exitCode = 1;
});
