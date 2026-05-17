"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit2, Plus, Search, X } from "lucide-react";
import { Category } from "@/types/shopping";

type CategoryModalProps = {
  category: Category | null;
  shoppingList: string[];
  searchTerm: string;
  sortMode: "az" | "popular";
  newProductName: string;
  products: Category["products"];
  onClose: () => void;
  onToggleItem: (item: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "az" | "popular") => void;
  onNewProductChange: (value: string) => void;
  onAddProduct: () => void;
  onEditProduct: (id: string) => void;
};

export function CategoryModal({
  category,
  shoppingList,
  searchTerm,
  sortMode,
  newProductName,
  products,
  onClose,
  onToggleItem,
  onSearchChange,
  onSortChange,
  onNewProductChange,
  onAddProduct,
  onEditProduct,
}: CategoryModalProps) {
  return (
    <AnimatePresence>
      {category && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[32px] border border-white/10 bg-[#0b1020]/90 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">{category.name}</h2>

                <p className="mt-2 text-sm text-white/60">
                  Sort, add, remove, and choose products.
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4">
                <Search size={16} className="opacity-50" />

                <input
                  value={searchTerm}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search products"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/40"
                />
              </div>

              <select
                value={sortMode}
                onChange={(event) =>
                  onSortChange(event.target.value as "az" | "popular")
                }
                className="rounded-2xl border border-white/10 bg-[#10172a] px-4 py-3 text-sm outline-none"
              >
                <option value="popular">Most chosen</option>
                <option value="az">A-Z</option>
              </select>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={newProductName}
                onChange={(event) => onNewProductChange(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && onAddProduct()
                }
                placeholder="Add product"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/40"
              />

              <button
                onClick={onAddProduct}
                className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="mt-8 space-y-3">
              {products.map((product, index) => {
                const selected = shoppingList.includes(product.name);

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                      selected
                        ? "border-cyan-400 bg-cyan-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <button
                      onClick={() => onToggleItem(product.name)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div
                        className={`h-4 w-4 rounded-full ${
                          selected ? "bg-cyan-300" : "bg-white/20"
                        }`}
                      />

                      <span>{product.name}</span>

                      <span className="ml-auto pr-3 text-xs text-white/40">
                        {product.usageCount}x
                      </span>
                    </button>

                    <button
                      onClick={() => onEditProduct(product.id)}
                      className="rounded-full bg-cyan-400/10 p-2 text-cyan-300"
                    >
                      <Edit2 size={15} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}