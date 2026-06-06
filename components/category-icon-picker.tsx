"use client";

import { CategoryIcon, categoryIconOptions } from "@/lib/category-icons";

type CategoryIconPickerProps = {
  value: CategoryIcon;
  onChange: (icon: CategoryIcon) => void;
  label?: string;
  variant?: "light" | "dark";
};

export function CategoryIconPicker({
  value,
  onChange,
  label = "Icon",
  variant = "light",
}: CategoryIconPickerProps) {
  const selectedOption =
    categoryIconOptions.find((option) => option.value === value) ??
    categoryIconOptions[0];
  const SelectedIcon = selectedOption.Icon;
  const isDark = variant === "dark";

  const previewClass = isDark
    ? "border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/20"
    : "border-cyan-500/40 bg-cyan-100 text-cyan-800 shadow-sm";

  const selectClass = isDark
    ? "border-white/10 bg-slate-900 text-white focus:border-cyan-300"
    : "border-slate-300 bg-white text-slate-950 focus:border-cyan-500";

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>

      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${previewClass}`}
      >
        <SelectedIcon size={20} strokeWidth={2.4} />
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CategoryIcon)}
        className={`h-11 min-w-0 flex-1 rounded-2xl border px-3 text-sm font-semibold outline-none transition ${selectClass}`}
        aria-label={label}
      >
        {categoryIconOptions.map(({ value: iconValue, label: iconLabel }) => (
          <option key={iconValue} value={iconValue}>
            {iconLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
