"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { AppSound } from "@/lib/app-sounds";
import { CategoryIcon } from "@/lib/category-icons";
import { AppCopy, appCopy } from "@/lib/i18n";
import { Category } from "@/types/shopping";

type EditCategoryModalProps = {
  copy?: AppCopy;
  category: Category | null;
  mode?: "create" | "edit";
  open: boolean;
  value: string;
  icon: CategoryIcon;
  onClose: () => void;
  onChange: (value: string) => void;
  onIconChange: (icon: CategoryIcon) => void;
  onSave: () => void;
  onDelete?: () => void;
  onPlaySound?: (sound?: AppSound) => void;
};

export function EditCategoryModal({
  copy = appCopy.he,
  category,
  mode = "edit",
  open,
  value,
  icon,
  onClose,
  onChange,
  onIconChange,
  onSave,
  onDelete,
  onPlaySound,
}: EditCategoryModalProps) {
  const isCreate = mode === "create";
  const title = isCreate ? copy.categories.createCategory : copy.categories.editCategory;
  const description = isCreate ? copy.categories.createCategoryDescription : copy.categories.editCategoryDescription;
  const submitText = isCreate ? copy.common.create : copy.common.save;
  const closeWithSound = () => {
    onPlaySound?.("tap");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (isCreate || category) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center sm:p-4"
          onClick={closeWithSound}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 60 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0d1328]/95 p-6 text-white shadow-2xl backdrop-blur-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="mb-6">
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{copy.categories.categoryName}</label>

              <input
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={copy.categories.addCategoryPlaceholder}
                dir="auto"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition placeholder:text-white/35 focus:border-cyan-400"
              />
            </div>

            <div className="mt-5">
              <CategoryIconPicker
                value={icon}
                onChange={onIconChange}
                copy={copy}
                variant="dark"
                onPlaySound={onPlaySound}
              />
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {!isCreate && onDelete ? (
                <button
                  onClick={() => {
                    onPlaySound?.("delete");
                    onDelete();
                  }}
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 transition hover:bg-red-500/20"
                >
                  {copy.categories.deleteCategory}
                </button>
              ) : (
                <span />
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeWithSound}
                  className="flex-1 rounded-2xl border border-white/10 px-5 py-3 text-white/70 transition hover:bg-white/10 sm:flex-none"
                >
                  {copy.common.cancel}
                </button>

                <button
                  onClick={() => {
                    onPlaySound?.("success");
                    onSave();
                  }}
                  disabled={!value.trim()}
                  className="flex-1 rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                >
                  {submitText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
