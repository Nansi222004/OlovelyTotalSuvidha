/**
 * AUTOMATED TEST SUITE: ADMIN 3 MODULES VERIFICATION SUITE
 * 
 * Tests complete end-to-end dynamic functionality for:
 * 1. Admin Taxes (/admin/product/taxes)
 * 2. Admin Brand (/admin/brand)
 * 3. Admin System User (/admin/system-user)
 * 
 * Flow: Admin Controller API -> MongoDB Persistence -> GET List API -> Guaranteed Cleanup
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Tax from "../models/Tax";
import Brand from "../models/Brand";
import Admin from "../models/Admin";

import * as adminTaxCtrl from "../modules/admin/controllers/adminTaxController";
import * as adminProductCtrl from "../modules/admin/controllers/adminProductController";
import * as adminSystemUserCtrl from "../modules/admin/controllers/adminSystemUserController";

let lastNextError: string | null = null;
const dummyNext = (err?: any) => {
  if (err) {
    lastNextError = err?.message || String(err);
    console.error("  ⚠️ Controller error passed to next():", lastNextError);
  }
};

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockReqRes(body = {}, query = {}, params = {}, user = { userId: "650000000000000000000001", role: "Super Admin" }) {
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
  console.log("             ADMIN 3 MODULES VERIFICATION SUITE                ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely_total_suvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/:[^:@]+@/, ":***@")}\n`);

  // Ensure test authenticated admin user exists for middleware context
  let authAdmin = await Admin.findOne();
  if (!authAdmin) {
    authAdmin = await Admin.create({
      firstName: "Suite",
      lastName: "Admin",
      email: "admin_3modules_suite@olovely.com",
      mobile: "9999999994",
      password: "HashedPassword123!",
      role: "Super Admin",
    });
  }

  const authUserId = authAdmin._id.toString();

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. TAXES MODULE
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🧾 SECTION A: ADMIN TAXES MODULE (/admin/product/taxes)");

    // Cleanup leftover test records
    await Tax.deleteMany({ name: { $regex: /^TEST_DYNAMIC_TAX/ } });

    // T01: Admin creates tax via API
    const { req: tCreateReq, res: tCreateRes } = createMockReqRes(
      { name: "TEST_DYNAMIC_TAX_2026", percentage: 18 },
      {},
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminTaxCtrl as any).createTax(tCreateReq, tCreateRes, dummyNext);
    await delay(200);
    assert("T01 - Admin creates Tax via API", tCreateRes.getStatusCode() === 201);

    const createdTaxId = tCreateRes.getResponseData()?.data?._id?.toString();
    assert("T02 - Tax ID returned in API response", !!createdTaxId);

    // T03: Tax persisted in MongoDB
    const dbTax = createdTaxId ? await Tax.findById(createdTaxId) : null;
    assert("T03 - Tax persisted in MongoDB database", !!dbTax && dbTax.percentage === 18);

    // T04: GET /admin/taxes list API returns the record
    const { req: tListReq, res: tListRes } = createMockReqRes(
      { search: "TEST_DYNAMIC_TAX" },
      { search: "TEST_DYNAMIC_TAX" },
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminTaxCtrl as any).getTaxes(tListReq, tListRes, dummyNext);
    await delay(100);
    const listTaxes = tListRes.getResponseData()?.data || [];
    const foundInList = listTaxes.some((t: any) => t._id.toString() === createdTaxId);
    assert("T04 - GET /admin/taxes list API returns the created tax", foundInList);

    // T05: Admin updates tax percentage to 12
    if (createdTaxId) {
      const { req: tUpReq, res: tUpRes } = createMockReqRes(
        { name: "TEST_DYNAMIC_TAX_2026", percentage: 12 },
        {},
        { id: createdTaxId },
        { userId: authUserId, role: "Super Admin" }
      );
      await (adminTaxCtrl as any).updateTax(tUpReq, tUpRes, dummyNext);
      await delay(100);
      assert("T05 - Admin updates tax percentage via API", tUpRes.getStatusCode() === 200);

      // T06: MongoDB contains 12%
      const dbUpdatedTax = await Tax.findById(createdTaxId);
      assert("T06 - Updated percentage (12%) persisted in MongoDB", dbUpdatedTax?.percentage === 12);

      // T07: Update status to Inactive via status API
      const { req: tStatusReq, res: tStatusRes } = createMockReqRes(
        { status: "Inactive" },
        {},
        { id: createdTaxId },
        { userId: authUserId, role: "Super Admin" }
      );
      await (adminTaxCtrl as any).updateTaxStatus(tStatusReq, tStatusRes, dummyNext);
      await delay(100);
      const dbStatusTax = await Tax.findById(createdTaxId);
      assert("T07 - Tax status update (Inactive) persisted in MongoDB", dbStatusTax?.status === "Inactive");

      // T08: Delete tax and verify removal from MongoDB
      const { req: tDelReq, res: tDelRes } = createMockReqRes({}, {}, { id: createdTaxId }, { userId: authUserId, role: "Super Admin" });
      await (adminTaxCtrl as any).deleteTax(tDelReq, tDelRes, dummyNext);
      await delay(100);
      const dbDeletedTax = await Tax.findById(createdTaxId);
      assert("T08 - Tax deleted and removed from MongoDB database", tDelRes.getStatusCode() === 200 && dbDeletedTax === null);
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // 2. BRAND MODULE
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏷️ SECTION B: ADMIN BRAND MODULE (/admin/brand)");

    // Cleanup leftover test records
    await Brand.deleteMany({ name: { $regex: /^TEST_DYNAMIC_BRAND/ } });

    // B01: Admin creates brand via API
    const { req: bCreateReq, res: bCreateRes } = createMockReqRes(
      { name: "TEST_DYNAMIC_BRAND_2026", image: "https://example.com/test_brand.png" },
      {},
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminProductCtrl as any).createBrand(bCreateReq, bCreateRes, dummyNext);
    await delay(100);
    assert("B01 - Admin creates Brand via API", bCreateRes.getStatusCode() === 201, `Status: ${bCreateRes.getStatusCode()}, Message: ${lastNextError || JSON.stringify(bCreateRes.getResponseData())}`);

    const createdBrandId = bCreateRes.getResponseData()?.data?._id?.toString();
    assert("B02 - Brand ID returned in API response", !!createdBrandId);

    // B03: Brand persisted in MongoDB
    const dbBrand = createdBrandId ? await Brand.findById(createdBrandId) : null;
    assert("B03 - Brand persisted in MongoDB database", !!dbBrand && dbBrand.name === "TEST_DYNAMIC_BRAND_2026");

    // B04: GET /admin/brands list API returns the record
    const { req: bListReq, res: bListRes } = createMockReqRes(
      { search: "TEST_DYNAMIC_BRAND" },
      { search: "TEST_DYNAMIC_BRAND" },
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminProductCtrl as any).getBrands(bListReq, bListRes, dummyNext);
    await delay(100);
    const listBrands = bListRes.getResponseData()?.data || [];
    const foundBrandList = listBrands.some((b: any) => b._id.toString() === createdBrandId);
    assert("B04 - GET /admin/brands list API returns the created brand", foundBrandList);

    // B05: Admin updates brand name
    if (createdBrandId) {
      const { req: bUpReq, res: bUpRes } = createMockReqRes(
        { name: "TEST_DYNAMIC_BRAND_UPDATED_2026", image: "https://example.com/test_brand_updated.png" },
        {},
        { id: createdBrandId },
        { userId: authUserId, role: "Super Admin" }
      );
      await (adminProductCtrl as any).updateBrand(bUpReq, bUpRes, dummyNext);
      await delay(100);
      assert("B05 - Admin updates brand name via API", bUpRes.getStatusCode() === 200);

      // B06: MongoDB & GET API reflect updated name
      const dbUpdatedBrand = await Brand.findById(createdBrandId);
      assert("B06 - Updated brand name persisted in MongoDB", dbUpdatedBrand?.name === "TEST_DYNAMIC_BRAND_UPDATED_2026");

      // B07: Delete brand and verify removal
      const { req: bDelReq, res: bDelRes } = createMockReqRes({}, {}, { id: createdBrandId }, { userId: authUserId, role: "Super Admin" });
      await (adminProductCtrl as any).deleteBrand(bDelReq, bDelRes, dummyNext);
      await delay(100);
      const dbDeletedBrand = await Brand.findById(createdBrandId);
      assert("B07 - Brand deleted and removed from MongoDB database", bDelRes.getStatusCode() === 200 && dbDeletedBrand === null);
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // 3. SYSTEM USER MODULE
    // ──────────────────────────────────────────────────────────────────────────
    console.log("👤 SECTION C: ADMIN SYSTEM USER MODULE (/admin/system-user)");

    // Cleanup leftover test records
    await Admin.deleteMany({
      $or: [
        { email: "dynamic.test.2026@example.com" },
        { mobile: "9000000099" },
      ],
    });

    const testUserEmail = "dynamic.test.2026@example.com";
    const testUserMobile = "9000000099";

    // U01: Admin creates system user via API
    const { req: uCreateReq, res: uCreateRes } = createMockReqRes(
      {
        firstName: "Dynamic",
        lastName: "Test",
        mobile: testUserMobile,
        email: testUserEmail,
        password: "TestPassword123!",
        role: "Admin", // Lowest non-destructive admin role
      },
      {},
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminSystemUserCtrl as any).createSystemUser(uCreateReq, uCreateRes, dummyNext);
    await delay(300);
    assert("U01 - Admin creates System User via API", uCreateRes.getStatusCode() === 201);

    const createdUserId = uCreateRes.getResponseData()?.data?.id?.toString() || uCreateRes.getResponseData()?.data?._id?.toString();
    assert("U02 - System user ID returned in API response", !!createdUserId);

    // U03: System user persisted in MongoDB
    const dbUser = createdUserId ? await Admin.findById(createdUserId).select("+password") : null;
    assert("U03 - System user persisted in MongoDB database", !!dbUser && dbUser.email === testUserEmail);

    // U04: Verify password is bcrypt hashed and NOT stored in plaintext
    const isHashed = dbUser?.password ? dbUser.password.startsWith("$2b$") || dbUser.password.startsWith("$2a$") : false;
    assert("U04 - User password is bcrypt hashed and NOT stored in plaintext", isHashed && dbUser?.password !== "TestPassword123!");

    // U05: GET /admin/system-users returns user AND does NOT expose password or hash
    const { req: uListReq, res: uListRes } = createMockReqRes(
      { search: "dynamic.test" },
      { search: "dynamic.test" },
      {},
      { userId: authUserId, role: "Super Admin" }
    );
    await (adminSystemUserCtrl as any).getAllSystemUsers(uListReq, uListRes, dummyNext);
    await delay(100);
    const listUsers = uListRes.getResponseData()?.data || [];
    const foundUserInList = listUsers.find((u: any) => u.id?.toString() === createdUserId || u._id?.toString() === createdUserId);
    const hasNoPassword = foundUserInList && !("password" in foundUserInList) && !("hash" in foundUserInList);
    assert("U05 - GET list API returns user without exposing password or hash", !!foundUserInList && hasNoPassword);

    // U06: Admin updates system user's name
    if (createdUserId) {
      const { req: uUpReq, res: uUpRes } = createMockReqRes(
        {
          firstName: "Dynamic",
          lastName: "Test Updated",
          mobile: testUserMobile,
          email: testUserEmail,
          role: "Admin",
        },
        {},
        { id: createdUserId },
        { userId: authUserId, role: "Super Admin" }
      );
      await (adminSystemUserCtrl as any).updateSystemUser(uUpReq, uUpRes, dummyNext);
      await delay(100);
      assert("U06 - Admin updates system user name via API", uUpRes.getStatusCode() === 200);

      // U07: MongoDB reflects updated name
      const dbUpdatedUser = await Admin.findById(createdUserId);
      assert("U07 - Updated name (Dynamic Test Updated) persisted in MongoDB", dbUpdatedUser?.lastName === "Test Updated");

      // U08: Delete system user and verify removal
      const { req: uDelReq, res: uDelRes } = createMockReqRes({}, {}, { id: createdUserId }, { userId: authUserId, role: "Super Admin" });
      await (adminSystemUserCtrl as any).deleteSystemUser(uDelReq, uDelRes, dummyNext);
      await delay(100);
      const dbDeletedUser = await Admin.findById(createdUserId);
      assert("U08 - System user deleted and removed from MongoDB database", uDelRes.getStatusCode() === 200 && dbDeletedUser === null);
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
      console.log("🎉 ALL 3 ADMIN MODULE VERIFICATION TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("❌ Fatal test error:", err);
    process.exit(1);
  } finally {
    // Guaranteed Cleanup of any remaining test data
    await Tax.deleteMany({ name: { $regex: /^TEST_DYNAMIC_TAX/ } });
    await Brand.deleteMany({ name: { $regex: /^TEST_DYNAMIC_BRAND/ } });
    await Admin.deleteMany({
      $or: [
        { email: "dynamic.test.2026@example.com" },
        { mobile: "9000000099" },
      ],
    });
    console.log("  ℹ️  Cleaned up all temporary test records in MongoDB.");
    await mongoose.disconnect();
  }
}

runSuite();
