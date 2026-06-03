import { createContext, useContext, useState, ReactNode } from "react";
import { translations, TranslationKey } from "@/lib/translations";

type Lang = "nl" | "en";
type LanguageContextValue = { lang: Lang; toggleLang: () => void; t: (k: TranslationKey) => string };

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "nl";
    return (localStorage.getItem("lang") as Lang) || "nl";
  });

  const toggleLang = () => {
    setLang((l) => {
      const next = l === "nl" ? "en" : "nl";
      localStorage.setItem("lang", next);
      return next;
    });
  };

  const t = (key: TranslationKey) => translations[lang][key] ?? translations.en[key] ?? key;

  return <LanguageContext.Provider value={{ lang, toggleLang, t }}>{children}</LanguageContext.Provider>;
};

const fallbackLang: Lang = "nl";
const fallbackCtx: LanguageContextValue = {
  lang: fallbackLang,
  toggleLang: () => {},
  t: (k) => translations[fallbackLang][k] ?? translations.en[k] ?? (k as string),
};

export const useLanguage = () => useContext(LanguageContext) ?? fallbackCtx;
