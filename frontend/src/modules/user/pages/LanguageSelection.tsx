import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage, LanguageOption, DEFAULT_LANGUAGES } from "../../../context/LanguageContext";
import { useAuth } from "../../../context/AuthContext";
import { updateCustomerLanguage } from "../../../services/api/customerService";
import api from "../../../services/api/config";

export const LanguageSelection: React.FC = () => {
  const navigate = useNavigate();
  const { setLanguage, t } = useLanguage();
  const { user, updateUser } = useAuth();

  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchActiveLanguages = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/languages");
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setLanguages(res.data.data);
      }
    } catch (err) {
      // Fallback to DEFAULT_LANGUAGES on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveLanguages();
  }, []);

  const handleContinue = async () => {
    if (!selectedLanguage || submitting) return;

    try {
      setSubmitting(true);
      setError("");

      // 1. Save to MongoDB preference via API if logged in
      if (user) {
        await updateCustomerLanguage(selectedLanguage);
      }

      // 2. Local Storage Sync
      try {
        localStorage.setItem("app_language", selectedLanguage);
        localStorage.setItem("delivery_lang", selectedLanguage);
      } catch {
        // Ignore storage errors
      }

      // 3. Update LanguageContext immediately
      setLanguage(selectedLanguage);

      // 4. Update AuthContext user state
      if (user) {
        updateUser({
          ...user,
          preferredLanguage: selectedLanguage,
        });
      }

      // 5. Navigate to Home directly
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Failed to set preferred language:", err);
      setError(err.response?.data?.message || "Failed to save language preference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-white flex flex-col justify-between items-center relative overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 select-none"
      style={{
        minHeight: "100dvh",
        paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
      }}
    >
      {/* Background Soft Mint & Emerald Ambient Accents */}
      <div className="fixed -top-24 left-1/2 -translate-x-1/2 w-full max-w-lg h-80 bg-gradient-to-b from-emerald-100/70 via-teal-50/40 to-transparent pointer-events-none -z-10 blur-2xl" />
      <div className="fixed top-1/3 -right-20 w-64 h-64 rounded-full bg-emerald-50/60 blur-3xl pointer-events-none -z-10" />

      {/* Main Content Container */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center my-auto py-2 z-10">

        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6 sm:mb-8">
          {/* Logo Badge Container */}
          <div className="mb-4 p-2 bg-white/90 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-center transition-transform hover:scale-105">
            <img
              src="/assets/olovelylogo_transparent.png"
              alt="Olovely Total Suvidha"
              className="w-32 sm:w-36 h-auto max-h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/olovelylogo.png";
              }}
            />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t("languageSelection.title", "Choose your language")}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-500 font-medium mt-1.5 px-2">
            {t("languageSelection.subtitle", "Select your preferred language to continue")}
          </p>
        </div>

        {/* Languages Container */}
        <div className="w-full mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white/60 rounded-3xl border border-slate-100 shadow-xs">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-emerald-600 border-t-transparent mb-3" />
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Loading available languages...</p>
            </div>
          ) : error && languages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200/80 rounded-2xl text-center">
              <p className="text-xs sm:text-sm font-medium text-red-600 mb-3">{error}</p>
              <button
                onClick={fetchActiveLanguages}
                className="px-4 py-2 bg-white text-red-600 font-semibold text-xs rounded-xl border border-red-200 shadow-xs hover:bg-red-50 transition-all cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              className="space-y-3 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto scrollbar-hide py-1 px-1"
              role="radiogroup"
              aria-label="Select Language"
            >
              {languages.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <div
                    key={lang.code}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedLanguage(lang.code)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedLanguage(lang.code);
                      }
                    }}
                    className={`w-full min-h-[72px] px-4 py-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between shadow-xs active:scale-[0.99] cursor-pointer select-none ${
                      isSelected
                        ? "bg-emerald-50/90 border-2 border-emerald-600 shadow-md shadow-emerald-900/5"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Left: Flag / Language Icon */}
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-colors ${
                        isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {lang.flag || "🌐"}
                      </div>

                      {/* Language Names */}
                      <div className="flex flex-col text-left">
                        <span className={`text-base sm:text-lg font-bold leading-tight ${
                          isSelected ? "text-emerald-950" : "text-slate-900"
                        }`}>
                          {lang.nativeName}
                        </span>
                        <span className="text-xs text-slate-400 font-medium mt-0.5">
                          {lang.name}
                        </span>
                      </div>
                    </div>

                    {/* Right: Circular Selection Indicator */}
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && languages.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-medium text-center">
              {error}
            </div>
          )}
        </div>

        {/* Continue Button CTA */}
        <div className="w-full mb-4">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedLanguage || submitting}
            className={`w-full h-14 rounded-2xl font-bold text-base sm:text-lg tracking-wide transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 ${
              selectedLanguage && !submitting
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/25 cursor-pointer"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
            }`}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2 text-white">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Setting Up...
              </span>
            ) : (
              <>
                <span>{t("common.continue", "Continue")}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Footer Informational Message */}
        <p className="text-xs sm:text-sm text-slate-400 text-center font-medium leading-relaxed px-2">
          {t("languageSelection.footerNotePrefix", "You can change your language anytime from ")}
          <span
            onClick={() => navigate('/account')}
            className="font-bold text-emerald-600 hover:underline cursor-pointer"
          >
            {t("account.settings", "Account Settings")}
          </span>
        </p>

      </div>
    </div>
  );
};

export default LanguageSelection;
