import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import axios from "axios";
import CustomerSupportRequest from "../models/CustomerSupportRequest";
import Customer from "../models/Customer";
import { generateToken } from "../services/jwtService";

const API_BASE = "http://localhost:5000/api/v1";


let passed = 0;
let failed = 0;
const results: Array<{ name: string; status: "PASS" | "FAIL"; detail?: string }> = [];

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    results.push({ name, status: "PASS" });
    console.log(`  ✅ PASS: ${name}`);
  } else {
    failed++;
    results.push({ name, status: "FAIL", detail });
    console.log(`  ❌ FAIL: ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

async function runSupportApiTests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    OLOVELY TOTAL SUVIDHA — Customer Support API Test Suite    ");
  console.log("═══════════════════════════════════════════════════════════════");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI not found.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Database connected\n");

  // Create mock test Customer
  const testCustId = new mongoose.Types.ObjectId();
  const testEmailStr = `ritik_support_${Date.now()}@example.com`;
  const testCust = new Customer({
    _id: testCustId,
    name: "Ritik Tiwari (QA Test)",
    email: testEmailStr,
    mobile: `98${Date.now().toString().slice(-8)}`,
    status: "Active",
  });
  await testCust.save();

  const token = generateToken(testCustId.toString(), "Customer");



  try {
    // -------------------------------------------------------------
    // TEST 1 — Valid Request (Authenticated Customer) + Email Delivery
    // -------------------------------------------------------------
    console.log("📩 TEST 1 — Valid Request with Real Email Delivery");
    const res1 = await axios.post(`${API_BASE}/customer/support/contact`, {
      name: "Ritik Tiwari",
      email: "ritik_test_support@example.com",
      subject: "[TEST] Olovely Support Form Verification",
      message: "This is a test support message submitted from the Olovely Customer Application.\nPlease verify Reply-To header and formatting.",
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert("T01 - Valid request returns HTTP 200", res1.status === 200);
    assert("T02 - API response contains success: true", res1.data.success === true);
    assert("T03 - API response contains user-facing message", typeof res1.data.message === "string" && res1.data.message.includes("sent successfully"));

    const reqId = res1.data.data?.requestId;
    assert("T04 - Support Request ID returned", !!reqId);

    // Verify DB record
    const dbRecord = await CustomerSupportRequest.findById(reqId).lean();
    assert("T05 - DB record created with customer ID bound", dbRecord?.customer?.toString() === testCustId.toString());
    assert("T06 - DB record status is Pending", dbRecord?.status === "Pending");
    assert("T07 - DB record emailSent is true", dbRecord?.emailSent === true);
    assert("T08 - DB record emailMessageId present", !!dbRecord?.emailMessageId);

    // -------------------------------------------------------------
    // TEST 2 — Missing / Short Name
    // -------------------------------------------------------------
    console.log("\n⚠️ TEST 2 — Invalid / Missing Name");
    try {
      await axios.post(`${API_BASE}/customer/support/contact`, {
        name: "A",
        email: "test@example.com",
        subject: "Valid Subject",
        message: "Valid message describing issue in detail.",
      });
      assert("T09 - Short name rejected", false, "API should have returned HTTP 400");
    } catch (err: any) {
      assert("T09 - Short name rejected with HTTP 400", err.response?.status === 400);
    }

    // -------------------------------------------------------------
    // TEST 3 — Invalid Email Format
    // -------------------------------------------------------------
    console.log("\n⚠️ TEST 3 — Invalid Email Format");
    try {
      await axios.post(`${API_BASE}/customer/support/contact`, {
        name: "Valid Name",
        email: "not-an-email",
        subject: "Valid Subject",
        message: "Valid message describing issue in detail.",
      });
      assert("T10 - Invalid email format rejected", false, "API should have returned HTTP 400");
    } catch (err: any) {
      assert("T10 - Invalid email format rejected with HTTP 400", err.response?.status === 400);
    }

    // -------------------------------------------------------------
    // TEST 4 — Short Message (< 10 chars)
    // -------------------------------------------------------------
    console.log("\n⚠️ TEST 4 — Message Too Short (< 10 chars)");
    try {
      await axios.post(`${API_BASE}/customer/support/contact`, {
        name: "Valid Name",
        email: "test@example.com",
        subject: "Valid Subject",
        message: "Short",
      });
      assert("T11 - Short message rejected", false, "API should have returned HTTP 400");
    } catch (err: any) {
      assert("T11 - Short message rejected with HTTP 400", err.response?.status === 400);
    }

    // -------------------------------------------------------------
    // TEST 5 — Message Too Long (> 2000 chars)
    // -------------------------------------------------------------
    console.log("\n⚠️ TEST 5 — Message Too Long (> 2000 chars)");
    try {
      await axios.post(`${API_BASE}/customer/support/contact`, {
        name: "Valid Name",
        email: "test@example.com",
        subject: "Valid Subject",
        message: "x".repeat(2001),
      });
      assert("T12 - Excessively long message rejected", false, "API should have returned HTTP 400");
    } catch (err: any) {
      assert("T12 - Excessively long message rejected with HTTP 400", err.response?.status === 400);
    }

    // -------------------------------------------------------------
    // TEST 6 — Guest / Unauthenticated Support Request
    // -------------------------------------------------------------
    console.log("\n👤 TEST 6 — Unauthenticated / Guest Support Request");
    const resGuest = await axios.post(`${API_BASE}/customer/support/contact`, {
      name: "Guest Visitor",
      email: "guest@example.com",
      subject: "Inquiry about app delivery area",
      message: "Hello, I would like to check if your delivery service covers sector 62 Noida.",
    });

    assert("T13 - Unauthenticated guest support request accepted", resGuest.status === 200);
    assert("T14 - Guest response contains success: true", resGuest.data.success === true);

    const guestReqId = resGuest.data.data?.requestId;
    const guestRecord = await CustomerSupportRequest.findById(guestReqId).lean();
    assert("T15 - Guest DB record has no customer ID binding", !guestRecord?.customer);
    assert("T16 - Guest emailSent is true", guestRecord?.emailSent === true);

    // Cleanup test records
    await CustomerSupportRequest.deleteMany({ email: { $in: ["ritik_test_support@example.com", "guest@example.com"] } });
    await Customer.findByIdAndDelete(testCustId);

  } catch (err: any) {
    console.error("Test execution failed:", err.response?.data || err.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                         TEST RESULTS                          ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total Tests Executed : ${passed + failed}`);
  console.log(`  ✅ Passed            : ${passed}`);
  console.log(`  ❌ Failed            : ${failed}`);
  console.log(`  Pass Rate            : ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

runSupportApiTests();
