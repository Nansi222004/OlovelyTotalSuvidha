import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Category from "../models/Category";
import Product from "../models/Product";
import SupportedLanguage from "../models/SupportedLanguage";
import UITranslation from "../models/UITranslation";
import { generateDynamicContentTranslations } from "../modules/admin/controllers/adminLanguageController";
import { translateText } from "../services/translationService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runDynamicContentI18nSuite() {
  console.log("=================================================");
  console.log("🧪 RUNNING END-TO-END DYNAMIC CONTENT I18N SUITE");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB Connected successfully.");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    }
  }

  try {
    // 1. Create a Test Category in English
    const testCat = await Category.findOneAndUpdate(
      { slug: "test-light-i18n" },
      {
        name: "test light",
        description: "High quality test lighting category",
        slug: "test-light-i18n",
        status: "Active",
        order: 99,
        translations: {},
      },
      { upsert: true, new: true }
    );
    assert(!!testCat && testCat.name === "test light", "1. Admin Creates Category in English ('test light')");

    // 2. Create a Test Product in English
    const testProd = await Product.findOneAndUpdate(
      { slug: "test-cap-i18n" },
      {
        name: "cap",
        description: "High quality stylish cap",
        slug: "test-cap-i18n",
        price: 199,
        status: "Active",
        publish: true,
        category: testCat._id,
        translations: {},
      },
      { upsert: true, new: true }
    );
    assert(!!testProd && ((testProd as any).name === "cap" || testProd.productName === "cap"), "2. Admin Creates Product in English ('cap')");

    // 3. Trigger Admin Dynamic Translation Pre-generation for Hindi ('hi')
    console.log("   Triggering Admin Dynamic Content Translation for Hindi ('hi')...");
    await generateDynamicContentTranslations("hi");

    // 4. Verify MongoDB Canonical Structure: translations.hi.name and translations.hi.description
    const updatedCat = await Category.findById(testCat._id).lean();
    const updatedProd = await Product.findById(testProd._id).lean();

    const catHiName = updatedCat?.translations?.hi?.name;
    const prodHiName = updatedProd?.translations?.hi?.name;

    assert(
      typeof catHiName === "string" && catHiName.length > 0,
      "3. Category Hindi Translation Saved in Canonical Format (translations.hi.name)",
      `Got: ${catHiName}`
    );
    assert(
      typeof prodHiName === "string" && prodHiName.length > 0,
      "4. Product Hindi Translation Saved in Canonical Format (translations.hi.name)",
      `Got: ${prodHiName}`
    );

    // 5. Test Frontend `getTranslatedField` Resolver Simulation
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
      return doc[fieldName] || doc.productName || doc.name || "";
    };

    const resolvedCatHi = simulateGetTranslatedField(updatedCat, "name", "hi");
    const resolvedProdHi = simulateGetTranslatedField(updatedProd, "name", "hi");

    assert(resolvedCatHi === catHiName && resolvedCatHi !== "test light", "5. getTranslatedField() Resolves Category to Hindi");
    assert(resolvedProdHi === prodHiName && resolvedProdHi !== "cap", "6. getTranslatedField() Resolves Product to Hindi");

    // 6. Test Missing Translation Fallback (German 'de' not generated yet)
    const fallbackCatName = simulateGetTranslatedField(updatedCat, "name", "de");
    assert(fallbackCatName === "test light", "7. Fallback correctly returns English/Original for Missing Language");

    // 7. Trigger Marathi ('mr'), Gujarati ('gu'), Tamil ('ta'), Telugu ('te')
    console.log("   Triggering Dynamic Translation for mr, gu, ta, te...");
    await generateDynamicContentTranslations("mr");
    await generateDynamicContentTranslations("gu");
    await generateDynamicContentTranslations("ta");
    await generateDynamicContentTranslations("te");

    const multiCat = await Category.findById(testCat._id).lean();
    assert(!!multiCat?.translations?.mr?.name, "8. Marathi Category Dynamic Translation Generated");
    assert(!!multiCat?.translations?.gu?.name, "9. Gujarati Category Dynamic Translation Generated");
    assert(!!multiCat?.translations?.ta?.name, "10. Tamil Category Dynamic Translation Generated");
    assert(!!multiCat?.translations?.te?.name, "11. Telugu Category Dynamic Translation Generated");

  } catch (err: any) {
    console.error("Test execution error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\n=================================================");
    console.log(`📊 DYNAMIC CONTENT SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================\n");
  }
}

runDynamicContentI18nSuite();
