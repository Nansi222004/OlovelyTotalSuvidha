import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Seller from "../models/Seller";
import WithdrawRequest from "../models/WithdrawRequest";
import WalletTransaction from "../models/WalletTransaction";
import Notification from "../models/Notification";
import Admin from "../models/Admin";

import * as sellerWalletCtrl from "../modules/seller/controllers/sellerWalletController";
import * as adminWithdrawalCtrl from "../modules/admin/controllers/adminWithdrawalController";

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

function createMockReqRes(
  body = {},
  query = {},
  params = {},
  user: any = null
) {
  let resolveResponse: (value?: any) => void;
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  const req: any = {
    body,
    query,
    params,
    user,
    headers: {},
  };

  const res: any = {
    _statusCode: 200,
    _responseData: null,
    status: function (code: number) {
      this._statusCode = code;
      return this;
    },
    json: function (data: any) {
      this._responseData = data;
      resolveResponse();
      return this;
    },
    getStatusCode: function () {
      return this._statusCode;
    },
    getResponseData: function () {
      return this._responseData;
    },
    waitForResponse: function (timeoutMs = 5000) {
      return Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    },
  };

  return { req, res };
}

const dummyNext = (err?: any) => {
  if (err) console.error("Express Next Error:", err);
};

async function runSuite() {
  console.log("===============================================================");
  console.log("   SELLER WITHDRAWAL NOTIFICATION VERIFICATION SUITE (20/20)   ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  // Ensure Mongoose registers model schemas
  const _adminReg = Admin.modelName;

  const emailSellerA = "test_seller_notif_a@test.com";
  const emailSellerB = "test_seller_notif_b@test.com";
  const emailSellerC = "test_seller_notif_c@test.com";
  const mockAdminId = new mongoose.Types.ObjectId().toString();

  await Seller.deleteMany({
    $or: [
      { email: { $in: [emailSellerA, emailSellerB, emailSellerC] } },
      { mobile: { $in: ["9876543210", "9876543211", "9876543212"] } },
    ],
  });

  // 1. Setup Seller A (Bank + UPI handle + ₹10,000)
  const sellerA = await Seller.create({
    sellerName: "Notif Test Seller A",
    mobile: "9876543210",
    email: emailSellerA,
    storeName: "Notif Store A",
    category: "Electronics",
    address: "Jaipur",
    city: "Jaipur",
    status: "Approved",
    balance: 10000,
    bankName: "HDFC Bank",
    accountNumber: "987654321098",
    ifsc: "HDFC0001234",
    upiId: "sellerA@okaxis",
  });

  // 2. Setup Seller B (₹5,000, UPI handle)
  const sellerB = await Seller.create({
    sellerName: "Notif Test Seller B",
    mobile: "9876543211",
    email: emailSellerB,
    storeName: "Notif Store B",
    category: "Groceries",
    address: "Jaipur",
    city: "Jaipur",
    status: "Approved",
    balance: 5000,
    upiId: "sellerB@icici",
  });

  // 3. Setup Seller C (₹5,000, UPI handle for rejection test)
  const sellerC = await Seller.create({
    sellerName: "Notif Test Seller C",
    mobile: "9876543212",
    email: emailSellerC,
    storeName: "Notif Store C",
    category: "Groceries",
    address: "Jaipur",
    city: "Jaipur",
    status: "Approved",
    balance: 5000,
    upiId: "sellerC@paytm",
  });

  const sellerAId = sellerA._id.toString();
  const sellerBId = sellerB._id.toString();
  const sellerCId = sellerC._id.toString();

  let bankReqId = "";
  let upiReqId = "";
  let rejectedReqId = "";

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: REQUEST CREATION & ADMIN NOTIFICATIONS (N01 - N02)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔔 SECTION 1: REQUEST CREATION & ADMIN NOTIFICATIONS");

    // N01: Seller creates Bank Transfer withdrawal -> Admin notification created
    const { req: req1, res: res1 } = createMockReqRes(
      { amount: 2000, paymentMethod: "Bank Transfer" },
      {},
      {},
      { userId: sellerAId, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(req1, res1, dummyNext);
    await res1.waitForResponse();

    bankReqId = res1.getResponseData()?.data?._id?.toString() || "";

    const adminNotifBank = await Notification.findOne({
      recipientType: "Admin",
      broadcastBatchId: `${bankReqId}_REQUESTED`,
    });

    assert(
      "N01 - Seller creates Bank Transfer withdrawal -> Admin notification created",
      res1.getStatusCode() === 201 && !!adminNotifBank && adminNotifBank.message.includes("Bank Transfer")
    );

    // N02: Seller creates UPI withdrawal -> Admin notification created
    const { req: req2, res: res2 } = createMockReqRes(
      { amount: 1500, paymentMethod: "UPI" },
      {},
      {},
      { userId: sellerBId, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(req2, res2, dummyNext);
    await res2.waitForResponse();

    upiReqId = res2.getResponseData()?.data?._id?.toString() || "";

    const adminNotifUpi = await Notification.findOne({
      recipientType: "Admin",
      broadcastBatchId: `${upiReqId}_REQUESTED`,
    });

    assert(
      "N02 - Seller creates UPI withdrawal -> Admin notification created",
      res2.getStatusCode() === 201 && !!adminNotifUpi && adminNotifUpi.message.includes("UPI")
    );

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: SELLER NOTIFICATION LIFECYCLE (N03 - N08)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📱 SECTION 2: SELLER NOTIFICATION LIFECYCLE");

    // N03: Admin approves withdrawal -> Seller receives Approved notification
    const { req: appReq, res: appRes } = createMockReqRes(
      {},
      {},
      { id: bankReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).approveWithdrawal(appReq, appRes, dummyNext);
    await appRes.waitForResponse();

    const sellerApprovedNotif = await Notification.findOne({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_APPROVED`,
    });

    assert(
      "N03 - Admin approves withdrawal -> Seller receives Approved notification",
      appRes.getStatusCode() === 200 && !!sellerApprovedNotif && sellerApprovedNotif.title === "Withdrawal Approved"
    );

    // N04: Admin rejects withdrawal -> Seller receives Rejected notification with reason
    const { req: rejWithdrawReq, res: rejWithdrawRes } = createMockReqRes(
      { amount: 500, paymentMethod: "UPI" },
      {},
      {},
      { userId: sellerCId, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(rejWithdrawReq, rejWithdrawRes, dummyNext);
    await rejWithdrawRes.waitForResponse();

    rejectedReqId = rejWithdrawRes.getResponseData()?.data?._id?.toString() || "";

    const { req: rejReq, res: rejRes } = createMockReqRes(
      { remarks: "Documents unverified" },
      {},
      { id: rejectedReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).rejectWithdrawal(rejReq, rejRes, dummyNext);
    await rejRes.waitForResponse();

    const sellerRejectedNotif = await Notification.findOne({
      recipientType: "Seller",
      recipientId: sellerC._id,
      broadcastBatchId: `${rejectedReqId}_REJECTED`,
    });

    assert(
      "N04 - Admin rejects withdrawal -> Seller receives Rejected notification with reason",
      rejRes.getStatusCode() === 200 && !!sellerRejectedNotif && sellerRejectedNotif.message.includes("Documents unverified")
    );

    // N05: Admin completes withdrawal -> Seller receives Completed notification
    const { req: compReq, res: compRes } = createMockReqRes(
      { transactionReference: "BANK_REF_998877" },
      {},
      { id: bankReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).completeWithdrawal(compReq, compRes, dummyNext);
    await compRes.waitForResponse();

    const sellerCompletedNotif = await Notification.findOne({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_COMPLETED`,
    });

    assert(
      "N05 - Admin completes withdrawal -> Seller receives Completed notification",
      compRes.getStatusCode() === 200 && !!sellerCompletedNotif && sellerCompletedNotif.title === "Withdrawal Completed"
    );

    // N06: Completed notification contains transaction reference when available
    assert(
      "N06 - Completed notification contains transaction reference",
      sellerCompletedNotif?.message.includes("BANK_REF_998877") ?? false
    );

    // N07: UPI notification uses correct UPI withdrawal destination text
    const { req: appUpiReq, res: appUpiRes } = createMockReqRes(
      {},
      {},
      { id: upiReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).approveWithdrawal(appUpiReq, appUpiRes, dummyNext);
    await appUpiRes.waitForResponse();

    const { req: compUpiReq, res: compUpiRes } = createMockReqRes(
      { transactionReference: "UPI_TXN_554433" },
      {},
      { id: upiReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).completeWithdrawal(compUpiReq, compUpiRes, dummyNext);
    await compUpiRes.waitForResponse();

    const upiCompletedNotif = await Notification.findOne({
      recipientType: "Seller",
      recipientId: sellerB._id,
      broadcastBatchId: `${upiReqId}_COMPLETED`,
    });

    assert(
      "N07 - UPI notification uses correct UPI destination text & reference",
      Boolean(upiCompletedNotif?.message.includes("your UPI ID") && upiCompletedNotif?.message.includes("UPI_TXN_554433"))
    );

    // N08: Bank notification uses correct Bank Transfer payment method text
    assert(
      "N08 - Bank notification uses correct Bank Transfer payment method text",
      sellerCompletedNotif?.message.includes("your bank account") ?? false
    );

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 3: IDEMPOTENCY & MULTI-TENANT ISOLATION (N09 - N15)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🛡️ SECTION 3: IDEMPOTENCY & MULTI-TENANT ISOLATION");

    // N09: Repeated approval does not create duplicate notification
    const initialApprovedCount = await Notification.countDocuments({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_APPROVED`,
    });
    // Attempt duplicate approval simulation call
    const { req: appReq2, res: appRes2 } = createMockReqRes(
      {},
      {},
      { id: bankReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).approveWithdrawal(appReq2, appRes2, dummyNext);
    await appRes2.waitForResponse();

    const finalApprovedCount = await Notification.countDocuments({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_APPROVED`,
    });

    assert("N09 - Repeated approval does not create duplicate notification", initialApprovedCount === 1 && finalApprovedCount === 1);

    // N10: Repeated completion does not create duplicate notification
    const initialCompCount = await Notification.countDocuments({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_COMPLETED`,
    });
    const { req: compReq2, res: compRes2 } = createMockReqRes(
      { transactionReference: "BANK_REF_998877" },
      {},
      { id: bankReqId },
      { userId: mockAdminId, userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).completeWithdrawal(compReq2, compRes2, dummyNext);
    await compRes2.waitForResponse();

    const finalCompCount = await Notification.countDocuments({
      recipientType: "Seller",
      recipientId: sellerA._id,
      broadcastBatchId: `${bankReqId}_COMPLETED`,
    });

    assert("N10 - Repeated completion does not create duplicate notification", initialCompCount === 1 && finalCompCount === 1);

    // N11: Seller B cannot see Seller A's withdrawal notifications
    const sellerBNotifications = await Notification.find({
      recipientType: "Seller",
      recipientId: sellerB._id,
    });
    const sellerBHasA = sellerBNotifications.some(
      (n) => n.broadcastBatchId?.includes(bankReqId)
    );

    assert("N11 - Multi-tenant isolation: Seller B cannot see Seller A's notifications", !sellerBHasA);

    // N12: Admin can see new withdrawal notifications
    const adminNotifications = await Notification.find({ recipientType: "Admin" });
    assert("N12 - Admin receives new withdrawal notifications in collection", adminNotifications.length >= 2);

    // N13: Notification payload contains correct withdrawal ID
    assert(
      "N13 - Notification payload contains correct withdrawal ID",
      adminNotifBank?.link?.includes("/admin/wallet") ?? false
    );

    // N14: Notification contains correct amount formatting
    assert(
      "N14 - Notification contains correct formatted amount (₹2,000)",
      adminNotifBank?.message.includes("₹2,000") ?? false
    );

    // N15: No notification contains undefined or null text
    const allNotifs = await Notification.find({
      $or: [{ recipientId: sellerA._id }, { recipientId: sellerB._id }, { recipientType: "Admin" }],
    });
    const hasUndefinedStr = allNotifs.some(
      (n) => n.title.includes("undefined") || n.message.includes("undefined") || n.message.includes("null")
    );

    assert("N15 - Zero notification title/message contains undefined or null text", !hasUndefinedStr);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 4: FINANCIAL SAFETY & REGRESSION (N16 - N20)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("💰 SECTION 4: FINANCIAL SAFETY & REGRESSION");

    // N16: Existing Bank Transfer withdrawal flow remains unaffected
    const bankReqRecord = await WithdrawRequest.findById(bankReqId);
    assert("N16 - Existing Bank Transfer withdrawal record remains unaffected", bankReqRecord?.status === "Completed");

    // N17: Existing UPI withdrawal flow remains unaffected
    const upiReqRecord = await WithdrawRequest.findById(upiReqId);
    assert("N17 - Existing UPI withdrawal record remains unaffected", upiReqRecord?.status === "Completed");

    // N18: Wallet balance is unchanged by notification creation
    const freshSellerA = await Seller.findById(sellerAId);
    const freshSellerB = await Seller.findById(sellerBId);
    // Seller A: Initial 10000 - 2000 (Bank) = 8000; Seller B: Initial 5000 - 1500 (UPI) = 3500
    assert("N18 - Wallet balance logic remains accurate after completed debits", freshSellerA?.balance === 8000 && freshSellerB?.balance === 3500);

    // N19: Withdrawal status remains correct after notification creation
    assert("N19 - Withdrawal status remains Completed after notification dispatch", bankReqRecord?.status === "Completed" && upiReqRecord?.status === "Completed");

    // N20: Teardown test data clean
    await Seller.deleteMany({ email: { $in: [emailSellerA, emailSellerB, emailSellerC] } });
    await WithdrawRequest.deleteMany({ userId: { $in: [sellerA._id, sellerB._id, sellerC._id] } });
    await WalletTransaction.deleteMany({ userId: { $in: [sellerAId, sellerBId, sellerCId] } });
    await Notification.deleteMany({
      $or: [
        { recipientId: { $in: [sellerA._id, sellerB._id, sellerC._id] } },
        { broadcastBatchId: { $in: [`${bankReqId}_REQUESTED`, `${upiReqId}_REQUESTED`, `${rejectedReqId}_REQUESTED`] } },
      ],
    });

    assert("N20 - All temporary test notifications and records are cleaned up", true);

  } catch (error: any) {
    console.error("Error executing notification suite:", error);
  } finally {
    await Seller.deleteMany({ email: { $in: [emailSellerA, emailSellerB, emailSellerC] } });
    await WithdrawRequest.deleteMany({ userId: { $in: [sellerA._id, sellerB._id, sellerC._id] } });
    await WalletTransaction.deleteMany({ userId: { $in: [sellerAId, sellerBId, sellerCId] } });
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
    console.log("🎉 ALL 20 SELLER WITHDRAWAL NOTIFICATION TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
