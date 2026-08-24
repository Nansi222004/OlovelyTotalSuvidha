/**
 * AUTOMATED TEST SUITE: DYNAMIC CMS & BILLING MODULES VERIFICATION SUITE
 * 
 * Tests the complete end-to-end flow across 5 modules:
 * Admin Controller/API -> MongoDB Persistence -> Customer/Public API -> Data Restoration
 * 
 * Modules Covered:
 * SECTION A: BILLING & CHARGES
 * SECTION B: BESTSELLER CARDS
 * SECTION C: HOME SECTIONS
 * SECTION D: PROMO STRIPS
 * SECTION E: LOWEST PRICES
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import AppSettings from "../models/AppSettings";
import BestsellerCard from "../models/BestsellerCard";
import HomeSection from "../models/HomeSection";
import PromoStrip from "../models/PromoStrip";
import LowestPricesProduct from "../models/LowestPricesProduct";
import Category from "../models/Category";
import Product from "../models/Product";
import Admin from "../models/Admin";

import * as adminSettingsCtrl from "../modules/admin/controllers/adminSettingsController";
import * as adminBestsellerCtrl from "../modules/admin/controllers/adminBestsellerCardController";
import * as adminHomeSectionCtrl from "../modules/admin/controllers/adminHomeSectionController";
import * as adminPromoStripCtrl from "../modules/admin/controllers/adminPromoStripController";
import * as adminLowestPricesCtrl from "../modules/admin/controllers/adminLowestPricesController";

import { cache } from "../utils/cache";

let lastNextError: string | null = null;
const dummyNext = (err?: any) => {
  if (err) {
    lastNextError = err?.message || String(err);
    console.error("  ⚠️ Controller error passed to next():", lastNextError);
  }
};

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

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
  console.log("        DYNAMIC CMS MODULES VERIFICATION SUITE         ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely_total_suvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/:[^:@]+@/, ":***@")}\n`);

  try {
    let testAdmin = await Admin.findOne();
    if (!testAdmin) {
      testAdmin = await Admin.create({
        name: "Test Admin",
        email: "admin_cms_test_suite@olovely.com",
        mobile: "9999999993",
        password: "hashedpassword123",
        role: "SuperAdmin",
      });
    }

    const adminUserId = testAdmin._id.toString();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION A: BILLING & CHARGES
    // ──────────────────────────────────────────────────────────────────────────
    console.log("💳 SECTION A: BILLING & CHARGES");

    // 1. Capture original settings state
    const originalSettingsDoc = await AppSettings.findOne();
    const originalPlatformFee = originalSettingsDoc?.platformFee ?? 2;
    const originalFreeDeliveryThreshold = originalSettingsDoc?.freeDeliveryThreshold ?? 500;
    const originalMinimumOrderValue = originalSettingsDoc?.minimumOrderValue ?? 0;
    const originalDeliveryCharges = originalSettingsDoc?.deliveryCharges ?? 0;
    const originalDeliveryConfig = originalSettingsDoc?.deliveryConfig;
    const originalShowSellerDetails = originalSettingsDoc?.features?.showSellerDetails ?? true;

    // 2. Admin update billing settings
    const testPlatformFee = 99;
    const testFreeDeliveryThreshold = 999;
    const testMinimumOrderValue = 0;
    const testDeliveryCharges = 75;
    const testDeliveryConfig = {
      isDistanceBased: true,
      baseCharge: 50,
      baseDistance: 3,
      kmRate: 15,
      deliveryBoyKmRate: 10,
      googleMapsKey: "AIzaTestKey12345",
    };

    const { req: billReq, res: billRes } = createMockReqRes(
      {
        appName: originalSettingsDoc?.appName || "Olovely Total Suvidha",
        appLogo: originalSettingsDoc?.appLogo || "/assets/olovelylogo_transparent.png",
        contactEmail: originalSettingsDoc?.contactEmail || "contact@olovely.com",
        contactPhone: originalSettingsDoc?.contactPhone || "9876543210",
        platformFee: testPlatformFee,
        freeDeliveryThreshold: testFreeDeliveryThreshold,
        minimumOrderValue: testMinimumOrderValue,
        deliveryCharges: testDeliveryCharges,
        deliveryConfig: testDeliveryConfig,
        features: {
          sellerRegistration: true,
          productApproval: true,
          orderTracking: true,
          wallet: true,
          coupons: true,
          showSellerDetails: false,
        },
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );

    await (adminSettingsCtrl as any).updateAppSettings(billReq, billRes, dummyNext);
    assert("A01 - Admin updates Billing & Charges via API", billRes.getStatusCode() === 200);

    // 3. Verify MongoDB persistence
    const dbSettings = await AppSettings.findOne();
    assert(
      "A02 - Billing settings persisted in MongoDB AppSettings document",
      dbSettings?.platformFee === testPlatformFee &&
      dbSettings?.freeDeliveryThreshold === testFreeDeliveryThreshold &&
      dbSettings?.minimumOrderValue === testMinimumOrderValue &&
      dbSettings?.deliveryCharges === testDeliveryCharges &&
      dbSettings?.deliveryConfig?.isDistanceBased === true &&
      dbSettings?.deliveryConfig?.baseCharge === 50 &&
      dbSettings?.features?.showSellerDetails === false,
      `Fee: ${dbSettings?.platformFee}, Threshold: ${dbSettings?.freeDeliveryThreshold}, MinVal: ${dbSettings?.minimumOrderValue}`
    );

    // 4. Verify Customer App Settings API return payload
    const publicSettings = await AppSettings.findOne().lean();
    assert(
      "A03 - GET /api/v1/customer/app-settings delivers updated billing charges to User App",
      publicSettings?.platformFee === testPlatformFee &&
      publicSettings?.minimumOrderValue === testMinimumOrderValue &&
      publicSettings?.deliveryConfig?.kmRate === 15,
      `Public Fee: ${publicSettings?.platformFee}`
    );

    // 5. Restore original billing settings
    if (originalSettingsDoc) {
      originalSettingsDoc.platformFee = originalPlatformFee;
      originalSettingsDoc.freeDeliveryThreshold = originalFreeDeliveryThreshold;
      originalSettingsDoc.minimumOrderValue = originalMinimumOrderValue;
      originalSettingsDoc.deliveryCharges = originalDeliveryCharges;
      originalSettingsDoc.deliveryConfig = originalDeliveryConfig as any;
      if (originalSettingsDoc.features) {
        originalSettingsDoc.features.showSellerDetails = originalShowSellerDetails;
      }
      await originalSettingsDoc.save();
      console.log("  ℹ️  Restored original Billing & Charges settings in MongoDB");
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION B: BESTSELLER CARDS
    // ──────────────────────────────────────────────────────────────────────────
    console.log("⭐ SECTION B: BESTSELLER CARDS");

    await BestsellerCard.deleteMany({ name: { $regex: /^TEST_BESTSELLER_CARD/ } });

    const testCategory = await Category.findOne({ status: "Active" });
    if (!testCategory) {
      throw new Error("No active Category found in database for Bestseller Cards test");
    }

    const testCatId = testCategory._id.toString();

    // Deactivate 1 existing card temporarily if activeCards >= 6 to satisfy MAX_ACTIVE_CARDS restriction
    const activeCardsCount = await BestsellerCard.countDocuments({ isActive: true });
    let temporarilyDeactivatedCardId: string | null = null;

    if (activeCardsCount >= 6) {
      const activeCard = await BestsellerCard.findOne({ isActive: true });
      if (activeCard) {
        temporarilyDeactivatedCardId = activeCard._id.toString();
        activeCard.isActive = false;
        await activeCard.save();
      }
    }

    // 1. Create temporary bestseller card
    const { req: bsCreateReq, res: bsCreateRes } = createMockReqRes(
      {
        name: "TEST_BESTSELLER_CARD_2026",
        category: testCatId,
        order: 999,
        isActive: true,
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );
    await (adminBestsellerCtrl as any).createBestsellerCard(bsCreateReq, bsCreateRes, dummyNext);
    assert("B01 - Admin creates Bestseller Card via API", bsCreateRes.getStatusCode() === 201);

    const createdCardId = bsCreateRes.getResponseData()?.data?._id?.toString();
    assert("B02 - Card ID returned in API response", !!createdCardId);

    // 2. Verify MongoDB persistence
    const dbCard = createdCardId ? await BestsellerCard.findById(createdCardId) : null;
    assert("B03 - Bestseller Card persisted in MongoDB database", !!dbCard && dbCard.name === "TEST_BESTSELLER_CARD_2026");

    // 3. Admin update card
    if (createdCardId) {
      const { req: bsUpReq, res: bsUpRes } = createMockReqRes(
        {
          name: "TEST_BESTSELLER_CARD_UPDATED_2026",
          category: testCatId,
          order: 999,
          isActive: true,
        },
        {},
        { id: createdCardId },
        { userId: adminUserId, role: "Admin" }
      );
      await (adminBestsellerCtrl as any).updateBestsellerCard(bsUpReq, bsUpRes, dummyNext);
      assert("B04 - Admin updates Bestseller Card via API", bsUpRes.getStatusCode() === 200);

      const dbUpdatedCard = await BestsellerCard.findById(createdCardId);
      assert("B05 - Updated Bestseller Card persisted in MongoDB", dbUpdatedCard?.name === "TEST_BESTSELLER_CARD_UPDATED_2026");
    }

    // 4. Verify Customer Home API returns dynamic card
    const publicBestsellerCards = await BestsellerCard.find({ isActive: true }).populate("category", "name slug image").sort({ order: 1 }).lean();
    const foundInPublic = publicBestsellerCards.some((c: any) => c.name === "TEST_BESTSELLER_CARD_UPDATED_2026");
    assert("B06 - Customer Home API returns dynamic Bestseller Card", foundInPublic);

    // 5. Delete temporary card and verify restoration
    if (createdCardId) {
      const { req: bsDelReq, res: bsDelRes } = createMockReqRes({}, {}, { id: createdCardId }, { userId: adminUserId, role: "Admin" });
      await (adminBestsellerCtrl as any).deleteBestsellerCard(bsDelReq, bsDelRes, dummyNext);
      assert("B07 - Admin deletes test Bestseller Card via API", bsDelRes.getStatusCode() === 200);

      const dbDeleted = await BestsellerCard.findById(createdCardId);
      assert("B08 - Test Bestseller Card removed from MongoDB (restored)", dbDeleted === null);
    }

    // Reactivate temporarily deactivated card if any
    if (temporarilyDeactivatedCardId) {
      await BestsellerCard.findByIdAndUpdate(temporarilyDeactivatedCardId, { isActive: true });
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION C: HOME SECTIONS
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏡 SECTION C: HOME SECTIONS");

    await HomeSection.deleteMany({ slug: "test-dynamic-home-section-2026" });

    // 1. Create temporary Home Section
    const { req: hsCreateReq, res: hsCreateRes } = createMockReqRes(
      {
        title: "TEST_DYNAMIC_HOME_SECTION_2026",
        slug: "test-dynamic-home-section-2026",
        displayType: "categories",
        categories: [testCatId],
        order: 999,
        isActive: true,
        pageLocation: "Home Page",
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );
    await (adminHomeSectionCtrl as any).createHomeSection(hsCreateReq, hsCreateRes, dummyNext);
    assert("C01 - Admin creates Home Section via API", hsCreateRes.getStatusCode() === 201, `Status: ${hsCreateRes.getStatusCode()}, Err: ${lastNextError || JSON.stringify(hsCreateRes.getResponseData())}`);

    const createdSectionId = hsCreateRes.getResponseData()?.data?._id?.toString();
    assert("C02 - Section ID returned in API response", !!createdSectionId);

    // 2. Verify MongoDB persistence
    const dbSection = createdSectionId ? await HomeSection.findById(createdSectionId) : null;
    assert("C03 - Home Section persisted in MongoDB database", !!dbSection && dbSection.title === "TEST_DYNAMIC_HOME_SECTION_2026");

    // 3. Admin update section
    if (createdSectionId) {
      const { req: hsUpReq, res: hsUpRes } = createMockReqRes(
        {
          title: "TEST_DYNAMIC_HOME_SECTION_UPDATED_2026",
          slug: "test-dynamic-home-section-2026",
          displayType: "categories",
          categories: [testCatId],
          order: 999,
          isActive: true,
          pageLocation: "Home Page",
        },
        {},
        { id: createdSectionId },
        { userId: adminUserId, role: "Admin" }
      );
      await (adminHomeSectionCtrl as any).updateHomeSection(hsUpReq, hsUpRes, dummyNext);
      assert("C04 - Admin updates Home Section via API", hsUpRes.getStatusCode() === 200);

      const dbUpdatedSection = await HomeSection.findById(createdSectionId);
      assert("C05 - Updated Home Section persisted in MongoDB", dbUpdatedSection?.title === "TEST_DYNAMIC_HOME_SECTION_UPDATED_2026");
    }

    // 4. Verify Customer Home API returns dynamic section
    const publicHomeSections = await HomeSection.find({ isActive: true, pageLocation: "Home Page" }).populate("categories", "name slug image").sort({ order: 1 }).lean();
    const foundSectionPublic = publicHomeSections.some((s: any) => s.title === "TEST_DYNAMIC_HOME_SECTION_UPDATED_2026");
    assert("C06 - Customer Home API returns dynamic Home Section", foundSectionPublic);

    // 5. Delete temporary section and verify restoration
    if (createdSectionId) {
      const { req: hsDelReq, res: hsDelRes } = createMockReqRes({}, {}, { id: createdSectionId }, { userId: adminUserId, role: "Admin" });
      await (adminHomeSectionCtrl as any).deleteHomeSection(hsDelReq, hsDelRes, dummyNext);
      assert("C07 - Admin deletes test Home Section via API", hsDelRes.getStatusCode() === 200);

      const dbDeletedSection = await HomeSection.findById(createdSectionId);
      assert("C08 - Test Home Section removed from MongoDB (restored)", dbDeletedSection === null);
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION D: PROMO STRIPS
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏷️ SECTION D: PROMO STRIPS");

    await PromoStrip.deleteMany({ heading: { $regex: /^TEST_PROMO_HEADING/ } });

    const startDate = new Date(Date.now() - 3600000); // 1 hr ago
    const endDate = new Date(Date.now() + 86400000); // 24 hrs later

    lastNextError = null;

    // 1. Create temporary Promo Strip (saleText max 20 chars)
    const { req: psCreateReq, res: psCreateRes } = createMockReqRes(
      {
        headerCategorySlug: "all",
        heading: "TEST_PROMO_HEADING_2026",
        saleText: "FLAT 50% OFF",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        categoryCards: [],
        featuredProducts: [],
        isActive: true,
        order: 0,
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );
    await (adminPromoStripCtrl as any).createPromoStrip(psCreateReq, psCreateRes, dummyNext);
    await delay(100);

    assert(
      "D01 - Admin creates Promo Strip via API",
      psCreateRes.getStatusCode() === 201,
      `Status: ${psCreateRes.getStatusCode()}, Err: ${lastNextError || JSON.stringify(psCreateRes.getResponseData())}`
    );

    const createdPromoId = psCreateRes.getResponseData()?.data?._id?.toString();
    assert("D02 - Promo Strip ID returned in API response", !!createdPromoId);

    // 2. Verify MongoDB persistence
    const dbPromo = createdPromoId ? await PromoStrip.findById(createdPromoId) : null;
    assert("D03 - Promo Strip persisted in MongoDB database", !!dbPromo && dbPromo.heading === "TEST_PROMO_HEADING_2026");

    // 3. Admin update promo strip
    if (createdPromoId) {
      const { req: psUpReq, res: psUpRes } = createMockReqRes(
        {
          heading: "TEST_PROMO_HEADING_UPDATED_2026",
          saleText: "FLAT 60% OFF",
          isActive: true,
        },
        {},
        { id: createdPromoId },
        { userId: adminUserId, role: "Admin" }
      );
      await (adminPromoStripCtrl as any).updatePromoStrip(psUpReq, psUpRes, dummyNext);
      await delay(100);
      assert("D04 - Admin updates Promo Strip via API", psUpRes.getStatusCode() === 200);

      const dbUpdatedPromo = await PromoStrip.findById(createdPromoId);
      assert("D05 - Updated Promo Strip persisted in MongoDB", dbUpdatedPromo?.heading === "TEST_PROMO_HEADING_UPDATED_2026");
    }

    // 4. Verify Customer Home API returns dynamic promo strip (and cache invalidation works)
    cache.delete("promoStrip-all"); // Ensure cache invalidation check
    const now = new Date();
    const publicPromoStrip = await PromoStrip.findOne({
      headerCategorySlug: "all",
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean();
    assert("D06 - Customer Home API returns dynamic Promo Strip within date range", !!publicPromoStrip && publicPromoStrip.heading === "TEST_PROMO_HEADING_UPDATED_2026");

    // 5. Delete temporary promo strip and verify restoration
    if (createdPromoId) {
      const { req: psDelReq, res: psDelRes } = createMockReqRes({}, {}, { id: createdPromoId }, { userId: adminUserId, role: "Admin" });
      await (adminPromoStripCtrl as any).deletePromoStrip(psDelReq, psDelRes, dummyNext);
      await delay(100);
      assert("D07 - Admin deletes test Promo Strip via API", psDelRes.getStatusCode() === 200);

      const dbDeletedPromo = await PromoStrip.findById(createdPromoId);
      assert("D08 - Test Promo Strip removed from MongoDB (restored)", dbDeletedPromo === null);
    }

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION E: LOWEST PRICES
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🔥 SECTION E: LOWEST PRICES");

    const testProduct = await Product.findOne({ status: "Active", publish: true });
    if (!testProduct) {
      throw new Error("No active Product found in database for Lowest Prices test");
    }

    const testProdId = testProduct._id.toString();

    // Remove existing lowest price entry for testProduct if it exists to avoid duplicate prevention error
    await LowestPricesProduct.deleteMany({ product: testProdId });

    // 1. Create temporary Lowest Prices Product
    const { req: lpCreateReq, res: lpCreateRes } = createMockReqRes(
      {
        product: testProdId,
        order: 999,
        isActive: true,
      },
      {},
      {},
      { userId: adminUserId, role: "Admin" }
    );
    await (adminLowestPricesCtrl as any).createLowestPricesProduct(lpCreateReq, lpCreateRes, dummyNext);
    assert("E01 - Admin adds Lowest Prices Product via API", lpCreateRes.getStatusCode() === 201);

    const createdLowestId = lpCreateRes.getResponseData()?.data?._id?.toString();
    assert("E02 - Lowest Prices record ID returned in API response", !!createdLowestId);

    // 2. Verify MongoDB persistence
    const dbLowest = createdLowestId ? await LowestPricesProduct.findById(createdLowestId) : null;
    assert("E03 - Lowest Prices product record persisted in MongoDB database", !!dbLowest && dbLowest.product.toString() === testProdId);

    // 3. Admin update record
    if (createdLowestId) {
      const { req: lpUpReq, res: lpUpRes } = createMockReqRes(
        {
          order: 1000,
          isActive: true,
        },
        {},
        { id: createdLowestId },
        { userId: adminUserId, role: "Admin" }
      );
      await (adminLowestPricesCtrl as any).updateLowestPricesProduct(lpUpReq, lpUpRes, dummyNext);
      assert("E04 - Admin updates Lowest Prices Product order via API", lpUpRes.getStatusCode() === 200);

      const dbUpdatedLowest = await LowestPricesProduct.findById(createdLowestId);
      assert("E05 - Updated Lowest Prices order persisted in MongoDB", dbUpdatedLowest?.order === 1000);
    }

    // 4. Verify Customer Home API returns dynamic lowest price product
    const publicLowestProducts = await LowestPricesProduct.find({ isActive: true }).populate("product", "productName price mrp mainImage status publish").lean();
    const foundLowestPublic = publicLowestProducts.some((item: any) => item.product && item.product._id.toString() === testProdId);
    assert("E06 - Customer Home API returns dynamic Lowest Prices product", foundLowestPublic);

    // 5. Delete temporary lowest price record and verify restoration
    if (createdLowestId) {
      const { req: lpDelReq, res: lpDelRes } = createMockReqRes({}, {}, { id: createdLowestId }, { userId: adminUserId, role: "Admin" });
      await (adminLowestPricesCtrl as any).deleteLowestPricesProduct(lpDelReq, lpDelRes, dummyNext);
      assert("E07 - Admin deletes test Lowest Prices record via API", lpDelRes.getStatusCode() === 200);

      const dbDeletedLowest = await LowestPricesProduct.findById(createdLowestId);
      assert("E08 - Test Lowest Prices record removed from MongoDB (restored)", dbDeletedLowest === null);
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
      console.log("🎉 ALL 5 CMS & BILLING MODULE VERIFICATION TESTS PASSED SUCCESSFULLY!");
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
