"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Category } from "@/types/shopping";

type EditCategoryModalProps = {
  category: Category | null;
  open: boolean;
  value: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function EditCategoryModal({
  category,
  open,
  value,
  onClose,
  onChange,
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
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1328]/95 p-6 text-white shadow-2xl"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold">עריכת קטגוריה</h2>
              <p className="mt-2 text-sm text-white/60">
                שנה שם קטגוריה בצורה בטוחה.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">שם קטגוריה</label>

              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              />
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                onClick={onDelete}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 transition hover:bg-red-500/20"
              >
                מחק קטגוריה
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-white/70 transition hover:bg-white/10"
                >
                  ביטול
                </button>

                <button
                  onClick={onSave}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-black transition hover:scale-[1.02]"
                >
                  שמור
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
