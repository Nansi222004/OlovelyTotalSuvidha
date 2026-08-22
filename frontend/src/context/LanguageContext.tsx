import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en from "../locales/en.json";
import hi from "../locales/hi.json";
import mr from "../locales/mr.json";
import gu from "../locales/gu.json";
import api from "../services/api/config";

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isDefault: true, isActive: true },
  { code: "hi", name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", isDefault: false, isActive: true },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", isDefault: false, isActive: true },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", isDefault: false, isActive: true },
];

export type SupportedLanguage = string;
export const SUPPORTED_LANGUAGES = DEFAULT_LANGUAGES;

const staticDictionaries: Record<string, any> = {
  en,
  hi,
  mr,
  gu,
};

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  languages: LanguageOption[];
  isLoading: boolean;
  isLanguageReady: boolean;
  t: (keyPath: string, fallback?: string) => string;
  getTranslatedField: (doc: any, fieldName: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [dynamicUITranslations, setDynamicUITranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLanguageReady, setIsLanguageReady] = useState<boolean>(false);

  const [language, setLanguageState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("app_language") || localStorage.getItem("delivery_lang");
      if (stored && stored.trim()) {
        return stored.trim().toLowerCase();
      }
    } catch {
      // Ignore storage errors
    }
    return "en";
  });

  // Fetch supported active languages list from backend
  useEffect(() => {
    let isMounted = true;
    const fetchLanguages = async () => {
      try {
        const response = await api.get("/languages");
        if (response.data?.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
          if (isMounted) {
            setLanguages(response.data.data);

            // If currently selected language is disabled or invalid, switch to default
            const currentActive = response.data.data.find((l: LanguageOption) => l.code === language);
            if (!currentActive) {
              const defaultLang = response.data.data.find((l: LanguageOption) => l.isDefault) || response.data.data[0];
              if (defaultLang) {
                setLanguageState(defaultLang.code);
                localStorage.setItem("app_language", defaultLang.code);
                localStorage.setItem("delivery_lang", defaultLang.code);
              }
            }
          }
        }
      } catch (err) {
        // Fallback to DEFAULT_LANGUAGES on network error
      }
    };

    fetchLanguages();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch dynamic UI translation keys for the selected language if not English
  useEffect(() => {
    let isMounted = true;
    const fetchUITranslations = async () => {
      if (language === "en") {
        setDynamicUITranslations({});
        setIsLoading(false);
        setIsLanguageReady(true);
        return;
      }

      try {
        setIsLoading(true);
        setIsLanguageReady(false);
        const res = await fetch(`/api/v1/languages/ui-translations?lang=${language}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            setDynamicUITranslations(json.data);
          }
        }
      } catch (err) {
        // Fallback silently to static dictionaries
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLanguageReady(true);
        }
      }
    };

    fetchUITranslations();
    return () => {
      isMounted = false;
    };
  }, [language]);

  const setLanguage = (langCode: string) => {
    const clean = langCode.trim().toLowerCase();
    setLanguageState(clean);

    try {
      localStorage.setItem("app_language", clean);
      localStorage.setItem("delivery_lang", clean);
    } catch {
      // Ignore storage errors
    }
  };

  /**
   * Universal translation helper for static & dynamic UI strings
   */
  const t = (keyPath: string, fallback?: string): string => {
    if (!keyPath) return fallback || "";

    // 1. Check dynamic UI translations from database
    if (dynamicUITranslations && dynamicUITranslations[keyPath]) {
      return dynamicUITranslations[keyPath];
    }

    // 2. Check static JSON dictionary for selected language
    const currentDict = staticDictionaries[language] || staticDictionaries.en;
    const parts = keyPath.split(".");
    let current = currentDict;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === "string" && current.trim()) {
      return current;
    }

    // 3. Fallback to English static dictionary
    let enCurrent = staticDictionaries.en;
    for (const enPart of parts) {
      if (enCurrent && typeof enCurrent === "object" && enPart in enCurrent) {
        enCurrent = enCurrent[enPart];
      } else {
        enCurrent = undefined;
        break;
      }
    }

    if (typeof enCurrent === "string" && enCurrent.trim()) {
      return enCurrent;
    }

    // 4. Return user fallback or keyPath safely
    return fallback || keyPath;
  };

  /**
   * Helper function for dynamic database fields with fallback:
   * 1. doc.translations[language][fieldName] (Canonical format)
   * 2. doc.translations[fieldName][language] (Legacy format)
   * 3. doc.translations.en[fieldName] / doc.translations[fieldName].en (English fallback)
   * 4. doc[fieldName] || doc.productName || doc.name || doc.title (Root field fallback)
   */
  const getTranslatedField = (doc: any, fieldName: string): string => {
    if (!doc) return "";

    const translations = doc.translations;
    if (translations && typeof translations === "object") {
      // 1. Canonical: doc.translations[language][fieldName]
      if (translations[language] && typeof translations[language] === "object" && translations[language][fieldName]) {
        const val = translations[language][fieldName];
        if (typeof val === "string" && val.trim()) return val;
      }

      // 2. Legacy: doc.translations[fieldName][language]
      if (translations[fieldName] && typeof translations[fieldName] === "object" && translations[fieldName][language]) {
        const val = translations[fieldName][language];
        if (typeof val === "string" && val.trim()) return val;
      }

      // 3. English Fallback Canonical: doc.translations.en[fieldName]
      if (translations.en && typeof translations.en === "object" && translations.en[fieldName]) {
        const enVal = translations.en[fieldName];
        if (typeof enVal === "string" && enVal.trim()) return enVal;
      }

      // 4. English Fallback Legacy: doc.translations[fieldName].en
      if (translations[fieldName] && typeof translations[fieldName] === "object" && translations[fieldName].en) {
        const enVal = translations[fieldName].en;
        if (typeof enVal === "string" && enVal.trim()) return enVal;
      }
    }

    // 5. Fallback to original root field
    const rootVal = doc[fieldName] ?? doc.productName ?? doc.name ?? doc.title ?? doc.question ?? "";
    return typeof rootVal === "string" ? rootVal : rootVal ? String(rootVal) : "";
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        languages,
        isLoading,
        isLanguageReady,
        t,
        getTranslatedField,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
