"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CategoryIcon, categoryIconOptions } from "@/lib/category-icons";
import { AppCopy } from "@/lib/i18n";

type CategoryIconPickerProps = {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
  copy: AppCopy;
  variant?: "light" | "dark";
};

export function CategoryIconPicker({
  value,
  onChange,
  copy,
  variant = "dark",
}: CategoryIconPickerProps) {
  const [open, setOpen] = useState(false);
  const isDark = variant === "dark";
  const selectedOption =
    categoryIconOptions.find((option) => option.value === value) ??
    categoryIconOptions[0];
  const SelectedIcon = selectedOption.Icon;
  const selectedLabel = copy.categories.iconLabels[selectedOption.value];

  const triggerClass = isDark
    ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
    : "border-slate-200 bg-white text-slate-950 shadow-sm hover:border-cyan-300 hover:bg-cyan-50";

  const menuClass = isDark
    ? "border-white/10 bg-[#111827] text-white shadow-2xl shadow-black/40"
    : "border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-300/40";

  const optionClass = isDark
    ? "text-white/80 hover:bg-white/10 hover:text-white"
    : "text-slate-700 hover:bg-cyan-50 hover:text-slate-950";

  return (
    <div className="relative space-y-2">
      <p className={isDark ? "text-sm text-white/70" : "text-sm font-medium text-slate-600"}>
        {copy.categories.iconLabel}
      </p>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${triggerClass}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/20">
          <SelectedIcon size={21} strokeWidth={2.4} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{selectedLabel}</span>
          <span className={isDark ? "text-xs text-white/45" : "text-xs text-slate-500"}>
            {selectedOption.value}
          </span>
        </span>

        <ChevronDown
          size={20}
          className={`shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 top-full z-[140] mt-2 max-h-72 overflow-y-auto rounded-3xl border p-2 ${menuClass}`}
          role="listbox"
        >
          {categoryIconOptions.map(({ value: iconValue, Icon }) => {
            const selected = value === iconValue;
            const label = copy.categories.iconLabels[iconValue];

            return (
              <button
                key={iconValue}
                type="button"
                onClick={() => {
                  onChange(iconValue);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition ${
                  selected
                    ? "bg-cyan-300 text-slate-950"
                    : optionClass
                }`}
                role="option"
                aria-selected={selected}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    selected
                      ? "bg-slate-950/10"
                      : isDark
                        ? "bg-white/10 text-cyan-200"
                        : "bg-cyan-100 text-cyan-700"
                  }`}
                >
                  <Icon size={19} strokeWidth={2.4} />
                </span>

                <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>

                {selected && <Check size={18} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
