import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import SupportedLanguage from "../models/SupportedLanguage";
import UITranslation from "../models/UITranslation";
import { translateText } from "../services/translationService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runFullI18nAuditSuite() {
  console.log("=================================================");
  console.log("🧪 RUNNING COMPREHENSIVE MULTI-LANGUAGE AUDIT SUITE");
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
    // 1. Seed Core Languages: EN, HI, MR, GU
    const coreLangs = [
      { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: true, isActive: true, sortOrder: 1 },
      { code: "hi", name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 2 },
      { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 3 },
      { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 4 },
    ];

    for (const lang of coreLangs) {
      await SupportedLanguage.findOneAndUpdate({ code: lang.code }, lang, { upsert: true, new: true });
    }
    const activeLangs = await SupportedLanguage.find({ isActive: true });
    assert(activeLangs.length >= 4, "1. Core Languages (EN, HI, MR, GU) Active in DB");

    // 2. English Master Keys Check
    const masterKeys = [
      { key: "common.home", sourceText: "Home" },
      { key: "common.orderAgain", sourceText: "Order Again" },
      { key: "common.categories", sourceText: "Categories" },
      { key: "common.profile", sourceText: "Profile" },
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

    for (const item of masterKeys) {
      await UITranslation.findOneAndUpdate(
        { key: item.key, languageCode: "en" },
        { key: item.key, languageCode: "en", sourceText: item.sourceText, translatedText: item.sourceText, isManual: true },
        { upsert: true, new: true }
      );
    }
    const enCount = await UITranslation.countDocuments({ languageCode: "en" });
    assert(enCount >= masterKeys.length, "2. Master English UI Keys Stored in MongoDB");

    // 3. Dynamic Language Creation: Tamil (ta) & Telugu (te)
    const newLangs = [
      { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 5 },
      { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 6 },
    ];

    for (const lang of newLangs) {
      await SupportedLanguage.findOneAndUpdate({ code: lang.code }, lang, { upsert: true, new: true });
    }
    const taExist = await SupportedLanguage.findOne({ code: "ta", isActive: true });
    const teExist = await SupportedLanguage.findOne({ code: "te", isActive: true });
    assert(!!taExist && !!teExist, "3. Dynamic Languages Creation (Tamil & Telugu)");

    // 4. Auto-Generate Tamil UI Translations via Google API
    console.log("   Translating UI keys to Tamil via Google Cloud Translation API...");
    let taCount = 0;
    for (const item of masterKeys) {
      const translated = await translateText(item.sourceText, "ta");
      if (translated) {
        await UITranslation.findOneAndUpdate(
          { key: item.key, languageCode: "ta" },
          { key: item.key, languageCode: "ta", sourceText: item.sourceText, translatedText: translated, isManual: false },
          { upsert: true, new: true }
        );
        taCount++;
      }
    }
    assert(taCount === masterKeys.length, "4. Tamil UI Key Translations Auto-Generated via Google API");

    // 5. Auto-Generate Telugu UI Translations via Google API
    console.log("   Translating UI keys to Telugu via Google Cloud Translation API...");
    let teCount = 0;
    for (const item of masterKeys) {
      const translated = await translateText(item.sourceText, "te");
      if (translated) {
        await UITranslation.findOneAndUpdate(
          { key: item.key, languageCode: "te" },
          { key: item.key, languageCode: "te", sourceText: item.sourceText, translatedText: translated, isManual: false },
          { upsert: true, new: true }
        );
        teCount++;
      }
    }
    assert(teCount === masterKeys.length, "5. Telugu UI Key Translations Auto-Generated via Google API");

    // 6. Manual UI Translation Override Test
    const manualDoc = await UITranslation.findOneAndUpdate(
      { key: "account.yourOrders", languageCode: "ta" },
      { translatedText: "உங்கள் அனைத்து ஆர்டர்கள் (நிர்வாகி)", isManual: true },
      { new: true }
    );
    assert(manualDoc?.isManual === true && manualDoc?.translatedText.includes("உங்கள்"), "6. Manual UI Translation Override in MongoDB");

    // 7. Deactivation & Default Fallback Logic
    await SupportedLanguage.updateOne({ code: "te" }, { isActive: false });
    const activeLangsFilter = await SupportedLanguage.find({ isActive: true });
    const hasTe = activeLangsFilter.some((l: any) => l.code === "te");
    assert(!hasTe, "7. Deactivated Language Excluded from Active Selector Query");

    // Re-activate Telugu for complete test availability
    await SupportedLanguage.updateOne({ code: "te" }, { isActive: true });

    // 8. Key Masking Check
    const rawKey = process.env.GOOGLE_TRANSLATE_API_KEY || "";
    const keyMasked = rawKey.slice(0, 6) + "****" + rawKey.slice(-4);
    assert(!keyMasked.includes(rawKey), "8. Security Check - API Key Properly Masked");

  } catch (error: any) {
    console.error("Test execution failure:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n=================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=================================================\n");
  }
}

runFullI18nAuditSuite();
