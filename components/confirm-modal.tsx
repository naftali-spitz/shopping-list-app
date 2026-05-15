"use client";

import { AnimatePresence, motion } from "framer-motion";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "מחק",
  cancelText = "ביטול",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            className="w-full max-w-sm rounded-3xl border border-red-500/20 bg-[#0d1328]/95 p-6 text-white shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-red-300">{title}</h2>

            <p className="mt-3 text-sm leading-6 text-white/70">
              {description}
            </p>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="rounded-2xl border border-white/10 px-5 py-3 text-white/70 transition hover:bg-white/10"
              >
                {cancelText}
              </button>

              <button
                onClick={onConfirm}
                className="rounded-2xl bg-red-500 px-5 py-3 font-medium text-white transition hover:scale-[1.02]"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
