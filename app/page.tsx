"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { AuthButton } from "@/components/auth-button";
import { CategoryCard } from "@/components/category-card";
import { CategoryModal } from "@/components/category-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { EditCategoryModal } from "@/components/edit-category-modal";
import { EditProductModal } from "@/components/edit-product-modal";
import { HistoryModal } from "@/components/history-modal";
import { LoadingScreen } from "@/components/loading-screen";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useCategoryProductActions } from "@/hooks/use-category-product-actions";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { useShoppingState } from "@/hooks/use-shopping-state";
import { isAllowedEmail } from "@/lib/auth/whitelist";
import { Category } from "@/types/shopping";

const initialCategories: Category[] = [];

type PendingDelete =
  | { type: "category"; id: string; name: string; productCount: number }
  | { type: "product"; id: string; name: string };

export default function Home() {
  const { session, loading } = useSession();

  const {
    categories,
    setCategories,
    loading: categoriesLoading,
    refreshCategories,
  } = useSharedCategories(initialCategories);

  const {
    exportDoc,
    history,
    isLoading,
    quickAddItem,
    setShoppingList,
    shoppingList,
    soundOn,
    setSoundOn,
    toggleItem,
  } = useShoppingState();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductCategoryId, setEditingProductCategoryId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "popular">("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const anyModalOpen =
    Boolean(selectedCategoryId) ||
    Boolean(editingCategoryId) ||
    Boolean(editingProductId) ||
    Boolean(pendingDelete) ||
    historyOpen;

  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [anyModalOpen]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const globalResults = useMemo(() => {
    if (!globalSearch.trim()) return [];

    return categories
      .flatMap((c) => c.products.map((p) => ({ ...p, categoryName: c.name })))
      .filter((p) => p.name.toLowerCase().includes(globalSearch.toLowerCase()))
      .slice(0, 8);
  }, [categories, globalSearch]);

  const { confirmTitle, confirmDescription } = useMemo(() => {
    if (!pendingDelete) {
      return {
        confirmTitle: "",
        confirmDescription: "",
      };
    }

    if (pendingDelete.type === "category") {
      return {
        confirmTitle: "מחיקת קטגוריה?",
        confirmDescription: `הקטגוריה \"${pendingDelete.name}\" תימחק יחד עם ${pendingDelete.productCount} מוצרים. הפעולה לא ניתנת לביטול.`,
      };
    }

    return {
      confirmTitle: "מחיקת מוצר?",
      confirmDescription: `המוצר \"${pendingDelete.name}\" יימחק מהרשימה. הפעולה לא ניתנת לביטול.`,
    };
  }, [pendingDelete]);

  const backgroundClass = darkMode
    ? "bg-[#050816] text-white"
    : "bg-[#f3f7ff] text-slate-950";

  const cardClass = darkMode
    ? "border-white/10 bg-white/5"
    : "border-slate-950/10 bg-white/70 text-slate-950";

  const sortedProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return [...selectedCategory.products]
      .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) =>
        sortMode === "az"
          ? a.name.localeCompare(b.name)
          : b.usageCount - a.usageCount
      );
  }, [searchTerm, selectedCategory, sortMode]);

  const {
    addCategory,
    addProduct,
    confirmDelete,
    deleteCategory,
    deleteProduct,
    editingCategory,
    editingProduct,
    handleEditProduct,
    saveCategoryEdit,
    saveProductEdit,
  } = useCategoryProductActions({
    categories,
    selectedCategory,
    selectedCategoryId,
    editingCategoryId,
    editingCategoryName,
    editingProductId,
    editingProductName,
    editingProductCategoryId,
    pendingDelete,
    refreshCategories,
    setCategories,
    setEditingCategoryId,
    setEditingCategoryName,
    setEditingProductId,
    setEditingProductName,
    setEditingProductCategoryId,
    setPendingDelete,
    setSelectedCategoryId,
    setNewCategoryName,
    setNewProductName,
  });

  if (loading || isLoading || categoriesLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816]">
        <AuthButton />
      </main>
    );
  }

  if (!isAllowedEmail(session.user.email)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        Access denied
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className={`relative min-h-screen overflow-hidden pb-40 transition-all duration-500 ${backgroundClass}`}
    >
      <AnimatedBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <TopBar
          darkMode={darkMode}
          soundOn={soundOn}
          cardClass={cardClass}
          onToggleSound={() => setSoundOn((v) => !v)}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onExport={exportDoc}
          onOpenHistory={() => setHistoryOpen(true)}
        />

        <section className="mt-8">
          <div
            className={`relative rounded-3xl border p-4 backdrop-blur-xl ${cardClass}`}
          >
            <div className="flex items-center gap-3">
              <Search className="text-cyan-400" size={22} />

              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="חיפוש מהיר להוספה לרשימה..."
                className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
              />
            </div>

            {globalResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {globalResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      quickAddItem(product.name);
                      setGlobalSearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white/60 px-4 py-3 text-right transition hover:scale-[1.01] hover:bg-cyan-50 dark:border-white/10 dark:bg-white/5"
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm opacity-60">
                        {product.categoryName}
                      </div>
                    </div>

                    <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-600">
                      הוסף
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="text-cyan-300" />
              <h2 className="text-3xl font-bold">בחר קטגוריה</h2>
            </div>

            <div
              className={`flex gap-2 rounded-3xl border p-2 backdrop-blur-xl ${cardClass}`}
            >
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && addCategory(newCategoryName)
                }
                placeholder="הוסף קטגוריה"
                className="w-40 bg-transparent px-3 text-sm outline-none placeholder:opacity-50"
              />

              <button
                onClick={() => addCategory(newCategoryName)}
                className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-black"
              >
                הוסף
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={category}
                index={index}
                cardClass={cardClass}
                darkMode={darkMode}
                onOpen={() => {
                  setSelectedCategoryId(category.id);
                  setSearchTerm("");
                }}
                onDelete={() => {
                  setEditingCategoryId(category.id);
                  setEditingCategoryName(category.name);
                }}
              />
            ))}
          </div>
        </section>
      </div>

      <ShoppingDrawer
        items={shoppingList}
        onRemove={toggleItem}
        onExport={exportDoc}
      />

      <CategoryModal
        category={selectedCategory}
        shoppingList={shoppingList}
        searchTerm={searchTerm}
        sortMode={sortMode}
        newProductName={newProductName}
        products={sortedProducts}
        onClose={() => setSelectedCategoryId(null)}
        onToggleItem={toggleItem}
        onSearchChange={setSearchTerm}
        onSortChange={setSortMode}
        onNewProductChange={setNewProductName}
        onAddProduct={() => addProduct(newProductName)}
        onEditProduct={handleEditProduct}
      />

      <EditCategoryModal
        category={editingCategory}
        open={Boolean(editingCategory)}
        value={editingCategoryName}
        onClose={() => {
          setEditingCategoryId(null);
          setEditingCategoryName("");
        }}
        onChange={setEditingCategoryName}
        onSave={saveCategoryEdit}
        onDelete={deleteCategory}
      />

      <EditProductModal
        product={editingProduct}
        categories={categories}
        selectedCategoryId={editingProductCategoryId}
        open={Boolean(editingProductId)}
        value={editingProductName}
        onClose={() => {
          setEditingProductId(null);
          setEditingProductName("");
          setEditingProductCategoryId(null);
        }}
        onChange={setEditingProductName}
        onCategoryChange={setEditingProductCategoryId}
        onSave={saveProductEdit}
        onDelete={deleteProduct}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <HistoryModal
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onLoad={(items) => {
          setShoppingList(items);
          setHistoryOpen(false);
        }}
      />
    </main>
  );
}
