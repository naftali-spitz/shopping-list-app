"use client";

import { motion } from "framer-motion";
import { History, Menu, ShoppingCart } from "lucide-react";

type TopBarProps = {
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  cardClass: string;
};

export function TopBar({
  onOpenHistory,
  onOpenProfile,
  cardClass,
}: TopBarProps) {
  return (
    <header
      className={`flex items-center justify-between gap-3 rounded-3xl border px-4 py-4 backdrop-blur-xl sm:px-5 ${cardClass}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.08 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/20 sm:h-12 sm:w-12"
        >
          <ShoppingCart className="text-cyan-300" size={22} />
        </motion.div>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold sm:text-xl">FutureCart</h1>
          <p className="truncate text-xs opacity-60 sm:text-sm">
            Smart shopping companion
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
          aria-label="Open history"
        >
          <History size={18} />
        </button>

        <button
          onClick={onOpenProfile}
          className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
          aria-label="Open profile settings"
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
