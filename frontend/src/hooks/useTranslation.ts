import { useLanguage } from "../context/LanguageContext";

export const useTranslation = () => {
  const { language, setLanguage, isLanguageReady, isLoading, t, getTranslatedField } = useLanguage();
  return {
    language,
    setLanguage,
    isLanguageReady,
    isLoading,
    t,
    getTranslatedField,
  };
};

export default useTranslation;
