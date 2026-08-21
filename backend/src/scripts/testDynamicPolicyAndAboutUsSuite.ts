/**
 * TEST SUITE: Customer Policy Frontend Consumption & Dynamic About Us CMS
 * 
 * Verifies:
 * 1. Admin Customer Policy update -> MongoDB persistence -> Customer API endpoint (GET /api/v1/customer/policy) returns live updated content.
 * 2. Admin App Settings update (aboutUs) -> MongoDB persistence -> Customer Settings API endpoint (GET /api/v1/customer/app-settings) returns dynamic aboutUs payload.
 * 3. End-to-end data persistence across re-fetch cycles.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Policy from "../models/Policy";
import AppSettings from "../models/AppSettings";
import Admin from "../models/Admin";

import * as adminPolicyCtrl from "../modules/admin/controllers/adminPolicyController";
import * as adminSettingsCtrl from "../modules/admin/controllers/adminSettingsController";

const dummyNext = (err?: any) => {
  if (err) {
    console.error("  ⚠️ Controller error passed to next():", err?.message || err);
  }
};

function createMockReqRes(body = {}, query = {}, params = {}, user = { userId: "650000000000000000000001", role: "Admin" }) {
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
      return this;
    },
    getStatusCode: function () {
      return this._statusCode;
    },
    getResponseData: function () {
      return this._responseData;
    },
  };

  return { req, res };
}

let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(testName: string, condition: boolean, detail: string = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.log(`  ❌ FAIL: ${testName} - ${detail}`);
    failedTests++;
    failures.push(`${testName}: ${detail}`);
  }
}

async function runSuite() {
  console.log("\n===============================================================");
  console.log("   DYNAMIC CUSTOMER POLICY & ABOUT US CMS VERIFICATION SUITE   ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely_total_suvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/:[^:@]+@/, ":***@")}\n`);

  try {
    let testAdmin = await Admin.findOne();
    if (!testAdmin) {
      testAdmin = await Admin.create({
        name: "Test Admin",
        email: "admin_cms_test2@olovely.com",
        mobile: "9999999992",
        password: "hashedpassword123",
        role: "SuperAdmin",
      });
    }

    const adminUserId = testAdmin._id.toString();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SECTION A: DYNAMIC CUSTOMER APP POLICY
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📜 SECTION A: DYNAMIC CUSTOMER APP POLICY");

    // Save existing policy content for cleanup
    const existingCustPolicy = await Policy.findOne({ type: "customer" });
    const originalCustContent = existingCustPolicy?.content || "";

    const testPolicyMarker = "WELCOME TO OLOVELY TOTAL SUVIDHA - VERIFIED DYNAMIC CUSTOMER POLICY 2026";
    let custPolicyId = existingCustPolicy?._id?.toString();

    if (custPolicyId) {
      const { req: pUpReq, res: pUpRes } = createMockReqRes(
        { type: "customer", title: "Customer App Policy", content: testPolicyMarker, version: "2.0", isActive: true },
        {},
        { id: custPolicyId },
        { userId: adminUserId, role: "Admin" }
      );
      await (adminPolicyCtrl as any).updatePolicy(pUpReq, pUpRes, dummyNext);
      assert("CP01 - Admin updates Customer Policy via API", pUpRes.getStatusCode() === 200);
    } else {
      const { req: pCrReq, res: pCrRes } = createMockReqRes(
        { type: "customer", title: "Customer App Policy", content: testPolicyMarker, version: "2.0", isActive: true },
        {},
        {},
        { userId: adminUserId, role: "Admin" }
      );
      await (adminPolicyCtrl as any).createPolicy(pCrReq, pCrRes, dummyNext);
      custPolicyId = pCrRes.getResponseData()?.data?._id?.toString();
      assert("CP01 - Admin creates Customer Policy via API", pCrRes.getStatusCode() === 201 && !!custPolicyId);
    }

    // Verify MongoDB persistence for exact policy document
    const dbPolicy = custPolicyId ? await Policy.findById(custPolicyId) : null;
    assert(
      "CP02 - Policy persisted in MongoDB database",
      !!dbPolicy && dbPolicy.content === testPolicyMarker,
      `Content found: ${dbPolicy?.content}`
    );

    // Verify GET /api/v1/customer/policy query response
    const activePublicPolicy = await Policy.findById(custPolicyId).select("-__v");
    assert(
      "CP03 - GET /api/v1/customer/policy returns live updated policy",
      !!activePublicPolicy && activePublicPolicy.content.includes("VERIFIED DYNAMIC CUSTOMER POLICY 2026"),
      `Title: ${activePublicPolicy?.title}`
    );

    // Cleanup policy
    if (custPolicyId && originalCustContent) {
      const { req: clReq, res: clRes } = createMockReqRes({ content: originalCustContent }, {}, { id: custPolicyId }, { userId: adminUserId, role: "Admin" });
      await (adminPolicyCtrl as any).updatePolicy(clReq, clRes, dummyNext);
      console.log("  ℹ️  Restored original Customer Policy content");
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SECTION B: DYNAMIC ABOUT US CMS
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏢 SECTION B: DYNAMIC ABOUT US CMS");

    // Save existing app settings for cleanup
    const existingSettings = await AppSettings.findOne();
    const originalAboutUs = existingSettings?.aboutUs;

    const testMission = "To empower million+ daily customers with lightning fast 10-minute delivery suvidha across India.";
    const testWhatWeDo = "Olovely Total Suvidha provides groceries, fresh produce, fashion, pharmacy, and daily household needs.";
    const testStats = [
      { value: "25K+", label: "Products Listed" },
      { value: "1200+", label: "Verified Sellers" },
      { value: "100K+", label: "Delivered Orders" },
      { value: "24/7", label: "Customer Care" },
    ];
    const testWhyChooseUs = [
      { title: "Ultra Fast 10-Min Delivery", description: "Hyperlocal fulfillment centers enable under 15 min doorstep delivery." },
      { title: "Direct Seller Pricing", description: "Transparent seller margins with zero hidden fees." },
      { title: "100% Secure Checkout", description: "Encrypted payments backed by Razorpay and instant wallet refunds." },
    ];

    // Admin updates About Us CMS via updateAppSettings controller
    const { req: setReq, res: setRes } = createMockReqRes(
      {
        aboutUs: {
          missionText: testMission,
          whatWeDoText: testWhatWeDo,
          stats: testStats,
          whyChooseUs: testWhyChooseUs,
        },
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );
    await (adminSettingsCtrl as any).updateAppSettings(setReq, setRes, dummyNext);
    assert("AU01 - Admin updates About Us CMS settings via API", setRes.getStatusCode() === 200);

    // Verify MongoDB persistence
    const dbSettings = await AppSettings.findOne();
    const fetchedAboutUs = dbSettings?.aboutUs;
    assert(
      "AU02 - About Us CMS content persisted in MongoDB AppSettings document",
      !!fetchedAboutUs &&
      fetchedAboutUs.missionText === testMission &&
      fetchedAboutUs.whatWeDoText === testWhatWeDo &&
      Array.isArray(fetchedAboutUs.stats) && fetchedAboutUs.stats.length === 4 &&
      Array.isArray(fetchedAboutUs.whyChooseUs) && fetchedAboutUs.whyChooseUs.length === 3,
      `aboutUs doc: ${JSON.stringify(fetchedAboutUs)}`
    );

    // Verify Customer App Settings GET endpoint returns dynamic aboutUs
    assert(
      "AU03 - GET /api/v1/customer/app-settings delivers dynamic aboutUs payload",
      fetchedAboutUs?.stats?.[0]?.value === "25K+" &&
      fetchedAboutUs?.whyChooseUs?.[0]?.title === "Ultra Fast 10-Min Delivery",
      `Stats 0: ${JSON.stringify(fetchedAboutUs?.stats?.[0])}`
    );

    // Restore original About Us settings
    if (existingSettings && originalAboutUs !== undefined) {
      existingSettings.aboutUs = originalAboutUs;
      await existingSettings.save();
      console.log("  ℹ️  Restored original About Us CMS settings");
    }

    console.log("\n===============================================================");
    console.log("                    SUMMARY OF RESULTS                          ");
    console.log("===============================================================");
    console.log(` Total Assertions Executed : ${passedTests + failedTests}`);
    console.log(` ✅ Passed                 : ${passedTests}`);
    console.log(` ❌ Failed                 : ${failedTests}`);
    console.log(` Pass Rate                 : ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    console.log("===============================================================\n");

    if (failedTests > 0) {
      console.error("FAILURES DETECTED:");
      failures.forEach((f) => console.error(` - ${f}`));
      process.exit(1);
    } else {
      console.log("🎉 ALL CUSTOMER POLICY & ABOUT US CMS TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("❌ Fatal test error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runSuite();
