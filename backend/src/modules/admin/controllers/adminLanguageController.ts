import { Request, Response } from "express";
import SupportedLanguage from "../../../models/SupportedLanguage";
import UITranslation from "../../../models/UITranslation";
import { translateText } from "../../../services/translationService";
import HomeSection from "../../../models/HomeSection";
import Shop from "../../../models/Shop";
import BestsellerCard from "../../../models/BestsellerCard";
import PromoStrip from "../../../models/PromoStrip";

const INITIAL_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: true, isActive: true, sortOrder: 1 },
  { code: "hi", name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 2 },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 3 },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", isDefault: false, isActive: true, sortOrder: 4 },
];

/**
 * Seed initial active languages if database collection is empty
 */
export const seedDefaultLanguages = async () => {
  try {
    const count = await SupportedLanguage.countDocuments();
    if (count === 0) {
      console.log("🌱 Seeding default supported languages...");
      for (const lang of INITIAL_LANGUAGES) {
        await SupportedLanguage.create(lang);
      }
      console.log("✅ Seeded default supported languages (en, hi, mr, gu)");
    }
  } catch (error: any) {
    console.error("Error seeding default languages:", error.message);
  }
};

/**
 * Public: GET /api/v1/languages
 * Returns list of active supported languages sorted by sortOrder
 */
export const getPublicLanguages = async (_req: Request, res: Response): Promise<void> => {
  try {
    await seedDefaultLanguages();
    const languages = await SupportedLanguage.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({
      success: true,
      data: languages,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch languages",
      error: error.message,
    });
  }
};

/**
 * Public: GET /api/v1/languages/ui-translations?lang=hi
 * Returns UI translation key-value object for specified language
 */
export const getPublicUITranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const langCode = ((req.query.lang as string) || "en").toLowerCase();
    const translations = await UITranslation.find({ languageCode: langCode });

    const dictionary: Record<string, string> = {};
    for (const item of translations) {
      dictionary[item.key] = item.translatedText;
    }

    res.json({
      success: true,
      languageCode: langCode,
      data: dictionary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch UI translations",
      error: error.message,
    });
  }
};

/**
 * Admin: GET /api/v1/admin/languages
 * Returns all languages with progress metrics
 */
export const getAdminLanguages = async (_req: Request, res: Response): Promise<void> => {
  try {
    await seedDefaultLanguages();
    const languages = await SupportedLanguage.find().sort({ sortOrder: 1, name: 1 });
    const englishCount = await UITranslation.countDocuments({ languageCode: "en" });

    const dataWithMetrics = await Promise.all(
      languages.map(async (lang) => {
        const langCount = await UITranslation.countDocuments({ languageCode: lang.code });
        const progress = englishCount > 0 ? Math.min(100, Math.round((langCount / englishCount) * 100)) : 100;
        return {
          ...lang.toObject(),
          uiTranslationCount: langCount,
          totalEnglishKeys: englishCount,
          progressPercentage: progress,
        };
      })
    );

    res.json({
      success: true,
      data: dataWithMetrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin languages",
      error: error.message,
    });
  }
};

/**
 * Admin: POST /api/v1/admin/languages
 * Add new supported language
 */
export const createLanguage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, nativeName, flag = "🌐", isDefault = false, isActive = true, sortOrder = 0 } = req.body;

    if (!code || !name || !nativeName) {
      res.status(400).json({ success: false, message: "Code, name, and nativeName are required" });
      return;
    }

    const cleanCode = code.trim().toLowerCase();
    const existing = await SupportedLanguage.findOne({ code: cleanCode });
    if (existing) {
      res.status(400).json({ success: false, message: `Language with code '${cleanCode}' already exists` });
      return;
    }

    if (isDefault) {
      await SupportedLanguage.updateMany({}, { isDefault: false });
    }

    const newLang = await SupportedLanguage.create({
      code: cleanCode,
      name: name.trim(),
      nativeName: nativeName.trim(),
      flag: flag.trim(),
      isDefault: Boolean(isDefault),
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Language created successfully",
      data: newLang,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to create language",
      error: error.message,
    });
  }
};

/**
 * Admin: PUT /api/v1/admin/languages/:id
 * Update supported language
 */
