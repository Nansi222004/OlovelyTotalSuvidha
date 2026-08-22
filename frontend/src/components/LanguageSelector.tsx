import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { updateCustomerLanguage } from "../services/api/customerService";

interface LanguageSelectorProps {
  variant?: "dropdown" | "modal" | "inline";
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = "dropdown",
  isOpen = false,
  onClose,
  className = "",
}) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const { user, updateUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentOption = languages.find((l) => l.code === language) || languages[0] || { code: "en", nativeName: "English", name: "English" };

  const [selectedCode, setSelectedCode] = useState(language);

  // Sync selected code when language prop or modal visibility changes
  React.useEffect(() => {
    setSelectedCode(language);
  }, [language, isOpen]);

  const syncLanguageToBackend = (code: string) => {
    if (user && (user.userType === "Customer" || user.phone || user.walletAmount !== undefined)) {
      updateCustomerLanguage(code)
        .then(() => {
          updateUser({
            ...user,
            preferredLanguage: code,
          });
        })
        .catch((err) => {
          console.error("Failed to sync language to backend:", err);
        });
    }
  };

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    if (variant === "dropdown" || variant === "inline") {
      setLanguage(code);
      syncLanguageToBackend(code);
      setDropdownOpen(false);
      if (onClose) onClose();
    }
  };

  const handleSave = () => {
    setLanguage(selectedCode);
    syncLanguageToBackend(selectedCode);
    setDropdownOpen(false);
    if (onClose) onClose();
  };

  // Modal Variant
  if (variant === "modal" || isOpen) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900">{t("common.language", "Select Language")}</h3>
            {onClose && (
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl font-bold">
                ×
              </button>
            )}
          </div>
          <div className="space-y-2 mb-6">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full p-3 rounded-xl border text-left font-medium flex justify-between items-center transition-colors ${
                  selectedCode === lang.code
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                }`}>
                <span>{lang.nativeName} ({lang.name})</span>
                {selectedCode === lang.code && <span className="text-teal-600 font-bold">✓</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 bg-neutral-100 text-neutral-700 rounded-xl py-2.5 font-semibold hover:bg-neutral-200 transition-colors">
                {t("common.cancel", "Cancel")}
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 font-semibold hover:bg-teal-700 transition-colors shadow-sm">
              {t("common.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline Variant
  if (variant === "inline") {
    return (
      <div className={`space-y-2 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={`w-full p-3 rounded-xl border text-left font-medium flex justify-between items-center transition-colors ${
              language === lang.code
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-neutral-200 text-neutral-800 hover:bg-neutral-50"
            }`}>
            <span>{lang.nativeName} ({lang.name})</span>
            {language === lang.code && <span className="text-teal-600 font-bold">✓</span>}
          </button>
        ))}
      </div>
    );
  }

  // Dropdown Variant
  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{currentOption.nativeName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-2 w-44 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 divide-y divide-neutral-100 overflow-hidden">
            <div className="py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                    language === lang.code ? "text-teal-600 bg-teal-50/50 font-semibold" : "text-neutral-700"
                  }`}>
                  <span>{lang.nativeName}</span>
                  {language === lang.code ? (
                    <span className="text-teal-600 font-bold">✓</span>
                  ) : (
                    <span className="text-neutral-400 text-[10px] uppercase">{lang.code}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
