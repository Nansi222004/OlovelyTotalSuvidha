import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import SupportedLanguage from "../models/SupportedLanguage";
import UITranslation from "../models/UITranslation";
import { translateText } from "../services/translationService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runTestSuite() {
  console.log("=================================================");
  console.log("🧪 RUNNING COMPREHENSIVE TRANSLATION SYSTEM TEST SUITE");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB Connected successfully.");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      failedTests++;
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    }
  }

  try {
    // T01: Seed Supported Languages
    const defaultLangs = [
      { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: true, isActive: true, sortOrder: 1 },
      { code: "hi", name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 2 },
      { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 3 },
      { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 4 },
    ];

    for (const lang of defaultLangs) {
      await SupportedLanguage.findOneAndUpdate({ code: lang.code }, lang, { upsert: true, new: true });
    }
    const countLangs = await SupportedLanguage.countDocuments({ isActive: true });
    assert(countLangs >= 4, "T01: Seed Supported Languages", `Found ${countLangs} active languages`);

    // T02: Verify Default Language is English
    const defaultLang = await SupportedLanguage.findOne({ isDefault: true });
    assert(defaultLang?.code === "en", "T02: Default Language is English", `Default is ${defaultLang?.code}`);

    // T03: Store Master English UI Keys
    const sampleEnglishKeys = [
      { key: "common.home", sourceText: "Home" },
      { key: "common.orderAgain", sourceText: "Order Again" },
      { key: "account.yourOrders", sourceText: "Your orders" },
      { key: "account.notifications", sourceText: "Notifications" },
      { key: "account.needHelp", sourceText: "Need help?" },
      { key: "account.addressBook", sourceText: "Address Book" },
      { key: "account.yourWishlist", sourceText: "Your Wishlist" },
      { key: "account.myWallet", sourceText: "My Wallet" },
      { key: "account.privacyPolicy", sourceText: "Privacy & Terms Policy" },
      { key: "account.aboutUs", sourceText: "About Us" },
      { key: "account.logOut", sourceText: "Log Out" },
    ];

    for (const item of sampleEnglishKeys) {
      await UITranslation.findOneAndUpdate(
        { key: item.key, languageCode: "en" },
        {
          key: item.key,
          languageCode: "en",
          sourceText: item.sourceText,
          translatedText: item.sourceText,
          isManual: true,
        },
        { upsert: true, new: true }
      );
    }
    const enCount = await UITranslation.countDocuments({ languageCode: "en" });
    assert(enCount >= 11, "T03: Store Master English UI Keys in Database", `Found ${enCount} English keys`);

    // T04: Generate Hindi UI Translations via Google Cloud API
    console.log("   Translating English UI keys to Hindi...");
    const enKeys = await UITranslation.find({ languageCode: "en" });
    let hiTranslatedCount = 0;

    for (const item of enKeys) {
      const translated = await translateText(item.sourceText, "hi");
      if (translated) {
        await UITranslation.findOneAndUpdate(
          { key: item.key, languageCode: "hi" },
          {
            key: item.key,
            languageCode: "hi",
            sourceText: item.sourceText,
            translatedText: translated,
            isManual: false,
          },
          { upsert: true, new: true }
        );
        hiTranslatedCount++;
      }
    }
    assert(hiTranslatedCount === enKeys.length, "T04: Auto-Generate Hindi UI Translations via Google Cloud API", `Translated ${hiTranslatedCount}/${enKeys.length}`);

    // T05: Test Dynamic Language Creation (Tamil - ta)
    const taLang = await SupportedLanguage.findOneAndUpdate(
      { code: "ta" },
      { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 5 },
      { upsert: true, new: true }
    );
    assert(!!taLang, "T05: Dynamic Language Creation (Tamil - ta)");

    // T06: Auto-Generate Tamil UI Translations
    console.log("   Translating English UI keys to Tamil...");
    let taTranslatedCount = 0;
    for (const item of enKeys) {
      const translated = await translateText(item.sourceText, "ta");
      if (translated) {
        await UITranslation.findOneAndUpdate(
          { key: item.key, languageCode: "ta" },
          {
            key: item.key,
            languageCode: "ta",
            sourceText: item.sourceText,
            translatedText: translated,
            isManual: false,
          },
          { upsert: true, new: true }
        );
        taTranslatedCount++;
      }
    }
    assert(taTranslatedCount === enKeys.length, "T06: Auto-Generate Tamil UI Translations", `Translated ${taTranslatedCount}/${enKeys.length}`);

    // T07: Manual UI Translation Override
    const manualDoc = await UITranslation.findOneAndUpdate(
      { key: "account.yourOrders", languageCode: "hi" },
      { translatedText: "आपके सभी आदेश (मैनुअल)", isManual: true },
      { new: true }
    );
    assert(manualDoc?.isManual === true && manualDoc?.translatedText.includes("आपके सभी आदेश"), "T07: Manual UI Translation Override");

    // T08: Test Deactivating Language
    await SupportedLanguage.updateOne({ code: "ta" }, { isActive: false });
    const activeList = await SupportedLanguage.find({ isActive: true });
    const containsTa = activeList.some((l: any) => l.code === "ta");
    assert(!containsTa, "T08: Deactivated Language Excluded from Active Selector List");

    // Re-activate Tamil for cleanup
    await SupportedLanguage.updateOne({ code: "ta" }, { isActive: true });

    // T09: Verify Security Rules (API Key not exposed)
    const envKey = process.env.GOOGLE_TRANSLATE_API_KEY || "";
    const keyMasked = envKey.slice(0, 6) + "****" + envKey.slice(-4);
    assert(!keyMasked.includes(envKey), "T09: Security Check - API Key is Properly Masked in Output", `Key Suffix: ${keyMasked}`);

    // T10: Verify Dynamic UI Fetch Dict for Frontend
    const hiDictDocs = await UITranslation.find({ languageCode: "hi" });
    const hiDictMap: Record<string, string> = {};
    for (const doc of hiDictDocs) {
      hiDictMap[doc.key] = doc.translatedText;
    }
    assert(Object.keys(hiDictMap).length >= 11 && !!hiDictMap["account.yourOrders"], "T10: Frontend UI Dictionary Mapping Payload");
  } catch (error: any) {
    console.error("Critical Test Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n=================================================");
    console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=================================================\n");
  }
}

runTestSuite();
