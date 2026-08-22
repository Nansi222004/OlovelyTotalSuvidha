import crypto from "crypto";
import fs from "fs";
import path from "path";
import axios from "axios";
import TranslationCache from "../models/TranslationCache";

export interface TranslateOptions {
  sourceLang?: string;
  targetLang: string;
}

export interface BatchTranslateResult {
  [key: string]: string;
}

/**
 * Compute SHA256 hash of text for caching lookup
 */
const computeHash = (text: string): string => {
  return crypto.createHash("sha256").update(text.trim()).digest("hex");
};

// Internal cache for Service Account OAuth access token
let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

/**
 * Base64Url encode helper for RSA-SHA256 JWT creation
 */
const base64UrlEncode = (str: string | Buffer): string => {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

/**
 * Obtain Google OAuth2 Access Token if Service Account is configured
 */
const getServiceAccountAccessToken = async (): Promise<string | null> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60) {
      return cachedOAuthToken.token;
    }

    let serviceAccountJsonStr: string | null = null;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (inlineJson && inlineJson.trim()) {
      serviceAccountJsonStr = inlineJson.trim();
    } else if (credPath && credPath.trim()) {
      const resolvedPath = path.isAbsolute(credPath)
        ? credPath
        : path.resolve(process.cwd(), credPath);
      if (fs.existsSync(resolvedPath)) {
        serviceAccountJsonStr = fs.readFileSync(resolvedPath, "utf8");
      }
    }

    if (!serviceAccountJsonStr) {
      return null;
    }

    const creds = JSON.parse(serviceAccountJsonStr);
    if (!creds.client_email || !creds.private_key) {
      return null;
    }

    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/cloud-translation",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signatureInput);
    const signature = signer.sign(creds.private_key);
    const jwt = `${signatureInput}.${base64UrlEncode(signature)}`;

    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 8000,
      }
    );

    if (tokenRes.data && tokenRes.data.access_token) {
      cachedOAuthToken = {
        token: tokenRes.data.access_token,
        expiresAt: now + (tokenRes.data.expires_in || 3600),
      };
      return tokenRes.data.access_token;
    }
  } catch (err: any) {
    console.warn(`[TranslationService] Service account authentication attempt failed: ${err.message || err}`);
  }

  return null;
};

/**
 * Translate a single string of text
 */
export const translateText = async (
  text: string,
  targetLang: string,
  sourceLang: string = "en"
): Promise<string> => {
  if (!text || !text.trim()) {
    return text || "";
  }

  // If source and target are identical, return text as is
  if (sourceLang.toLowerCase() === targetLang.toLowerCase()) {
    return text;
  }

  const cleanText = text.trim();
  const sourceHash = computeHash(cleanText);

  try {
    // 1. Check MongoDB TranslationCache first
    const cached = await TranslationCache.findOne({
      sourceHash,
      targetLang: targetLang.toLowerCase(),
      sourceLang: sourceLang.toLowerCase(),
    });

    if (cached && cached.translatedText) {
      return cached.translatedText;
    }

    // 2. Query Google Cloud Translation API if credentials exist
    let translatedResult: string | null = null;
    const apiKey =
      process.env.GOOGLE_TRANSLATE_API_KEY ||
      process.env.GOOGLE_CLOUD_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY;
    const isValidApiKey = apiKey && apiKey !== "your_google_cloud_translate_api_key_here" && !apiKey.includes("your_");

    if (isValidApiKey) {
      // Method A: API Key Authorization
      try {
        const response = await axios.post(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            q: cleanText,
            source: sourceLang,
            target: targetLang,
            format: "text",
          },
          { timeout: 8000 }
        );

        if (
          response.data &&
          response.data.data &&
          response.data.data.translations &&
          response.data.data.translations.length > 0
        ) {
          translatedResult = response.data.data.translations[0].translatedText;
        }
      } catch (apiErr: any) {
        console.warn(
          `[TranslationService] Google Translation API Key call failed: ${apiErr.response?.data?.error?.message || apiErr.message || apiErr}.`
        );
      }
    }

    if (!translatedResult) {
      // Method B: Service Account OAuth Authorization
      const accessToken = await getServiceAccountAccessToken();
      if (accessToken) {
        try {
          const response = await axios.post(
            "https://translation.googleapis.com/language/translate/v2",
            {
              q: cleanText,
              source: sourceLang,
              target: targetLang,
              format: "text",
            },
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 8000,
            }
          );

          if (
            response.data &&
            response.data.data &&
            response.data.data.translations &&
            response.data.data.translations.length > 0
          ) {
            translatedResult = response.data.data.translations[0].translatedText;
          }
        } catch (saErr: any) {
          console.warn(
            `[TranslationService] Google Service Account call failed: ${saErr.response?.data?.error?.message || saErr.message || saErr}.`
          );
        }
      }
    }

    // 3. Fallback mode if Google API is not configured or fails
    if (!translatedResult) {
      // Return original text safely
      translatedResult = cleanText;
    }

    // 4. Save to TranslationCache in background for cost prevention
    try {
      await TranslationCache.create({
        sourceHash,
        sourceText: cleanText,
        sourceLang: sourceLang.toLowerCase(),
        targetLang: targetLang.toLowerCase(),
        translatedText: translatedResult,
      });
    } catch (cacheErr) {
      // Ignore duplicate key race conditions
    }

    return translatedResult;
  } catch (error) {
    console.error(`[TranslationService] Error translating text:`, error);
    // Never crash the request - return clean original text
    return text;
  }
};

/**
 * Translate a record/map of multiple fields (e.g. { name: "...", description: "..." })
 */
export const translateFields = async (
  fields: Record<string, string>,
  targetLang: string,
  sourceLang: string = "en"
): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};

  for (const [key, val] of Object.entries(fields)) {
    if (typeof val === "string" && val.trim()) {
      result[key] = await translateText(val, targetLang, sourceLang);
    } else {
      result[key] = val;
    }
  }

  return result;
};

import SupportedLanguage from "../models/SupportedLanguage";

/**
 * Batch translate multiple text strings to all active supported non-English languages
 */
export const translateToAllLanguages = async (
  fields: Record<string, string>,
  sourceLang: string = "en"
): Promise<Record<string, Record<string, string>>> => {
  let targetLanguages: string[] = ["hi", "mr", "gu"];

  try {
    const activeLangs = await SupportedLanguage.find({ isActive: true, code: { $ne: sourceLang.toLowerCase() } }).select("code");
    if (activeLangs.length > 0) {
      targetLanguages = activeLangs.map((l) => l.code);
    }
  } catch (err) {
    // Fallback to initial defaults if DB query fails
  }

  const translationsMap: Record<string, Record<string, string>> = {};

  for (const lang of targetLanguages) {
    translationsMap[lang] = await translateFields(fields, lang, sourceLang);
  }

  return translationsMap;
};
