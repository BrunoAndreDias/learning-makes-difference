import i18next, { type i18n } from "i18next";
import { type ReactNode, useMemo } from "react";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";

import { userLanguageResources } from "./catalogs";
import {
  detectAnonymousUserLanguage,
  fallbackUserLanguage,
  type UserLanguage,
} from "./user-language";

function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (navigator.languages.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}

function createAppI18n(language: UserLanguage): i18n {
  const instance = i18next.createInstance();

  instance.use(initReactI18next).init({
    fallbackLng: fallbackUserLanguage,
    interpolation: {
      escapeValue: false,
    },
    lng: language,
    resources: userLanguageResources,
  });

  return instance;
}

export function AppLanguageProvider({
  children,
  language,
}: Readonly<{
  children: ReactNode;
  language?: UserLanguage;
}>) {
  const activeLanguage =
    language ?? detectAnonymousUserLanguage(getBrowserLanguages());
  const i18n = useMemo(() => createAppI18n(activeLanguage), [activeLanguage]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useAppTranslation() {
  return useTranslation();
}
