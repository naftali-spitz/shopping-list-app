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
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {categoryIconOptions.map(({ value: iconValue, label: iconLabel, Icon }) => {
          const selected = value === iconValue;

          return (
            <button
              key={iconValue}
              type="button"
              onClick={() => onChange(iconValue)}
              className={`flex h-12 items-center justify-center rounded-2xl border transition ${
                selected
                  ? "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/20"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              aria-label={iconLabel}
              title={iconLabel}
            >
              <Icon size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
