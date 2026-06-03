import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getT, getStoredLang, setStoredLang } from '../translations';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLang);
  const t = useCallback((key) => getT(lang)(key), [lang]);

  // Sync with backend: fetch language on mount (handheld saves to API)
  useEffect(() => {
    fetch(`${API}/settings/language`)
      .then((r) => r.json())
      .then((data) => {
        const apiLang = data?.value;
        if (apiLang && ['en', 'nl', 'fr', 'tr'].includes(apiLang)) {
          setLangState(apiLang);
          setStoredLang(apiLang);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((newLang) => {
    setStoredLang(newLang);
    setLangState(newLang);
    // Persist to backend so handheld and frontend stay in sync
    fetch(`${API}/settings/language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newLang }),
    }).catch(() => {});
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (k) => k };
  return ctx;
}
