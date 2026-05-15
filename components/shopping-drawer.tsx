"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ShoppingCart, X } from "lucide-react";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-cyan-400/20 bg-[#0d1328]/90 px-5 py-3 text-white shadow-2xl backdrop-blur-xl transition hover:scale-[1.03] sm:hidden"
      >
        <ShoppingCart size={18} className="text-cyan-300" />

        <span className="text-sm font-medium">{items.length}</span>
      </button>

      <div className="hidden sm:block">
        <DrawerContent
          items={items}
          onRemove={onRemove}
          onExport={onExport}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 rounded-t-[32px] border border-white/10 bg-[#0d1328]/95 p-5 text-white shadow-2xl"
              dir="rtl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">רשימת קניות</h2>
                  <p className="text-sm text-white/60">
                    {items.length} מוצרים ברשימה
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/10 bg-white/5 p-2"
                >
                  <X size={18} />
                </button>
              </div>

              <DrawerList items={items} onRemove={onRemove} />

              <button
                onClick={onExport}
                disabled={!items.length}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={18} />
                ייצא מסמך
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type DrawerContentProps = ShoppingDrawerProps;

function DrawerContent({
  items,
  onRemove,
  onExport,
}: DrawerContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-6 z-20 h-fit w-[360px] rounded-3xl border border-white/10 bg-black/55 p-5 text-white shadow-2xl backdrop-blur-xl"
      dir="rtl"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">רשימת קניות</h2>

        <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">
          {items.length} מוצרים
        </div>
      </div>

      <DrawerList items={items} onRemove={onRemove} />

      <button
        onClick={onExport}
        disabled={!items.length}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={18} />
        ייצא מסמך
      </button>
    </motion.div>
  );
}

type DrawerListProps = {
  items: string[];
  onRemove: (item: string) => void;
};

function DrawerList({ items, onRemove }: DrawerListProps) {
  return (
    <div className="mt-4 max-h-[260px] space-y-3 overflow-auto pr-2">
      <AnimatePresence initial={false}>
        {items.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            הרשימה ריקה כרגע.
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
  );
}
