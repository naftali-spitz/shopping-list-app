"use client";

import { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Home, Languages, PackagePlus, X } from "lucide-react";
import { AppCopy, AppDirection } from "@/lib/i18n";
import type { DefaultHouseholdLanguage } from "@/lib/default-household-template";

type CreateHouseholdModalProps = {
  open: boolean;
  value: string;
  copy: AppCopy;
  direction: AppDirection;
  useDefaultProducts: boolean;
  defaultLanguage: DefaultHouseholdLanguage;
  isCreating?: boolean;
  onChange: (value: string) => void;
  onUseDefaultProductsChange: (value: boolean) => void;
  onDefaultLanguageChange: (value: DefaultHouseholdLanguage) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function CreateHouseholdModal({
  open,
  value,
  copy,
  direction,
  useDefaultProducts,
  defaultLanguage,
  isCreating = false,
  onChange,
  onUseDefaultProductsChange,
  onDefaultLanguageChange,
  onClose,
  onCreate,
}: CreateHouseholdModalProps) {
  const starterCopy =
    direction === "rtl"
      ? {
          title: "מוצרי פתיחה",
          description: "צור קטגוריות ומוצרים בסיסיים כדי להתחיל מהר.",
          languageLabel: "שפת מוצרי הפתיחה",
          creating: "יוצר...",
        }
      : {
          title: "Starter products",
          description: "Create basic categories and products so the household starts ready.",
          languageLabel: "Starter list language",
          creating: "Creating...",
        };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCreating) onCreate();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-md sm:items-center"
          onClick={() => { if (!isCreating) onClose(); }}
          dir={direction}
        >
          <motion.form
            initial={{ opacity: 0, y: 80, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-[#0b1020]/95 p-6 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[32px] sm:p-7"
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <Home size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{copy.household.createTitle}</h2>
                  <p className="mt-1 text-sm text-white/50">
                    {copy.household.createDescription}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={copy.common.close}
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-white/75">{copy.household.nameLabel}</span>
              <input
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={copy.household.namePlaceholder}
                dir="auto"
                disabled={isCreating}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/50 focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={useDefaultProducts}
                  disabled={isCreating}
                  onChange={(event) => onUseDefaultProductsChange(event.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border transition ${
                    useDefaultProducts
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : "border-white/20 bg-white/10 text-transparent"
                  }`}
                >
                  <Check size={15} strokeWidth={3} />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                    <PackagePlus size={16} className="text-cyan-200" />
                    {starterCopy.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-white/50">
                    {starterCopy.description}
                  </span>
                </span>
              </label>

              {useDefaultProducts && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/55">
                    <Languages size={14} />
                    {starterCopy.languageLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["he", "en"] as DefaultHouseholdLanguage[]).map((language) => (
                      <button
                        key={language}
                        type="button"
                        disabled={isCreating}
                        onClick={() => onDefaultLanguageChange(language)}
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          defaultLanguage === language
                            ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30"
                            : "bg-white/10 text-white/75 hover:bg-white/15"
                        }`}
                      >
                        {language === "he" ? "עברית" : "English"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.common.cancel}
              </button>
              <button
                type="submit"
                disabled={!value.trim() || isCreating}
                className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? starterCopy.creating : copy.common.create}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
