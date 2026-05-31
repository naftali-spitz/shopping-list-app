"use client";

import { X } from "lucide-react";
import { Category } from "@/types/shopping";

type AddMissingProductModalProps = {
  open: boolean;
  productName: string;
  categories: Category[];
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onClose: () => void;
  onAdd: () => void;
};

export function AddMissingProductModal({
  open,
  productName,
  categories,
  selectedCategoryId,
  onCategoryChange,
  onClose,
  onAdd,
}: AddMissingProductModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-missing-product-title"
    >
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#07111f]/95 p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-missing-product-title" className="text-xl font-bold">
              הוספת מוצר חדש
            </h2>
            <p className="mt-1 text-sm text-white/60">
              בחר קטגוריה ונוסיף את המוצר ישירות לרשימת הקניות.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3">
          <div className="text-xs text-cyan-100/70">שם המוצר</div>
          <div className="mt-1 text-lg font-semibold text-cyan-50">{productName}</div>
        </div>

        <label className="mt-5 block text-sm font-medium text-white/80">
          קטגוריה
          <select
            value={selectedCategoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
          >
            <option value="" className="bg-slate-900">
              בחר קטגוריה
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="bg-slate-900">
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-3 text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={!selectedCategoryId}
            className="rounded-2xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            הוסף לרשימה
          </button>
        </div>
      </div>
    </div>
  );
}
