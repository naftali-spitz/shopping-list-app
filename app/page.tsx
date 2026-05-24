"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatedBackground } from "@/components/animated-background";
import { AuthButton } from "@/components/auth-button";
import { CategoriesSection } from "@/components/categories-section";
import { CategoryModal } from "@/components/category-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { EditCategoryModal } from "@/components/edit-category-modal";
import { EditProductModal } from "@/components/edit-product-modal";
import { GlobalSearchSection } from "@/components/global-search-section";
import { HistoryModal } from "@/components/history-modal";
import { LoadingScreen } from "@/components/loading-screen";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { useShoppingState } from "@/hooks/use-shopping-state";
import { isAllowedEmail } from "@/lib/auth/whitelist";
import { Category } from "@/types/shopping";

const initialCategories: Category[] = [];

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
  } = useShoppingState({
    categories,
    refreshCategories,
    setCategories,
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "popular">("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    addCategory,
    addProduct,
    confirmDelete,
    deleteCategory,
    deleteProduct,
    editingCategory,
    editingCategoryId,
    editingCategoryName,
    editingProduct,
    editingProductCategoryId,
    editingProductId,
    editingProductName,
    handleEditProduct,
    newCategoryName,
    newProductName,
    pendingDelete,
    saveCategoryEdit,
    saveProductEdit,
    setEditingCategoryId,
    setEditingCategoryName,
    setEditingProductCategoryId,
    setEditingProductId,
    setEditingProductName,
    setNewCategoryName,
    setNewProductName,
    setPendingDelete,
  } = useCategoryManagement({
    categories,
    selectedCategoryId,
    refreshCategories,
    setCategories,
    setSelectedCategoryId,
  });

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

        <GlobalSearchSection
          cardClass={cardClass}
          globalSearch={globalSearch}
          globalResults={globalResults}
          onGlobalSearchChange={setGlobalSearch}
          onQuickAdd={(item) => {
            void quickAddItem(item);
            setGlobalSearch("");
          }}
        />

        <CategoriesSection
          cardClass={cardClass}
          categories={categories}
          darkMode={darkMode}
          newCategoryName={newCategoryName}
          onAddCategory={() => void addCategory()}
          onCategoryNameChange={setNewCategoryName}
          onDeleteCategory={(categoryId, categoryName) => {
            setEditingCategoryId(categoryId);
            setEditingCategoryName(categoryName);
          }}
          onOpenCategory={(categoryId) => {
            setSelectedCategoryId(categoryId);
            setSearchTerm("");
          }}
        />
      </div>

      <ShoppingDrawer
        items={shoppingList}
        onRemove={(item) => void toggleItem(item)}
        onExport={() => void exportDoc()}
      />

      <CategoryModal
        category={selectedCategory}
        shoppingList={shoppingList}
        searchTerm={searchTerm}
        sortMode={sortMode}
        newProductName={newProductName}
        products={sortedProducts}
        onClose={() => setSelectedCategoryId(null)}
        onToggleItem={(item) => void toggleItem(item)}
        onSearchChange={setSearchTerm}
        onSortChange={setSortMode}
        onNewProductChange={setNewProductName}
        onAddProduct={() => void addProduct()}
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
        onSave={() => void saveCategoryEdit()}
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
        onSave={() => void saveProductEdit()}
        onDelete={deleteProduct}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <HistoryModal
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onLoad={(items) => {
          void setShoppingList(items);
          setHistoryOpen(false);
        }}
      />
    </main>
  );
}
