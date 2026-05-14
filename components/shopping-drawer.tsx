"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";

type ShoppingDrawerProps = {
  items: string[];
  onRemove: (item: string) => void;
  onExport: () => void;
};

export function ShoppingDrawer({
  items,
  onRemove,
  onExport,
}: ShoppingDrawerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-4 bottom-4 z-20 mx-auto h-fit max-w-[420px] rounded-3xl border border-white/10 bg-black/55 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-[360px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Shopping List</h2>

        <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">
          {items.length} Items
        </div>
      </div>

      <div className="mt-4 max-h-[260px] space-y-3 overflow-auto pr-2">
        <AnimatePresence initial={false}>
          {items.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Your active list is empty. Pick a category to start.
            </p>
          )}

          {items.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={item}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <span>{item}</span>

              <button
                onClick={() => onRemove(item)}
                className="rounded-full bg-red-500/20 p-1 text-red-300"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        onClick={onExport}
        disabled={!items.length}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={18} />
        Export DOC
      </button>
    </motion.div>
  );
}
