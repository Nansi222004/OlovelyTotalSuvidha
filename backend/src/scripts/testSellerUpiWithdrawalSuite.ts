import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Seller from "../models/Seller";
import WithdrawRequest from "../models/WithdrawRequest";
import WalletTransaction from "../models/WalletTransaction";
import PlatformWallet from "../models/PlatformWallet";
import Admin from "../models/Admin";

import * as sellerAuthCtrl from "../modules/seller/controllers/sellerAuthController";
import * as sellerWalletCtrl from "../modules/seller/controllers/sellerWalletController";
import * as adminWithdrawalCtrl from "../modules/admin/controllers/adminWithdrawalController";

// Helper for assertions
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
  if (err) {
    console.error("Express Next Error:", err);
  }
};

async function runSuite() {
  console.log("===============================================================");
  console.log("     SELLER UPI DETAILS & WITHDRAWAL VERIFICATION SUITE       ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  // Ensure Admin model is registered in Mongoose
  const _adminReg = Admin.modelName;

  // Cleanup pre-existing test documents if present
  const testSellerEmail1 = "test_seller_upi_1@test.com";
  const testSellerEmail2 = "test_seller_upi_2@test.com";

  await Seller.deleteMany({ email: { $in: [testSellerEmail1, testSellerEmail2] } });

  // 1. Setup Seller 1 (Bank + Balance ₹5000)
  const seller1 = await Seller.create({
    sellerName: "UPI Test Seller 1",
    mobile: "9988776655",
    email: testSellerEmail1,
    storeName: "UPI Test Store 1",
    category: "Groceries",
    address: "Jaipur, Rajasthan",
    city: "Jaipur",
    status: "Approved",
    balance: 5000,
    bankName: "SBI",
    accountNumber: "123456789012",
    ifsc: "SBIN0001234",
  });

  // 2. Setup Seller 2 (Balance ₹3000, No UPI)
  const seller2 = await Seller.create({
    sellerName: "UPI Test Seller 2",
    mobile: "9988776644",
    email: testSellerEmail2,
    storeName: "UPI Test Store 2",
    category: "Groceries",
    address: "Jaipur, Rajasthan",
    city: "Jaipur",
    status: "Approved",
    balance: 3000,
  });

  const seller1Id = seller1._id.toString();
  const seller2Id = seller2._id.toString();

  let upiWithdrawalId: string = "";

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: SELLER UPI ACCOUNT SETTINGS (U01 - U05)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📱 SECTION 1: SELLER UPI ACCOUNT SETTINGS");

    // U01: Seller can save UPI ID
    const { req: updateReq1, res: updateRes1 } = createMockReqRes(
      { upiId: "seller1@upi" },
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerAuthCtrl as any).updateProfile(updateReq1, updateRes1, dummyNext);
    await updateRes1.waitForResponse();

    assert("U01 - Seller can save UPI ID", updateRes1.getStatusCode() === 200 && updateRes1.getResponseData()?.data?.upiId === "seller1@upi");

    // U02: Seller can retrieve saved UPI ID
    const { req: getReq1, res: getRes1 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerAuthCtrl as any).getProfile(getReq1, getRes1, dummyNext);
    await getRes1.waitForResponse();

    assert("U02 - Seller can retrieve saved UPI ID", getRes1.getStatusCode() === 200 && getRes1.getResponseData()?.data?.upiId === "seller1@upi");

    // U03: Seller can update UPI ID to new handle
    const { req: updateReq2, res: updateRes2 } = createMockReqRes(
      { upiId: "seller1new@ybl" },
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerAuthCtrl as any).updateProfile(updateReq2, updateRes2, dummyNext);
    await updateRes2.waitForResponse();

    assert("U03 - Seller can update UPI ID to new value", updateRes2.getStatusCode() === 200 && updateRes2.getResponseData()?.data?.upiId === "seller1new@ybl");

    // U04: Invalid UPI ID format validation check
    const { req: badUpiReq, res: badUpiRes } = createMockReqRes(
      { amount: 500, paymentMethod: "UPI" },
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    // Temporarily set invalid UPI handle on seller 1 for validation check
    await Seller.findByIdAndUpdate(seller1Id, { upiId: "invalid_handle_without_at_symbol" });
    await (sellerWalletCtrl as any).requestWithdrawal(badUpiReq, badUpiRes, dummyNext);
    await badUpiRes.waitForResponse();

    assert("U04 - Invalid UPI ID format rejected during withdrawal validation", badUpiRes.getStatusCode() === 400 && badUpiRes.getResponseData()?.message?.includes("Invalid UPI ID"));

    // Reset valid UPI handle on Seller 1
    await Seller.findByIdAndUpdate(seller1Id, { upiId: "seller1@upi" });

    // U05: Security Isolation - Seller 2 updating profile does NOT alter Seller 1
    const { req: secReq, res: secRes } = createMockReqRes(
      { upiId: "seller2@oksbi" },
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller" }
    );
    await (sellerAuthCtrl as any).updateProfile(secReq, secRes, dummyNext);
    await secRes.waitForResponse();

    const freshSeller1 = await Seller.findById(seller1Id);
    assert("U05 - Multi-tenant security: Seller 2 cannot alter Seller 1's UPI ID", secRes.getStatusCode() === 200 && freshSeller1?.upiId === "seller1@upi");

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: BACKEND UPI WITHDRAWAL VALIDATION & CREATION (U06 - U10)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("💸 SECTION 2: BACKEND UPI WITHDRAWAL VALIDATION & CREATION");

    // U06: UPI withdrawal request succeeds when valid UPI ID exists
    const { req: withdrawReq1, res: withdrawRes1 } = createMockReqRes(
      { amount: 500, paymentMethod: "UPI" },
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(withdrawReq1, withdrawRes1, dummyNext);
    await withdrawRes1.waitForResponse();

    const withdrawData1 = withdrawRes1.getResponseData()?.data;
    upiWithdrawalId = withdrawData1?._id?.toString() || "";

    assert("U06 - UPI withdrawal request succeeds when UPI ID exists", withdrawRes1.getStatusCode() === 201 && withdrawData1?.paymentMethod === "UPI");

    // U07: Backend rejects UPI withdrawal when seller has no saved UPI ID
    // Clear seller2 upiId to ensure no UPI ID is set
    await Seller.findByIdAndUpdate(seller2Id, { upiId: "" });

    const { req: noUpiReq, res: noUpiRes } = createMockReqRes(
      { amount: 500, paymentMethod: "UPI" },
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(noUpiReq, noUpiRes, dummyNext);
    await noUpiRes.waitForResponse();

    assert("U07 - Backend rejects UPI withdrawal when seller has no saved UPI ID", noUpiRes.getStatusCode() === 400 && noUpiRes.getResponseData()?.message?.includes("complete your UPI details"));

    // U08: Withdrawal record stores accurate upiId snapshot
    assert("U08 - Withdrawal record stores accurate upiId snapshot", withdrawData1?.upiId === "seller1@upi" && withdrawData1?.accountDetails === "seller1@upi");

    // U09: Seller sees their own UPI withdrawal in list
    const { req: listReq1, res: listRes1 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).getWithdrawals(listReq1, listRes1, dummyNext);
    await listRes1.waitForResponse();

    const s1Withdrawals = listRes1.getResponseData()?.data || [];
    const foundUpiWithdrawal = s1Withdrawals.some((w: any) => w._id.toString() === upiWithdrawalId);
    assert("U09 - Seller sees their own UPI withdrawal in list", listRes1.getStatusCode() === 200 && foundUpiWithdrawal);

    // U10: Multi-tenant check - Seller 2 cannot see Seller 1's withdrawal
    const { req: listReq2, res: listRes2 } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller2Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).getWithdrawals(listReq2, listRes2, dummyNext);
    await listRes2.waitForResponse();

    const s2Withdrawals = listRes2.getResponseData()?.data || [];
    const seller2HasS1Withdrawal = s2Withdrawals.some((w: any) => w._id.toString() === upiWithdrawalId);
    assert("U10 - Multi-tenant isolation: Seller 2 cannot see Seller 1's withdrawal request", listRes2.getStatusCode() === 200 && !seller2HasS1Withdrawal);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 3: ADMIN WALLET & COMPLETION FLOW (U11 - U15)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("👑 SECTION 3: ADMIN WALLET & COMPLETION FLOW");

    // U11: Admin sees correct UPI ID in withdrawal list
    const { req: adminListReq, res: adminListRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: new mongoose.Types.ObjectId().toString(), userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).getAllWithdrawals(adminListReq, adminListRes, dummyNext);
    await adminListRes.waitForResponse();

    const adminRequests = adminListRes.getResponseData()?.data?.requests || [];
    const adminUpiReq = adminRequests.find((w: any) => w._id.toString() === upiWithdrawalId);

    assert("U11 - Admin receives correct UPI ID in withdrawal list", adminUpiReq && (adminUpiReq.upiId === "seller1@upi" || adminUpiReq.accountDetails === "seller1@upi"));

    // U12: Admin can approve UPI withdrawal request
    const { req: approveReq, res: approveRes } = createMockReqRes(
      {},
      {},
      { id: upiWithdrawalId },
      { userId: new mongoose.Types.ObjectId().toString(), userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).approveWithdrawal(approveReq, approveRes, dummyNext);
    await approveRes.waitForResponse();

    assert("U12 - Admin can approve UPI withdrawal request", approveRes.getStatusCode() === 200 && approveRes.getResponseData()?.data?.status === "Approved");

    // U13: Admin can complete UPI withdrawal request
    const { req: completeReq, res: completeRes } = createMockReqRes(
      { transactionReference: "UPI9876543210" },
      {},
      { id: upiWithdrawalId },
      { userId: new mongoose.Types.ObjectId().toString(), userType: "Admin", role: "Admin" }
    );
    await (adminWithdrawalCtrl as any).completeWithdrawal(completeReq, completeRes, dummyNext);
    await completeRes.waitForResponse();

    assert("U13 - Admin can complete UPI withdrawal request", completeRes.getStatusCode() === 200 && completeRes.getResponseData()?.data?.status === "Completed");

    // U14: Transaction reference ID recorded on completion
    const completedRecord = await WithdrawRequest.findById(upiWithdrawalId);
    assert("U14 - Transaction reference ID recorded on completion", completedRecord?.transactionReference === "UPI9876543210");

    // U15: Seller sees completed UPI withdrawal in wallet history
    const { req: txnReq, res: txnRes } = createMockReqRes(
      {},
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).getTransactions(txnReq, txnRes, dummyNext);
    await txnRes.waitForResponse();

    const txns = txnRes.getResponseData()?.data?.transactions || [];
    const completedTxn = txns.find((t: any) => t.description?.includes("UPI9876543210"));
    assert("U15 - Seller sees completed UPI withdrawal in transaction history", !!completedTxn && completedTxn.amount === 500);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 4: REGRESSION & WALLET BALANCE SAFETY (U16 - U20)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🛡️ SECTION 4: REGRESSION & WALLET BALANCE SAFETY");

    // U16: Existing Bank Transfer withdrawal flow still works
    const { req: bankWithdrawReq, res: bankWithdrawRes } = createMockReqRes(
      { amount: 1000, paymentMethod: "Bank Transfer" },
      {},
      {},
      { userId: seller1Id, userType: "Seller", role: "Seller" }
    );
    await (sellerWalletCtrl as any).requestWithdrawal(bankWithdrawReq, bankWithdrawRes, dummyNext);
    await bankWithdrawRes.waitForResponse();

    const bankWithdrawData = bankWithdrawRes.getResponseData()?.data;
    assert("U16 - Bank Transfer withdrawal flow still works", bankWithdrawRes.getStatusCode() === 201 && bankWithdrawData?.paymentMethod === "Bank Transfer");

    // U17: Bank Transfer details remain accurate
    assert("U17 - Bank Transfer details remain accurate", bankWithdrawData?.accountDetails?.includes("SBI"));

    // U18: Wallet balance logic remains accurate after debit
    const currentSeller1 = await Seller.findById(seller1Id);
    // Initial 5000 - 500 (completed UPI) = 4500
    assert("U18 - Wallet balance logic remains accurate after debit", currentSeller1?.balance === 4500);

    // U19: No double wallet deduction on withdrawal approval/completion
    // Approve and complete the Bank Transfer request
    const bankReqId = bankWithdrawData._id.toString();
    const { req: appBank, res: resAppBank } = createMockReqRes({}, {}, { id: bankReqId }, { userId: new mongoose.Types.ObjectId().toString(), userType: "Admin", role: "Admin" });
    await (adminWithdrawalCtrl as any).approveWithdrawal(appBank, resAppBank, dummyNext);
    await resAppBank.waitForResponse();

    const { req: compBank, res: resCompBank } = createMockReqRes({ transactionReference: "BANKTRF123" }, {}, { id: bankReqId }, { userId: new mongoose.Types.ObjectId().toString(), userType: "Admin", role: "Admin" });
    await (adminWithdrawalCtrl as any).completeWithdrawal(compBank, resCompBank, dummyNext);
    await resCompBank.waitForResponse();

    const finalSeller1 = await Seller.findById(seller1Id);
    // 4500 - 1000 = 3500
    assert("U19 - No double wallet deduction on withdrawal completion", finalSeller1?.balance === 3500);

    // U20: No undefined/null string in withdrawal destination
    const allS1Requests = await WithdrawRequest.find({ userId: seller1Id });
    const hasUndefinedStr = allS1Requests.some((w) => w.accountDetails?.includes("undefined") || w.accountDetails?.includes("null") || w.upiId === "undefined");
    assert("U20 - No undefined/null string in withdrawal destination details", !hasUndefinedStr);

  } catch (error: any) {
    console.error("Error executing suite:", error);
  } finally {
    // Cleanup temporary test sellers and withdrawal records
    await Seller.deleteMany({ email: { $in: [testSellerEmail1, testSellerEmail2] } });
    await WithdrawRequest.deleteMany({ userId: { $in: [seller1._id, seller2._id] } });
    await WalletTransaction.deleteMany({ userId: { $in: [seller1Id, seller2Id] } });
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
    console.log("🎉 ALL 20 SELLER UPI & WITHDRAWAL VERIFICATION TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
