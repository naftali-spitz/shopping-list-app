"use client";

import { Home, Link, Plus } from "lucide-react";

import { AuthButton } from "@/components/auth-button";
import { LanguageSelector } from "@/components/language-selector";
import { AppCopy, AppDirection, AppLanguage } from "@/lib/i18n";

type HouseholdOnboardingProps = {
  email?: string | null;
  language: AppLanguage;
  direction: AppDirection;
  copy: AppCopy;
  onLanguageChange: (language: AppLanguage) => void;
  onCreateHousehold: () => void;
};

export function HouseholdOnboarding({
  email,
  language,
  direction,
  copy,
  onLanguageChange,
  onCreateHousehold,
}: HouseholdOnboardingProps) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] p-4 text-white"
      dir={direction}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.14),_transparent_36%)]" />

      <div className="absolute top-4 z-20 sm:top-6" style={{ insetInlineEnd: "1rem" }}>
        <LanguageSelector
          language={language}
          copy={copy}
          onChange={onLanguageChange}
          compact
        />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/15 text-cyan-200">
          <Home size={30} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            {copy.household.welcome}
          </p>
          <h1 className="mt-3 text-3xl font-bold">{copy.household.choose}</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            {copy.household.noHousehold(email)}
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/15 p-4">
          <div className="flex gap-3 text-sm leading-6 text-white/70">
            <Link className="mt-1 shrink-0 text-cyan-200" size={18} />
            <p>{copy.household.inviteHelp}</p>
          </div>
        </div>

        <button
          onClick={onCreateHousehold}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          <Plus size={18} />
          {copy.household.createNew}
        </button>

        <div className="mt-4 flex justify-center">
          <AuthButton variant="secondary" label={copy.auth.useDifferentGoogleAccount} />
        </div>
      </div>
    </main>
  );
}
