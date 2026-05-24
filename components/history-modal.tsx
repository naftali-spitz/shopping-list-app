"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, X } from "lucide-react";
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
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedItems([]);
      return;
    }

    setSelectedItems(selectedEntry.items);
  }, [selectedEntry]);

  const allSelected = useMemo(() => {
    if (!selectedEntry) return false;

    return selectedItems.length === selectedEntry.items.length;
  }, [selectedEntry, selectedItems]);

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  const toggleAll = () => {
    if (!selectedEntry) return;

    setSelectedItems(
      allSelected ? [] : selectedEntry.items
    );
  };

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
                  Browse previous exports and restore selected items.
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedEntry(null);
                  onClose();
                }}
                className="rounded-2xl bg-white/10 p-3"
              >
                <X size={18} />
              </button>
            </div>

            {!selectedEntry ? (
              <div className="mt-6 max-h-[55vh] space-y-3 overflow-auto">
                {history.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    No exported lists yet.
                  </p>
                )}

                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                  >
                    <div className="font-medium">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>

                    <div className="mt-1 text-sm text-white/50">
                      {entry.items.length} items · Tap to preview
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <div className="font-medium">
                      {new Date(selectedEntry.createdAt).toLocaleString()}
                    </div>

                    <div className="mt-1 text-sm text-white/50">
                      {selectedItems.length} selected
                    </div>
                  </div>

                  <button
                    onClick={toggleAll}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
                  >
                    {allSelected ? "Clear" : "Select all"}
                  </button>
                </div>

                <div className="mt-4 max-h-[45vh] space-y-2 overflow-auto">
                  {selectedEntry.items.map((item) => {
                    const selected = selectedItems.includes(item);

                    return (
                      <button
                        key={item}
                        onClick={() => toggleItem(item)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-right transition ${
                          selected
                            ? "border-emerald-400/40 bg-emerald-400/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <span>{item}</span>

                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected
                              ? "border-emerald-400 bg-emerald-400 text-black"
                              : "border-white/20"
                          }`}
                        >
                          {selected && <Check size={14} />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                  >
                    Back
                  </button>

                  <button
                    onClick={() => {
                      onLoad(selectedItems);
                      setSelectedEntry(null);
                      onClose();
                    }}
                    disabled={selectedItems.length === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={18} />
                    Add Selected
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
