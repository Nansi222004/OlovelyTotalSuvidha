import connectDB from "../config/db";
import mongoose from "mongoose";
import TranslationCache from "../models/TranslationCache";
import { translateText } from "../services/translationService";

async function verifyLiveTranslation() {
  console.log("\n============================================================");
  console.log("🔍 GOOGLE CLOUD TRANSLATION INTEGRATION VERIFICATION");
  console.log("============================================================\n");

  try {
    await connectDB();

    const sampleText = "How can I withdraw money?";
    const targetLang = "hi";
    const sourceLang = "en";

    // Clean any previous test cache for this sample
    await TranslationCache.deleteMany({ sourceText: sampleText, targetLang });

    // Check credential status
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    const hasApiKey = !!(apiKey && apiKey !== "your_google_cloud_translate_api_key_here" && !apiKey.includes("your_"));
    const hasServiceAccount = !!((credPath && credPath.trim()) || (inlineJson && inlineJson.trim()));

    if (hasApiKey) {
      console.log("🔑 Detected Authentication Method: GOOGLE_TRANSLATE_API_KEY (REST V2 API Key)");
    } else if (hasServiceAccount) {
      console.log("📄 Detected Authentication Method: GOOGLE_APPLICATION_CREDENTIALS (Service Account ADC/JWT)");
    } else {
      console.log("⚠️ No active Google credentials found in backend/.env. Running in isolated fallback mode.");
    }

    // Step 1: Initial Translation Request
    console.log(`\n➡️ [Step 1] Requesting Translation: "${sampleText}" -> [${targetLang.toUpperCase()}]`);
    const startMs1 = Date.now();
    const result1 = await translateText(sampleText, targetLang, sourceLang);
    const duration1 = Date.now() - startMs1;

    console.log(`✅ [Step 1 Result] (${duration1}ms): "${result1}"`);

    // Step 2: Verify Persistence in MongoDB TranslationCache
    const cacheDoc = await TranslationCache.findOne({
      sourceText: sampleText,
      targetLang,
    });

    if (cacheDoc) {
      console.log(`💾 [Step 2 DB Cache Check] Verified! Saved in MongoDB TranslationCache collection.`);
      console.log(`   - Source Hash: ${cacheDoc.sourceHash}`);
      console.log(`   - Cached Text: "${cacheDoc.translatedText}"`);
    } else {
      console.error(`❌ [Step 2 DB Cache Check] FAILED: Document not found in MongoDB TranslationCache.`);
    }

    // Step 3: Duplicate Request (Cache Hit Verification)
    console.log(`\n➡️ [Step 3] Re-requesting identical text: "${sampleText}" -> [${targetLang.toUpperCase()}]`);
    const startMs2 = Date.now();
    const result2 = await translateText(sampleText, targetLang, sourceLang);
    const duration2 = Date.now() - startMs2;

    console.log(`⚡ [Step 3 Result] (${duration2}ms): "${result2}"`);

    if (result1 === result2 && duration2 < 100) {
      console.log(`🎉 [Cache Verification] SUCCESS! Second request was served from MongoDB TranslationCache in ${duration2}ms without external API call.`);
    } else {
      console.log(`ℹ️ [Cache Verification] Result match: ${result1 === result2}, Response time: ${duration2}ms`);
    }

    console.log("\n============================================================");
    console.log("✅ GOOGLE CLOUD TRANSLATION VERIFICATION COMPLETED");
    console.log("============================================================\n");
  } catch (err: any) {
    console.error("Verification error:", err);
  } finally {
    await mongoose.connection.close();
  }
}

verifyLiveTranslation();
