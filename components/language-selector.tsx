"use client";

import { Languages } from "lucide-react";
import { AppCopy, AppLanguage, appLanguages } from "@/lib/i18n";

type LanguageSelectorProps = {
  language: AppLanguage;
  copy: AppCopy;
  onChange: (language: AppLanguage) => void;
  compact?: boolean;
};

export function LanguageSelector({
  language,
  copy,
  onChange,
  compact = false,
}: LanguageSelectorProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 text-white shadow-sm backdrop-blur-xl ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <Languages size={compact ? 15 : 17} className="text-cyan-200" />
      <span className="font-medium text-white/75">{copy.language.label}</span>
      <select
        value={language}
        onChange={(event) => onChange(event.target.value as AppLanguage)}
        className="bg-transparent font-semibold text-white outline-none"
        aria-label={copy.language.label}
      >
        {appLanguages.map((option) => (
          <option key={option} value={option} className="bg-slate-950 text-white">
            {copy.language.options[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
