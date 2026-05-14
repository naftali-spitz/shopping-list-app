"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { HistoryEntry } from "@/types/shopping";

type HistoryModalProps = {
  open: boolean;
  history: HistoryEntry[];
  onClose: () => void;
  onLoad: (items: string[]) => void;
};

export function HistoryModal({
  open,
  history,
  onClose,
  onLoad,
}: HistoryModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0b1020]/95 p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">History</h2>

                <p className="mt-1 text-sm text-white/50">
                  Reload an exported list and export again.
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl bg-white/10 p-3"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 max-h-[55vh] space-y-3 overflow-auto">
              {history.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  No exported lists yet.
                </p>
              )}

              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onLoad(entry.items)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                >
                  <div className="font-medium">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>

                  <div className="mt-1 text-sm text-white/50">
                    {entry.items.length} items · Tap to reload
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
