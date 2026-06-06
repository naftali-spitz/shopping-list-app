"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { History, Menu } from "lucide-react";
import { AppCopy } from "@/lib/i18n";

type TopBarProps = {
  copy: AppCopy;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  cardClass: string;
};

export function TopBar({
  copy,
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
          whileHover={{ rotate: -4, scale: 1.06 }}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl shadow-[0_0_22px_rgba(34,211,238,0.22)] sm:h-12 sm:w-12"
        >
          <Image
            src="/app-logo.svg"
            alt="FutureCart"
            fill
            priority
            className="object-cover"
          />
        </motion.div>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{copy.topBar.title}</h1>
          <p className="truncate text-xs opacity-60 sm:text-sm">
            {copy.topBar.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
          aria-label={copy.topBar.openHistory}
        >
          <History size={18} />
        </button>

        <button
          onClick={onOpenProfile}
          className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
          aria-label={copy.topBar.openMenu}
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
