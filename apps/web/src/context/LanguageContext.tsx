import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { translations } from '../i18n/dictionaries/index';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, localeForLanguage, type Language } from '../i18n/language';

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' || stored === 'es' ? stored : DEFAULT_LANGUAGE;
}

/**
 * Covers the "core" surfaces (auth, nav, calendar hub) established by task 5.11 -- most of the
 * app's copy is still hardcoded Spanish. `t()` falls back to the key itself for anything not yet
 * in the dictionaries, so extending coverage feature-by-feature is additive and never breaks.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadStoredLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'es' ? 'en' : 'es');
  }, [language, setLanguage]);

  const t = useCallback((key: string) => translations[language][key] ?? key, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, locale: localeForLanguage(language), setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
