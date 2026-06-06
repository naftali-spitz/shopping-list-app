"use client";

import { CategoryIcon, categoryIconOptions } from "@/lib/category-icons";

type CategoryIconPickerProps = {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
  label?: string;
};

export function CategoryIconPicker({
  value,
  onChange,
  label = "Icon",
}: CategoryIconPickerProps) {
  const selectedOption =
    categoryIconOptions.find((option) => option.value === value) ??
    categoryIconOptions[0];
  const SelectedIcon = selectedOption.Icon;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>

      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/20 text-cyan-700 shadow-sm dark:bg-cyan-300 dark:text-slate-950">
        <SelectedIcon size={20} />
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CategoryIcon)}
        className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
        aria-label={label}
      >
        {categoryIconOptions.map(({ value: iconValue, label: iconLabel }) => (
          <option key={iconValue} value={iconValue} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
            {iconLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
