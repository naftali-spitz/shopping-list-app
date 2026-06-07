"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { Edit2, MoreVertical, Plus, Search, X } from "lucide-react";
import { AppSound } from "@/lib/app-sounds";
import { AppCopy, appCopy } from "@/lib/i18n";
import { Category, Product } from "@/types/shopping";

type ProductSortMode = "az" | "popular" | "custom";

type CategoryModalProps = {
  copy?: AppCopy;
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
  onCustomOrderChange: (products: Product[], movedProductId: string) => void;
  onPlaySound?: (sound?: AppSound) => void;
};

type ProductRowProps = {
  copy: AppCopy;
  product: Product;
  selected: boolean;
  index: number;
  showDragHandle: boolean;
  canReorder: boolean;
  onToggleItem: (item: string) => void;
  onEditProduct: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (pointerY: number) => void;
  onDragEnd: () => void;
  onPlaySound?: (sound?: AppSound) => void;
};

function ProductRow({
  copy,
  product,
  selected,
  index,
  showDragHandle,
  canReorder,
  onToggleItem,
  onEditProduct,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPlaySound,
}: ProductRowProps) {
  const dragControls = useDragControls();

  const rowContent = (
    <>
      {showDragHandle && (
        <button
          type="button"
          disabled={!canReorder}
          aria-label={copy.categoryModal.reorderProduct}
          title={canReorder ? copy.categoryModal.dragToReorder : copy.categoryModal.clearSearchToReorderTitle}
          onPointerDown={(event) => {
            if (!canReorder) return;
            onPlaySound?.("tap");
            dragControls.start(event);
          }}
          className={`p-1 transition ${
            canReorder
              ? "cursor-grab touch-none text-white/45 active:cursor-grabbing hover:text-white/80"
              : "cursor-not-allowed text-white/20"
          }`}
        >
          <MoreVertical size={18} strokeWidth={2.4} />
        </button>
      )}

      <button
        onClick={() => onToggleItem(product.name)}
        className="flex flex-1 items-center gap-3 text-start"
      >
        <div className={`h-4 w-4 rounded-full ${selected ? "bg-cyan-300" : "bg-white/20"}`} />
        <span className="min-w-0 truncate" dir="auto">{product.name}</span>
        <span className="ms-auto text-xs text-white/40">{product.usageCount}x</span>
      </button>

      <button
        onClick={() => {
          onPlaySound?.("open");
          onEditProduct(product.id);
        }}
        className="rounded-full bg-cyan-400/10 p-2 text-cyan-300"
        aria-label={copy.products.editProduct}
      >
        <Edit2 size={15} />
      </button>
    </>
  );

  const className = `flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition-colors ${
    selected ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
  }`;

  if (canReorder) {
    return (
      <Reorder.Item
        as="div"
        value={product.id}
        dragListener={false}
        dragControls={dragControls}
        onDragStart={() => onDragStart(product.id)}
        onDrag={(_, info) => onDragMove(info.point.y)}
        onDragEnd={onDragEnd}
        layout
        whileDrag={{ scale: 1.02, zIndex: 20 }}
        transition={{ layout: { type: "spring", stiffness: 500, damping: 38 } }}
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
  copy = appCopy.he,
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
  onCustomOrderChange,
  onPlaySound,
}: CategoryModalProps) {
  const [reorderedProducts, setReorderedProducts] = useState(products);
  const latestOrderRef = useRef(products);
  const movedProductIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const showDragHandle = sortMode === "custom";
  const canReorder = showDragHandle && !searchTerm.trim();
  const visibleProducts = canReorder ? reorderedProducts : products;

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
    }
    autoScrollFrameRef.current = null;
    dragPointerYRef.current = null;
  };

  const runAutoScroll = () => {
    const container = scrollContainerRef.current;
    const pointerY = dragPointerYRef.current;
    if (!container || pointerY === null || typeof window === "undefined") {
      autoScrollFrameRef.current = null;
      return;
    }

    const rect = container.getBoundingClientRect();
    const edgeSize = 88;
    const maxSpeed = 16;
    let scrollDelta = 0;

    if (pointerY < rect.top + edgeSize) {
      const intensity = Math.min(1, Math.max(0, (rect.top + edgeSize - pointerY) / edgeSize));
      scrollDelta = -Math.ceil(intensity * maxSpeed);
    } else if (pointerY > rect.bottom - edgeSize) {
      const intensity = Math.min(1, Math.max(0, (pointerY - (rect.bottom - edgeSize)) / edgeSize));
      scrollDelta = Math.ceil(intensity * maxSpeed);
    }

    if (scrollDelta !== 0) container.scrollTop += scrollDelta;
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
  };

  const handleDragMove = (pointerY: number) => {
    dragPointerYRef.current = pointerY;
    if (autoScrollFrameRef.current === null && typeof window !== "undefined") {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
    }
  };

  useEffect(() => {
    setReorderedProducts(products);
    latestOrderRef.current = products;
  }, [products]);

  useEffect(() => stopAutoScroll, []);

  const handleReorder = (nextProductIds: string[]) => {
    const productsById = new Map(latestOrderRef.current.map((product) => [product.id, product]));
    const nextProducts = nextProductIds.flatMap((id) => {
      const product = productsById.get(id);
      return product ? [product] : [];
    });
    latestOrderRef.current = nextProducts;
    setReorderedProducts(nextProducts);
  };

  const handleDragEnd = () => {
    stopAutoScroll();
    const movedProductId = movedProductIdRef.current;
    if (!movedProductId) return;
    movedProductIdRef.current = null;
    onPlaySound?.("success");
    onCustomOrderChange(latestOrderRef.current, movedProductId);
  };

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
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1020]/90 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8"
          >
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-bold" dir="auto">{category.name}</h2>
                <p className="mt-2 text-sm text-white/60">{copy.categoryModal.description}</p>
              </div>
              <button onClick={() => { onPlaySound?.("tap"); onClose(); }} className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20" aria-label={copy.common.close}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4">
                <Search size={16} className="opacity-50" />
                <input
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={copy.categoryModal.searchPlaceholder}
                  dir="auto"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/40"
                />
              </div>
              <select
                value={sortMode}
                onChange={(e) => { onPlaySound?.("toggle"); onSortChange(e.target.value as ProductSortMode); }}
                className="rounded-2xl border border-white/10 bg-[#10172a] px-4 py-3 text-sm outline-none"
              >
                <option value="popular">{copy.categoryModal.sortPopular}</option>
                <option value="az">{copy.categoryModal.sortAz}</option>
                <option value="custom">{copy.categoryModal.sortCustom}</option>
              </select>
            </div>

            {showDragHandle && !canReorder && (
              <p className="mt-3 shrink-0 text-xs text-amber-200/80">{copy.categoryModal.clearSearchToReorder}</p>
            )}

            <div className="mt-4 flex shrink-0 gap-2">
              <input
                value={newProductName}
                onChange={(e) => onNewProductChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddProduct()}
                placeholder={copy.categoryModal.addProductPlaceholder}
                dir="auto"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/40"
              />
              <button onClick={() => { onPlaySound?.("add"); onAddProduct(); }} className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black" aria-label={copy.common.add}>
                <Plus size={18} />
              </button>
            </div>

            {canReorder ? (
              <Reorder.Group
                ref={scrollContainerRef}
                as="div"
                axis="y"
                values={reorderedProducts.map((product) => product.id)}
                onReorder={handleReorder}
                className="modal-scrollbar mt-8 flex flex-1 flex-col gap-3 overflow-y-auto pr-1"
              >
                {visibleProducts.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    copy={copy}
                    product={product}
                    selected={shoppingList.includes(product.name)}
                    index={index}
                    showDragHandle={showDragHandle}
                    canReorder={canReorder}
                    onToggleItem={onToggleItem}
                    onEditProduct={onEditProduct}
                    onDragStart={(id) => { movedProductIdRef.current = id; }}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onPlaySound={onPlaySound}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <div className="modal-scrollbar mt-8 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {visibleProducts.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    copy={copy}
                    product={product}
                    selected={shoppingList.includes(product.name)}
                    index={index}
                    showDragHandle={showDragHandle}
                    canReorder={canReorder}
                    onToggleItem={onToggleItem}
                    onEditProduct={onEditProduct}
                    onDragStart={() => undefined}
                    onDragMove={() => undefined}
                    onDragEnd={() => undefined}
                    onPlaySound={onPlaySound}
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
