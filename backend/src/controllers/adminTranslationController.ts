import { Request, Response } from "express";
import { translateText, translateToAllLanguages } from "../services/translationService";

/**
 * Single string translation for Admin CMS
 * POST /api/v1/admin/translation/translate
 */
export const translateSingleText = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, targetLanguage, sourceLanguage = "en" } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ success: false, message: "Text field is required" });
      return;
    }

    if (!targetLanguage || typeof targetLanguage !== "string") {
      res.status(400).json({ success: false, message: "targetLanguage is required (e.g. hi, mr, gu)" });
      return;
    }

    const translatedText = await translateText(text, targetLanguage, sourceLanguage);

    res.status(200).json({
      success: true,
      sourceText: text,
      targetLanguage,
      translatedText,
    });
  } catch (error: any) {
    console.error("Admin translation error:", error);
    res.status(500).json({ success: false, message: error.message || "Translation failed" });
  }
};

/**
 * Batch translation of fields to all supported languages (hi, mr, gu)
 * POST /api/v1/admin/translation/batch
 */
export const batchTranslateFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fields, sourceLanguage = "en" } = req.body;

    if (!fields || typeof fields !== "object") {
      res.status(400).json({ success: false, message: "fields object is required" });
      return;
    }

    const translations = await translateToAllLanguages(fields, sourceLanguage);

    res.status(200).json({
      success: true,
      translations,
    });
  } catch (error: any) {
    console.error("Admin batch translation error:", error);
    res.status(500).json({ success: false, message: error.message || "Batch translation failed" });
  }
};
