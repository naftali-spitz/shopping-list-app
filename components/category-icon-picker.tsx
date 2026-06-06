"use client";

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
  const isDark = variant === "dark";

  const baseButtonClass = isDark
    ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
    : "border-slate-200 bg-white/80 text-slate-600 shadow-sm hover:border-cyan-300 hover:bg-cyan-50 hover:text-slate-950";

  const selectedButtonClass =
    "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/20";

  return (
    <div className="space-y-3">
      <p className={isDark ? "text-sm text-white/70" : "text-sm font-medium text-slate-600"}>
        {copy.categories.iconLabel}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {categoryIconOptions.map(({ value: iconValue, Icon }) => {
          const selected = value === iconValue;
          const label = copy.categories.iconLabels[iconValue];

          return (
            <button
              key={iconValue}
              type="button"
              onClick={() => onChange(iconValue)}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-semibold transition ${
                selected ? selectedButtonClass : baseButtonClass
              }`}
              aria-label={label}
              title={label}
            >
              <Icon size={20} strokeWidth={2.4} />
              <span className="leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
