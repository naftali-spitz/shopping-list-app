"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { AppCopy, appCopy } from "@/lib/i18n";
import { Product } from "@/types/shopping";

type ShoppingDrawerProps = {
  copy?: AppCopy;
  items: Product[];
  onRemove: (productId: string) => void;
  onIncreaseQuantity: (productId: string) => void;
  onDecreaseQuantity: (productId: string) => void;
  onExport: () => void;
};

export function ShoppingDrawer({ copy = appCopy.he, items, onRemove, onIncreaseQuantity, onDecreaseQuantity, onExport }: ShoppingDrawerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-cyan-400/20 bg-[#0d1328]/90 px-5 py-3 text-white shadow-2xl backdrop-blur-xl transition hover:scale-[1.03] sm:hidden">
        <ShoppingCart size={18} className="text-cyan-300" />
        <span className="text-sm font-medium">{items.length}</span>
      </button>
      <div className="hidden sm:block"><DrawerContent copy={copy} items={items} onRemove={onRemove} onIncreaseQuantity={onIncreaseQuantity} onDecreaseQuantity={onDecreaseQuantity} onExport={onExport} /></div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden" onClick={() => setOpen(false)}>
            <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={{ type: "spring", damping: 24 }} onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 right-0 rounded-t-[32px] border border-white/10 bg-[#0d1328]/95 p-5 text-white shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div><h2 className="text-xl font-bold">{copy.shoppingDrawer.title}</h2><p className="text-sm text-white/60">{copy.shoppingDrawer.itemsInList(items.length)}</p></div>
                <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2" aria-label={copy.common.close}><X size={18} /></button>
              </div>
              <DrawerList copy={copy} items={items} onRemove={onRemove} onIncreaseQuantity={onIncreaseQuantity} onDecreaseQuantity={onDecreaseQuantity} />
              <button onClick={onExport} disabled={!items.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40">
                <Download size={18} />{copy.shoppingDrawer.exportDoc}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type DrawerContentProps = Required<Pick<ShoppingDrawerProps, "copy">> & Omit<ShoppingDrawerProps, "copy">;
function DrawerContent({ copy, items, onRemove, onIncreaseQuantity, onDecreaseQuantity, onExport }: DrawerContentProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-4 left-6 z-20 h-fit w-[360px] rounded-3xl border border-white/10 bg-black/55 p-5 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{copy.shoppingDrawer.title}</h2><div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">{copy.shoppingDrawer.itemCount(items.length)}</div></div>
      <DrawerList copy={copy} items={items} onRemove={onRemove} onIncreaseQuantity={onIncreaseQuantity} onDecreaseQuantity={onDecreaseQuantity} />
      <button onClick={onExport} disabled={!items.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"><Download size={18} />{copy.shoppingDrawer.exportDoc}</button>
    </motion.div>
  );
}

type DrawerListProps = { copy: AppCopy; items: Product[]; onRemove: (productId: string) => void; onIncreaseQuantity: (productId: string) => void; onDecreaseQuantity: (productId: string) => void; };
function DrawerList({ copy, items, onRemove, onIncreaseQuantity, onDecreaseQuantity }: DrawerListProps) {
  return (
    <div className="mt-4 max-h-[260px] space-y-3 overflow-auto pr-2">
      <AnimatePresence initial={false}>
        {items.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">{copy.shoppingDrawer.empty}</p>}
        {items.map((item) => {
          const canDecrease = item.quantity > 1;
          return (
            <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <button onClick={() => onRemove(item.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-300 transition hover:bg-red-500/30" aria-label={copy.shoppingDrawer.removeItem(item.name)}><X size={14} /></button>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">{item.name}</span>
              <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/5 p-1">
                <button onClick={() => onDecreaseQuantity(item.id)} disabled={!canDecrease} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" aria-label={copy.shoppingDrawer.decreaseItem(item.name)}><Minus size={14} /></button>
                <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                <button onClick={() => onIncreaseQuantity(item.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-black transition hover:scale-105" aria-label={copy.shoppingDrawer.increaseItem(item.name)}><Plus size={14} /></button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