export const updateLanguage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, nativeName, flag, sortOrder } = req.body;

    const lang = await SupportedLanguage.findById(id);
    if (!lang) {
      res.status(404).json({ success: false, message: "Language not found" });
      return;
    }

    if (name) lang.name = name.trim();
    if (nativeName) lang.nativeName = nativeName.trim();
    if (flag !== undefined) lang.flag = flag.trim();
    if (sortOrder !== undefined) lang.sortOrder = Number(sortOrder) || 0;

    await lang.save();

    res.json({
      success: true,
      message: "Language updated successfully",
      data: lang,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update language",
      error: error.message,
    });
  }
};

/**
 * Admin: PATCH /api/v1/admin/languages/:id/status
 * Enable or disable a language
 */
export const toggleLanguageStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const lang = await SupportedLanguage.findById(id);
    if (!lang) {
      res.status(404).json({ success: false, message: "Language not found" });
      return;
    }

    if (lang.isDefault && !isActive) {
      res.status(400).json({
        success: false,
        message: "Cannot disable the default language. Please set another language as default first.",
      });
      return;
    }

    lang.isActive = Boolean(isActive);
    await lang.save();

    res.json({
      success: true,
      message: `Language ${lang.name} ${lang.isActive ? "activated" : "deactivated"} successfully`,
      data: lang,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update language status",
      error: error.message,
    });
  }
};

/**
 * Admin: PATCH /api/v1/admin/languages/:id/default
 * Set a language as default
 */
export const setDefaultLanguage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const lang = await SupportedLanguage.findById(id);
    if (!lang) {
      res.status(404).json({ success: false, message: "Language not found" });
      return;
    }

    await SupportedLanguage.updateMany({}, { isDefault: false });
    lang.isDefault = true;
    lang.isActive = true;
    await lang.save();

    res.json({
      success: true,
      message: `Language ${lang.name} set as default`,
      data: lang,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to set default language",
      error: error.message,
    });
  }
};

/**
 * Admin: DELETE /api/v1/admin/languages/:id
 * Delete a non-default language
 */
