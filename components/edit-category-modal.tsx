"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { CategoryIcon } from "@/lib/category-icons";
import { AppCopy, appCopy } from "@/lib/i18n";
import { Category } from "@/types/shopping";

type EditCategoryModalProps = {
  copy?: AppCopy;
  category: Category | null;
  open: boolean;
  value: string;
  icon: CategoryIcon;
  onClose: () => void;
  onChange: (value: string) => void;
  onIconChange: (icon: CategoryIcon) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function EditCategoryModal({
  copy = appCopy.he,
  category,
  open,
  value,
  icon,
  onClose,
  onChange,
  onIconChange,
  onSave,
  onDelete,
}: EditCategoryModalProps) {
  return (
    <AnimatePresence>
      {open && category && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1328]/95 p-6 text-white shadow-2xl"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{copy.categories.editCategory}</h2>
              <p className="mt-2 text-sm text-white/60">
                {copy.categories.editCategoryDescription}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{copy.categories.categoryName}</label>

              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                dir="auto"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              />
            </div>

            <div className="mt-5">
              <CategoryIconPicker
                value={icon}
                onChange={onIconChange}
                label={copy.categories.iconLabel}
              />
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                onClick={onDelete}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 transition hover:bg-red-500/20"
              >
                {copy.categories.deleteCategory}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-white/70 transition hover:bg-white/10"
                >
                  {copy.common.cancel}
                </button>

                <button
                  onClick={onSave}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-black transition hover:scale-[1.02]"
                >
                  {copy.common.save}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
