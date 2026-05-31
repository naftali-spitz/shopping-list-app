"use client";

import { useEffect, useState } from "react";

const DARK_MODE_STORAGE_KEY = "futurecart.darkMode";

function getInitialDarkMode() {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
}

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  return [darkMode, setDarkMode] as const;
}