export const deleteLanguage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const lang = await SupportedLanguage.findById(id);
    if (!lang) {
      res.status(404).json({ success: false, message: "Language not found" });
      return;
    }

    if (lang.isDefault) {
      res.status(400).json({
        success: false,
        message: "Cannot delete the default language.",
      });
      return;
    }

    await UITranslation.deleteMany({ languageCode: lang.code });
    await lang.deleteOne();

    res.json({
      success: true,
      message: `Language ${lang.name} deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to delete language",
      error: error.message,
    });
  }
};

import Category from "../../../models/Category";
import HeaderCategory from "../../../models/HeaderCategory";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import FAQ from "../../../models/FAQ";
import Policy from "../../../models/Policy";

/**
 * Auto-generate dynamic content translations (Categories, Products, HeaderCategories, FAQs, Policies)
 * into canonical format: translations[targetCode] = { fieldName: translatedText }
 */
export const generateDynamicContentTranslations = async (targetCode: string) => {
  if (targetCode === "en") return { categoriesCount: 0, productsCount: 0 };

  let categoriesCount = 0;
  let productsCount = 0;

  // 1. Categories
  const categories = await Category.find({});
  for (const cat of categories) {
    let modified = false;
    const translations = (cat.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (cat.name && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(cat.name, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }
    const catDesc = (cat as any).description;
    if (catDesc && (!translations[targetCode].description || !translations[targetCode].description.trim())) {
      const translatedDesc = await translateText(catDesc, targetCode, "en");
      if (translatedDesc) {
        translations[targetCode].description = translatedDesc;
        modified = true;
      }
    }
    if (modified) {
      await Category.updateOne({ _id: cat._id }, { $set: { translations } });
      categoriesCount++;
    }
  }

  // 2. Header Categories
  const headerCategories = await HeaderCategory.find({});
  for (const hc of headerCategories) {
    let modified = false;
    const translations = (hc.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (hc.name && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(hc.name, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }
    if (modified) {
      await HeaderCategory.updateOne({ _id: hc._id }, { $set: { translations } });
    }
  }

  // 3. SubCategories
  const subCategories = await SubCategory.find({});
  for (const sub of subCategories) {
    let modified = false;
    const translations = (sub.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (sub.name && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(sub.name, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }
    if (modified) {
      await SubCategory.updateOne({ _id: sub._id }, { $set: { translations } });
    }
  }

  // 4. Products
  const products = await Product.find({}).limit(100); // Limit batch to prevent timeout
  for (const prod of products) {
    let modified = false;
    const translations = (prod.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    const rawName = prod.productName || (prod as any).name || "";
    if (rawName && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(rawName, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }

    const rawDesc = prod.description || "";
    if (rawDesc && (!translations[targetCode].description || !translations[targetCode].description.trim())) {
      const translatedDesc = await translateText(rawDesc, targetCode, "en");
      if (translatedDesc) {
        translations[targetCode].description = translatedDesc;
        modified = true;
      }
    }

    if (modified) {
      await Product.updateOne({ _id: prod._id }, { $set: { translations } });
      productsCount++;
    }
  }

  // 5. FAQs
  const faqs = await FAQ.find({});
  for (const faq of faqs) {
    let modified = false;
    const translations = (faq.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (faq.question && (!translations[targetCode].question || !translations[targetCode].question.trim())) {
      const translatedQ = await translateText(faq.question, targetCode, "en");
      if (translatedQ) {
        translations[targetCode].question = translatedQ;
        modified = true;
      }
    }
    if (faq.answer && (!translations[targetCode].answer || !translations[targetCode].answer.trim())) {
      const translatedA = await translateText(faq.answer, targetCode, "en");
      if (translatedA) {
        translations[targetCode].answer = translatedA;
        modified = true;
      }
    }
    if (modified) {
      await FAQ.updateOne({ _id: faq._id }, { $set: { translations } });
    }
  }

  // 6. Policies
  const policies = await Policy.find({});
  for (const pol of policies) {
    let modified = false;
    const translations = (pol.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (pol.title && (!translations[targetCode].title || !translations[targetCode].title.trim())) {
      const translatedTitle = await translateText(pol.title, targetCode, "en");
      if (translatedTitle) {
        translations[targetCode].title = translatedTitle;
        modified = true;
      }
    }
    if (pol.content && (!translations[targetCode].content || !translations[targetCode].content.trim())) {
      const translatedContent = await translateText(pol.content, targetCode, "en");
      if (translatedContent) {
        translations[targetCode].content = translatedContent;
        modified = true;
      }
    }
    if (modified) {
      await Policy.updateOne({ _id: pol._id }, { $set: { translations } });
    }
  }

  // 7. HomeSections
  const homeSections = await HomeSection.find({});
  for (const hs of homeSections) {
    let modified = false;
    const translations = (hs.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (hs.title && (!translations[targetCode].title || !translations[targetCode].title.trim())) {
      const translatedTitle = await translateText(hs.title, targetCode, "en");
      if (translatedTitle) {
        translations[targetCode].title = translatedTitle;
        modified = true;
      }
    }
    if (modified) {
      await HomeSection.updateOne({ _id: hs._id }, { $set: { translations } });
    }
  }

  // 8. Shops
  const shops = await Shop.find({});
  for (const shop of shops) {
    let modified = false;
    const translations = (shop.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (shop.name && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(shop.name, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }
    if (shop.description && (!translations[targetCode].description || !translations[targetCode].description.trim())) {
      const translatedDesc = await translateText(shop.description, targetCode, "en");
      if (translatedDesc) {
        translations[targetCode].description = translatedDesc;
        modified = true;
      }
    }
    if (modified) {
      await Shop.updateOne({ _id: shop._id }, { $set: { translations } });
    }
  }

  // 9. BestsellerCards
  const bestsellerCards = await BestsellerCard.find({});
  for (const bc of bestsellerCards) {
    let modified = false;
    const translations = (bc.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (bc.name && (!translations[targetCode].name || !translations[targetCode].name.trim())) {
      const translatedName = await translateText(bc.name, targetCode, "en");
      if (translatedName) {
        translations[targetCode].name = translatedName;
        modified = true;
      }
    }
    if (modified) {
      await BestsellerCard.updateOne({ _id: bc._id }, { $set: { translations } });
    }
  }

  // 10. PromoStrips
  const promoStrips = await PromoStrip.find({});
  for (const ps of promoStrips) {
    let modified = false;
    const translations = (ps.translations || {}) as Record<string, Record<string, string>>;
    if (!translations[targetCode]) translations[targetCode] = {};

    if (ps.heading && (!translations[targetCode].heading || !translations[targetCode].heading.trim())) {
      const translatedHeading = await translateText(ps.heading, targetCode, "en");
      if (translatedHeading) {
        translations[targetCode].heading = translatedHeading;
        modified = true;
      }
    }
    if (ps.saleText && (!translations[targetCode].saleText || !translations[targetCode].saleText.trim())) {
      const translatedSale = await translateText(ps.saleText, targetCode, "en");
      if (translatedSale) {
        translations[targetCode].saleText = translatedSale;
        modified = true;
      }
    }
    if (ps.crazyDealsTitle && (!translations[targetCode].crazyDealsTitle || !translations[targetCode].crazyDealsTitle.trim())) {
      const translatedDeals = await translateText(ps.crazyDealsTitle, targetCode, "en");
      if (translatedDeals) {
        translations[targetCode].crazyDealsTitle = translatedDeals;
        modified = true;
      }
    }
    if (modified) {
      await PromoStrip.updateOne({ _id: ps._id }, { $set: { translations } });
    }
  }

  return { categoriesCount, productsCount };
};

/**
 * Admin: POST /api/v1/admin/languages/:code/generate-ui-translations
 * Pre-generate UI key translations and dynamic content translations for target language code using Google Cloud Translation API
 */
export const generateUITranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetCode = req.params.code.trim().toLowerCase();
    const { forceRegenerate = false } = req.body;

    const lang = await SupportedLanguage.findOne({ code: targetCode });
    if (!lang && targetCode !== "en") {
      res.status(404).json({ success: false, message: `Language '${targetCode}' not found` });
      return;
    }

    const englishKeys = await UITranslation.find({ languageCode: "en" });
    if (englishKeys.length === 0) {
      res.status(400).json({
        success: false,
        message: "No English master UI keys found in database. Seed English keys first.",
      });
      return;
    }

    let generatedCount = 0;
    let skippedCount = 0;

    for (const item of englishKeys) {
      const existing = await UITranslation.findOne({ key: item.key, languageCode: targetCode });

      if (existing && existing.isManual && !forceRegenerate) {
        skippedCount++;
        continue;
      }

      if (existing && !forceRegenerate) {
        skippedCount++;
        continue;
      }

      let translated = item.sourceText;
      if (targetCode !== "en") {
        translated = await translateText(item.sourceText, targetCode, "en");
      }

      await UITranslation.findOneAndUpdate(
        { key: item.key, languageCode: targetCode },
        {
          key: item.key,
          languageCode: targetCode,
          sourceText: item.sourceText,
          translatedText: translated,
          isManual: false,
        },
        { upsert: true, new: true }
      );

      generatedCount++;
    }

    // Auto-generate dynamic content translations (Categories, Products, etc.)
    const dynamicStats = await generateDynamicContentTranslations(targetCode);

    res.json({
      success: true,
      message: `Translations process completed for '${targetCode}'`,
      data: {
        targetCode,
        uiGeneratedCount: generatedCount,
        uiSkippedCount: skippedCount,
        totalUiKeys: englishKeys.length,
        categoriesTranslated: dynamicStats.categoriesCount,
        productsTranslated: dynamicStats.productsCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to generate UI translations",
      error: error.message,
    });
  }
};

/**
 * Admin: GET /api/v1/admin/languages/:code/ui-translations
 * Get detailed list of all UI translations for target language
 */
export const getLanguageUITranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetCode = req.params.code.trim().toLowerCase();
    const translations = await UITranslation.find({ languageCode: targetCode }).sort({ key: 1 });

    res.json({
      success: true,
      languageCode: targetCode,
      data: translations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch language UI translations",
      error: error.message,
    });
  }
};

/**
 * Admin: PUT /api/v1/admin/languages/:code/ui-translations/:keyId
 * Update single UI key translation manually
 */
export const updateSingleUITranslation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyId } = req.params;
    const { translatedText } = req.body;

    if (!translatedText || !translatedText.trim()) {
      res.status(400).json({ success: false, message: "translatedText is required" });
      return;
    }

    const item = await UITranslation.findById(keyId);
    if (!item) {
      res.status(404).json({ success: false, message: "UI translation key not found" });
      return;
    }

    item.translatedText = translatedText.trim();
    item.isManual = true;
    await item.save();

    res.json({
      success: true,
      message: "UI translation updated successfully",
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update UI translation",
      error: error.message,
    });
  }
};
