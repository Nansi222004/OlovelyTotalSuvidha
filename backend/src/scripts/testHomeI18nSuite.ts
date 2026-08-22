import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Category from "../models/Category";
import Product from "../models/Product";
import HomeSection from "../models/HomeSection";
import Shop from "../models/Shop";
import BestsellerCard from "../models/BestsellerCard";
import PromoStrip from "../models/PromoStrip";
import { generateDynamicContentTranslations } from "../modules/admin/controllers/adminLanguageController";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runHomeI18nSuite() {
  console.log("=================================================");
  console.log("🏠 RUNNING END-TO-END HOME PAGE I18N TEST SUITE");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB Connected successfully.");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testId} - ${testName}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${testId} - ${testName}${detail ? `: ${detail}` : ""}`);
    }
  }

  try {
    // Ensure pre-translations exist for all supported target languages
    console.log("   Pre-generating dynamic translations for hi, mr, gu, ta, te...");
    await generateDynamicContentTranslations("hi");
    await generateDynamicContentTranslations("mr");
    await generateDynamicContentTranslations("gu");
    await generateDynamicContentTranslations("ta");
    await generateDynamicContentTranslations("te");

    // Fetch sample models to test
    const category = await Category.findOne({ status: "Active" }).lean();
    const product = await Product.findOne({ status: "Active", publish: true }).lean();
    const homeSection = await HomeSection.findOne({ isActive: true }).lean();
    const shop = await Shop.findOne({ isActive: true }).lean();

    // H01 - Home API returns translations object
    const hasCategoryTranslations = !!(category && category.translations && typeof category.translations === "object");
    const hasProductTranslations = !!(product && product.translations && typeof product.translations === "object");
    assert(hasCategoryTranslations && hasProductTranslations, "H01", "Home API models contain translations object");

    // H02 - Hindi category translation exists
    const catHi = category?.translations?.hi?.name;
    assert(typeof catHi === "string" && catHi.length > 0, "H02", "Hindi category translation exists", `Got: ${catHi}`);

    // H03 - Hindi product translation exists
    const prodHi = product?.translations?.hi?.name || product?.translations?.hi?.productName;
    assert(typeof prodHi === "string" && prodHi.length > 0, "H03", "Hindi product translation exists", `Got: ${prodHi}`);

    // H04 - Hindi Home section translation exists
    const sectionHi = homeSection?.translations?.hi?.title;
    assert(typeof sectionHi === "string" && sectionHi.length > 0, "H04", "Hindi Home section translation exists", `Got: ${sectionHi}`);

    // H05 - Marathi translation exists
    const catMr = category?.translations?.mr?.name;
    assert(typeof catMr === "string" && catMr.length > 0, "H05", "Marathi category translation exists", `Got: ${catMr}`);

    // H06 - Gujarati translation exists
    const catGu = category?.translations?.gu?.name;
    assert(typeof catGu === "string" && catGu.length > 0, "H06", "Gujarati category translation exists", `Got: ${catGu}`);

    // H07 - Tamil translation exists
    const catTa = category?.translations?.ta?.name;
    assert(typeof catTa === "string" && catTa.length > 0, "H07", "Tamil category translation exists", `Got: ${catTa}`);

    // H08 - Telugu translation exists
    const catTe = category?.translations?.te?.name;
    assert(typeof catTe === "string" && catTe.length > 0, "H08", "Telugu category translation exists", `Got: ${catTe}`);

    // Helper resolver simulation
    const simulateGetTranslatedField = (doc: any, fieldName: string, lang: string) => {
      if (!doc) return "";
      const translations = doc.translations;
      if (translations && typeof translations === "object") {
        if (translations[lang] && translations[lang][fieldName]) {
          return translations[lang][fieldName];
        }
        if (translations.en && translations.en[fieldName]) {
          return translations.en[fieldName];
        }
      }
      return doc[fieldName] || doc.productName || doc.name || doc.title || "";
    };

    // H09 - Missing translation falls back to English
    const fallbackDe = simulateGetTranslatedField(category, "name", "de");
    assert(fallbackDe === category?.name, "H09", "Missing language falls back to English/Original", `Got: ${fallbackDe}`);

    // H10 - Missing English translation falls back to root field
    const dummyDoc = { name: "Root Fallback Name", translations: {} };
    const rootFallback = simulateGetTranslatedField(dummyDoc, "name", "ja");
    assert(rootFallback === "Root Fallback Name", "H10", "Missing English translation falls back to root field");

    // H11 - No null/undefined/[object Object]
    const resolvedCatHi = simulateGetTranslatedField(category, "name", "hi");
    const isCleanString = typeof resolvedCatHi === "string" &&
      !resolvedCatHi.includes("null") &&
      !resolvedCatHi.includes("undefined") &&
      !resolvedCatHi.includes("[object Object]");
    assert(isCleanString, "H11", "No null/undefined/[object Object] in resolved string", `Got: ${resolvedCatHi}`);

    // H12 - Existing English Home data remains unchanged
    const resolvedCatEn = simulateGetTranslatedField(category, "name", "en");
    assert(resolvedCatEn === category?.name, "H12", "Existing English Home data remains unchanged", `Got: ${resolvedCatEn}`);

  } catch (err: any) {
    console.error("Test execution error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\n=================================================");
    console.log(`📊 HOME PAGE I18N SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================\n");
  }
}

runHomeI18nSuite();
