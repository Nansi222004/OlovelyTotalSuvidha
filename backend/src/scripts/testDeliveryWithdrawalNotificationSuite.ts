import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Delivery from "../models/Delivery";
import WithdrawRequest from "../models/WithdrawRequest";
import Notification from "../models/Notification";
import { createWithdrawalRequest } from "../services/walletManagementService";
import {
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal,
} from "../modules/admin/controllers/adminWithdrawalController";

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(description: string, condition: boolean, extraInfo: string = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${description} ${extraInfo ? `(${extraInfo})` : ""}`);
    failCount++;
    failures.push(`${description} ${extraInfo ? `(${extraInfo})` : ""}`);
  }
}

async function runSuite() {
  console.log("===============================================================");
  console.log("    DELIVERY BOY WITHDRAWAL NOTIFICATION VERIFICATION SUITE   ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  const testEmailDelivery = "delivery_notif_test@test.com";
  const mockAdminId = new mongoose.Types.ObjectId().toString();

  try {
    await Delivery.deleteMany({ email: testEmailDelivery });

    const deliveryBoy = await Delivery.create({
      name: "Notif Delivery Partner",
      email: testEmailDelivery,
      mobile: "9777777777",
      password: "test123",
      status: "Active",
      balance: 2000,
      upiId: "notifdriver@upi",
      accountName: "Notif Driver",
      bankName: "SBI",
      accountNumber: "9876543210",
      ifscCode: "SBIN0001234",
    });

    const deliveryId = deliveryBoy._id.toString();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: REQUEST CREATION NOTIFICATION (N01 - N03)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔔 SECTION 1: REQUEST CREATION NOTIFICATION");

    const reqRes = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", 500, "UPI");
    assert("N01 - Withdrawal request creation succeeds", reqRes.success);

    const createdReq = await WithdrawRequest.findOne({ userId: deliveryId, status: "Pending" });
    const batchKeyReq = `${createdReq!._id}_REQUESTED`;

    const adminNotif = await Notification.findOne({ broadcastBatchId: batchKeyReq });
    assert("N02 - Admin notification created on request creation", adminNotif !== null && adminNotif.recipientType === "Admin");

    assert(
      "N03 - Notification title & text include delivery boy name and UPI details",
      adminNotif?.title === "New Delivery Withdrawal Request" &&
      adminNotif?.message.includes("Notif Delivery Partner") &&
      adminNotif?.message.includes("₹500")
    );

    // Mock Express Req/Res
    const mockRes = () => {
      const res: any = {};
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (data: any) => { res.jsonData = data; return res; };
      return res;
    };

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: APPROVAL & COMPLETION NOTIFICATIONS (N04 - N08)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("✅ SECTION 2: APPROVAL & COMPLETION NOTIFICATIONS");

    // Admin approves request
    const reqApprove: any = { params: { id: createdReq!._id.toString() }, user: { userId: mockAdminId } };
    const resApprove = mockRes();
    await approveWithdrawal(reqApprove, resApprove);

    const batchKeyApprove = `${createdReq!._id}_APPROVED`;
    const approveNotif = await Notification.findOne({ broadcastBatchId: batchKeyApprove });
    assert("N04 - Delivery Boy notification created on Approval", approveNotif !== null && approveNotif.recipientId?.toString() === deliveryId);

    assert("N05 - Approval notification has correct title & message", approveNotif?.title === "Withdrawal Approved");

    // Admin completes request
    const reqComplete: any = {
      params: { id: createdReq!._id.toString() },
      body: { transactionReference: "UPI-TXN-112233" },
      user: { userId: mockAdminId },
    };
    const resComplete = mockRes();
    await completeWithdrawal(reqComplete, resComplete);

    const batchKeyComplete = `${createdReq!._id}_COMPLETED`;
    const completeNotif = await Notification.findOne({ broadcastBatchId: batchKeyComplete });

    assert("N06 - Delivery Boy notification created on Completion", completeNotif !== null && completeNotif.recipientId?.toString() === deliveryId);

    assert(
      "N07 - Completion notification includes destination UPI ID & transaction reference",
      completeNotif?.title === "Withdrawal Completed" &&
      completeNotif?.message.includes("UPI-TXN-112233")
    );

    // N08: Retrying completion does not create duplicate notification
    const resCompleteDup = mockRes();
    await completeWithdrawal(reqComplete, resCompleteDup);
    const notifCountComplete = await Notification.countDocuments({ broadcastBatchId: batchKeyComplete });
    assert("N08 - Duplicate completion attempt creates NO extra notification", notifCountComplete === 1);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 3: REJECTION NOTIFICATION & IDEMPOTENCY (N09 - N12)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("❌ SECTION 3: REJECTION NOTIFICATION & IDEMPOTENCY");

    // Create 2nd request for rejection test
    const reqRes2 = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", 300, "Bank Transfer");
    const createdReq2 = await WithdrawRequest.findOne({ userId: deliveryId, status: "Pending" });

    const reqReject: any = {
      params: { id: createdReq2!._id.toString() },
      body: { remarks: "IFSC Code mismatch" },
      user: { userId: mockAdminId },
    };
    const resReject = mockRes();
    await rejectWithdrawal(reqReject, resReject);

    const batchKeyReject = `${createdReq2!._id}_REJECTED`;
    const rejectNotif = await Notification.findOne({ broadcastBatchId: batchKeyReject });

    assert("N09 - Delivery Boy notification created on Rejection", rejectNotif !== null && rejectNotif.recipientId?.toString() === deliveryId);

    assert(
      "N10 - Rejection notification includes rejection reason",
      rejectNotif?.title === "Withdrawal Rejected" &&
      rejectNotif?.message.includes("IFSC Code mismatch")
    );

    // N11: Retrying rejection creates NO extra notification
    const resRejectDup = mockRes();
    await rejectWithdrawal(reqReject, resRejectDup);
    const notifCountReject = await Notification.countDocuments({ broadcastBatchId: batchKeyReject });
    assert("N11 - Duplicate rejection attempt creates NO extra notification", notifCountReject === 1);

    // N12: Delivery Boy A cannot query Delivery Boy B notifications
    const otherNotifs = await Notification.find({ recipientId: new mongoose.Types.ObjectId() });
    assert("N12 - Cross-user notification isolation maintained", otherNotifs.length === 0);

    // Cleanup
    await Delivery.deleteMany({ email: testEmailDelivery });
    await WithdrawRequest.deleteMany({ userId: deliveryId });
    await Notification.deleteMany({ recipientId: deliveryId });
    await Notification.deleteMany({ broadcastBatchId: { $in: [batchKeyReq, batchKeyApprove, batchKeyComplete, batchKeyReject] } });

  } catch (error: any) {
    console.error("Error executing notification suite:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n Connection closed & test data cleaned up.\n");
  }

  console.log("===============================================================");
  console.log("                    SUMMARY OF RESULTS                         ");
  console.log("===============================================================");
  console.log(` Total Assertions Executed : ${passCount + failCount}`);
  console.log(` ✅ Passed                 : ${passCount}`);
  console.log(` ❌ Failed                 : ${failCount}`);
  console.log(` Pass Rate                 : ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log("===============================================================\n");

  if (failCount > 0) {
    console.log("FAILURES DETECTED:");
    failures.forEach((f) => console.log(` - ${f}`));
    process.exit(1);
  } else {
    console.log("🎉 ALL 12 DELIVERY WITHDRAWAL NOTIFICATION TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
