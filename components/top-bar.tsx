"use client";

import { motion } from "framer-motion";
import { History, Menu, Moon, ShoppingCart, Sun } from "lucide-react";

type TopBarProps = {
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  cardClass: string;
};

export function TopBar({
  darkMode,
  onToggleTheme,
  onOpenHistory,
  onOpenProfile,
  cardClass,
}: TopBarProps) {
  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-4 rounded-3xl border px-5 py-4 backdrop-blur-xl ${cardClass}`}
    >
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.08 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/20"
        >
          <ShoppingCart className="text-cyan-300" />
        </motion.div>

        <div>
          <h1 className="text-xl font-semibold">FutureCart</h1>
          <p className="text-sm opacity-60">
            Smart shopping companion
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

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
