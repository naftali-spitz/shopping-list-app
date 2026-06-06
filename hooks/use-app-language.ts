"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APP_LANGUAGE_STORAGE_KEY,
  AppLanguage,
  appCopy,
  getAppDirection,
  getBrowserDefaultLanguage,
  isAppLanguage,
} from "@/lib/i18n";

export function useAppLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>("he");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedLanguage = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);

    setLanguageState(
      isAppLanguage(storedLanguage) ? storedLanguage : getBrowserDefaultLanguage()
    );
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  };

  const direction = getAppDirection(language);
  const copy = useMemo(() => appCopy[language], [language]);

  return {
    language,
    setLanguage,
    direction,
    copy,
  };
}
