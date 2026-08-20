"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const dictionaries = {
  en,
  fr
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load from local storage on mount
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'fr')) {
      setLanguageState(savedLang);
    } else {
      // Default based on browser or fallback to en
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'fr') {
        setLanguageState('fr');
      }
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    
    // 1. Try active language dictionary
    let current: any = dictionaries[language];
    let found = true;
    for (const k of keys) {
      if (!current || current[k] === undefined) {
        found = false;
        break;
      }
      current = current[k];
    }
    if (found && typeof current === 'string') return current;

    // 2. Fallback to English dictionary
    current = dictionaries.en;
    found = true;
    for (const k of keys) {
      if (!current || current[k] === undefined) {
        found = false;
        break;
      }
      current = current[k];
    }
    if (found && typeof current === 'string') return current;

    // 3. Graceful fallback: convert "navigation.dashboard" -> "Dashboard"
    const lastPart = keys[keys.length - 1] || key;
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, ' ');
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
