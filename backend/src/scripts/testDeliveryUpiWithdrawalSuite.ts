import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Delivery from "../models/Delivery";
import WithdrawRequest from "../models/WithdrawRequest";
import WalletTransaction from "../models/WalletTransaction";
import {
  createWithdrawalRequest,
  validateWithdrawal,
} from "../services/walletManagementService";
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
  console.log("     DELIVERY BOY UPI WITHDRAWAL & BALANCE SAFETY SUITE       ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  const testEmailDelivery = "delivery_upi_test@test.com";
  const mockAdminId = new mongoose.Types.ObjectId().toString();

  try {
    await Delivery.deleteMany({ email: testEmailDelivery });

    // Create Test Delivery Boy
    const deliveryBoy = await Delivery.create({
      name: "UPI Delivery Partner",
      email: testEmailDelivery,
      mobile: "9888888888",
      password: "test123",
      status: "Active",
      balance: 1000,
      upiId: "driver@upi",
      accountName: "UPI Driver",
      bankName: "HDFC Bank",
      accountNumber: "1234567890",
      ifscCode: "HDFC0001234",
    });

    const deliveryId = deliveryBoy._id.toString();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: PROFILE & UPI REGEX VALIDATION (U01 - U05)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📲 SECTION 1: PROFILE & UPI REGEX VALIDATION");

    // U01: Valid UPI ID validation passes
    const validCheck = await validateWithdrawal(deliveryId, "DELIVERY_BOY", 200, "UPI");
    assert("U01 - Valid UPI ID passes validation", validCheck.success);

    // U02: Invalid UPI regex failure
    deliveryBoy.upiId = "invalid_upi_format";
    await deliveryBoy.save();
    const invalidCheck = await validateWithdrawal(deliveryId, "DELIVERY_BOY", 200, "UPI");
    assert("U02 - Invalid UPI ID format fails validation", !invalidCheck.success);

    // U03: Missing UPI ID failure
    deliveryBoy.upiId = undefined;
    await deliveryBoy.save();
    const missingCheck = await validateWithdrawal(deliveryId, "DELIVERY_BOY", 200, "UPI");
    assert("U03 - Missing UPI ID fails validation", !missingCheck.success);

    // Restore valid UPI ID
    deliveryBoy.upiId = "driver@okicici";
    await deliveryBoy.save();

    // U04: Withdrawal creation snapshots upiId
    const reqRes = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", 300, "UPI");
    assert("U04 - Withdrawal creation succeeds and snapshots upiId", reqRes.success);

    const createdReq = await WithdrawRequest.findOne({ userId: deliveryId, status: "Pending" });
    assert("U05 - Created request contains correct snapshotted upiId", createdReq?.upiId === "driver@okicici");

    // U06: Updating delivery profile UPI does NOT affect already created request snapshot
    deliveryBoy.upiId = "changed_driver@ybl";
    await deliveryBoy.save();
    const reFetchedReq = await WithdrawRequest.findById(createdReq!._id);
    assert("U06 - Changing profile upiId does not mutate historic request snapshot", reFetchedReq?.upiId === "driver@okicici");

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: WITHDRAWAL LIFECYCLE & REGRESSION SAFETY (R01 - R12)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔄 SECTION 2: WITHDRAWAL LIFECYCLE & REGRESSION SAFETY");

    // R01: Duplicate request while pending is blocked
    const dupRes = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", 100, "UPI");
    assert("R01 - Duplicate withdrawal request while pending is blocked", !dupRes.success);

    // Mock Express Req/Res for admin controller
    const mockRes = () => {
      const res: any = {};
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (data: any) => { res.jsonData = data; return res; };
      return res;
    };

    // R02: Admin approves withdrawal
    const reqApprove: any = { params: { id: createdReq!._id.toString() }, user: { userId: mockAdminId } };
    const resApprove = mockRes();
    await approveWithdrawal(reqApprove, resApprove);
    assert("R02 - Admin approves withdrawal request", resApprove.statusCode === 200);

    const approvedReq = await WithdrawRequest.findById(createdReq!._id);
    assert("R03 - Withdrawal status becomes Approved", approvedReq?.status === "Approved");

    // R04: Admin completes withdrawal with transaction reference
    const reqComplete: any = {
      params: { id: createdReq!._id.toString() },
      body: { transactionReference: "UPI-TXN-998877" },
      user: { userId: mockAdminId },
    };
    const resComplete = mockRes();
    await completeWithdrawal(reqComplete, resComplete);
    assert("R04 - Admin completes withdrawal request", resComplete.statusCode === 200);

    const postDB = await Delivery.findById(deliveryId);
    assert("R05 - Delivery boy balance deducted upon completion (1000 - 300 = 700)", postDB?.balance === 700);

    // R06: Completed withdrawal cannot be completed again
    const resComplete2 = mockRes();
    await completeWithdrawal(reqComplete, resComplete2);
    assert("R06 - Duplicate completion request is blocked", resComplete2.statusCode === 400);

    // R07: Create new request and reject it
    deliveryBoy.upiId = "driver@okicici";
    await deliveryBoy.save();
    const reqRes2 = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", 200, "UPI");
    const createdReq2 = await WithdrawRequest.findOne({ userId: deliveryId, status: "Pending" });

    const reqReject: any = {
      params: { id: createdReq2!._id.toString() },
      body: { remarks: "Incorrect account name" },
      user: { userId: mockAdminId },
    };
    const resReject = mockRes();
    await rejectWithdrawal(reqReject, resReject);

    assert("R07 - Admin rejects withdrawal request", resReject.statusCode === 200);

    const rejectedReq = await WithdrawRequest.findById(createdReq2!._id);
    assert("R08 - Rejected withdrawal status updated with remarks", rejectedReq?.status === "Rejected" && rejectedReq?.remarks === "Incorrect account name");

    const finalDB = await Delivery.findById(deliveryId);
    assert("R09 - Rejected withdrawal restores/maintains available balance at ₹700", finalDB?.balance === 700);

    // R10: Approved request cannot be approved again
    const resApprove2 = mockRes();
    await approveWithdrawal(reqApprove, resApprove2);
    assert("R10 - Cannot re-approve an already processed withdrawal", resApprove2.statusCode === 400);

    // R11: Bank Transfer validation fallback works
    const bankCheck = await validateWithdrawal(deliveryId, "DELIVERY_BOY", 100, "Bank Transfer");
    assert("R11 - Bank transfer withdrawal validation works", bankCheck.success);

    // Cleanup
    await Delivery.deleteMany({ email: testEmailDelivery });
    await WithdrawRequest.deleteMany({ userId: deliveryId });
    await WalletTransaction.deleteMany({ userId: deliveryId });

  } catch (error: any) {
    console.error("Error executing UPI suite:", error);
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
    console.log("🎉 ALL DELIVERY UPI WITHDRAWAL & BALANCE SAFETY TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
