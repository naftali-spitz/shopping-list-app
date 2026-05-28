"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { Edit2, GripVertical, Plus, Search, X } from "lucide-react";
import { Category, Product } from "@/types/shopping";

type ProductSortMode = "az" | "popular" | "custom";

type CategoryModalProps = {
  category: Category | null;
  shoppingList: string[];
  searchTerm: string;
  sortMode: ProductSortMode;
  newProductName: string;
  products: Category["products"];
  onClose: () => void;
  onToggleItem: (item: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ProductSortMode) => void;
  onNewProductChange: (value: string) => void;
  onAddProduct: () => void;
  onEditProduct: (id: string) => void;
};

type ProductRowProps = {
  product: Product;
  selected: boolean;
  index: number;
  showDragHandle: boolean;
  canReorder: boolean;
  onToggleItem: (item: string) => void;
  onEditProduct: (id: string) => void;
};

function ProductRow({
  product,
  selected,
  index,
  showDragHandle,
  canReorder,
  onToggleItem,
  onEditProduct,
}: ProductRowProps) {
  const dragControls = useDragControls();

  const rowContent = (
    <>
      {showDragHandle && (
        <button
          type="button"
          disabled={!canReorder}
          aria-label="Reorder product"
          title={canReorder ? "Drag to reorder" : "Clear search to reorder"}
          onPointerDown={(event) => {
            if (!canReorder) return;

            event.preventDefault();
            dragControls.start(event);
          }}
          className={`rounded-full p-2 transition ${
            canReorder
              ? "cursor-grab touch-none bg-white/10 text-white/60 active:cursor-grabbing hover:bg-white/20 hover:text-white"
              : "cursor-not-allowed bg-white/5 text-white/20"
          }`}
        >
          <GripVertical size={16} />
        </button>
      )}

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
    </>
  );

  const className = `flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition ${
    selected
      ? "border-cyan-400 bg-cyan-400/10"
      : "border-white/10 bg-white/5 hover:bg-white/10"
  }`;

  if (canReorder) {
    return (
      <Reorder.Item
        as="div"
        value={product}
        dragListener={false}
        dragControls={dragControls}
        className={className}
      >
        {rowContent}
      </Reorder.Item>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={className}
    >
      {rowContent}
    </motion.div>
  );
}

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
  const [reorderedProducts, setReorderedProducts] = useState(products);
  const showDragHandle = sortMode === "custom";
  const canReorder = showDragHandle && !searchTerm.trim();
  const visibleProducts = canReorder ? reorderedProducts : products;

  useEffect(() => {
    setReorderedProducts(products);
  }, [products]);

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
            className="max-h-[92vh] w-full max-w-xl flex flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1020]/90 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            {/* Header — never scrolls */}
            <div className="flex items-start justify-between gap-4 shrink-0">
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

            {/* Controls — never scroll */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row shrink-0">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4">
                <Search size={16} className="opacity-50" />
                <input
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search products"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/40"
                />
              </div>
              <select
                value={sortMode}
                onChange={(e) => onSortChange(e.target.value as ProductSortMode)}
                className="rounded-2xl border border-white/10 bg-[#10172a] px-4 py-3 text-sm outline-none"
              >
                <option value="popular">Most chosen</option>
                <option value="az">A-Z</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {showDragHandle && !canReorder && (
              <p className="mt-3 shrink-0 text-xs text-amber-200/80">
                Clear search to reorder products.
              </p>
            )}

            <div className="mt-4 flex gap-2 shrink-0">
              <input
                value={newProductName}
                onChange={(e) => onNewProductChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddProduct()}
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

            {/* FIX: products list is the only thing that scrolls, with a polished thin scrollbar */}
            {canReorder ? (
              <Reorder.Group
                as="div"
                axis="y"
                values={reorderedProducts}
                onReorder={setReorderedProducts}
                className="mt-8 flex-1 overflow-y-auto space-y-3 pr-1 modal-scrollbar"
              >
                {visibleProducts.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={shoppingList.includes(product.name)}
                    index={index}
                    showDragHandle={showDragHandle}
                    canReorder={canReorder}
                    onToggleItem={onToggleItem}
                    onEditProduct={onEditProduct}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <div className="mt-8 flex-1 overflow-y-auto space-y-3 pr-1 modal-scrollbar">
                {visibleProducts.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={shoppingList.includes(product.name)}
                    index={index}
                    showDragHandle={showDragHandle}
                    canReorder={canReorder}
                    onToggleItem={onToggleItem}
                    onEditProduct={onEditProduct}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
