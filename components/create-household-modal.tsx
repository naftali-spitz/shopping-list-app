"use client";

import { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home, X } from "lucide-react";

type CreateHouseholdModalProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function CreateHouseholdModal({
  open,
  value,
  onChange,
  onClose,
  onCreate,
}: CreateHouseholdModalProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-md sm:items-center"
          onClick={onClose}
        >
          <motion.form
            initial={{ opacity: 0, y: 80, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-t-[32px] border border-white/10 bg-[#0b1020]/95 p-6 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[32px] sm:p-7"
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <Home size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Create household</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Start a separate shared shopping list.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20"
                aria-label="Close create household modal"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-white/75">Household name</span>
              <input
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="My household"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/50 focus:bg-white/15"
              />
            </label>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white/80 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
