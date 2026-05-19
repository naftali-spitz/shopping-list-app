"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { isAllowedEmail } from "@/lib/auth/whitelist";
import { HOUSEHOLD_ID } from "@/lib/constants";
import {
  createCategory,
  deleteCategory as deleteCategoryFromDb,
  updateCategory,
} from "@/lib/db/categories";
import {
  createProduct,
  deleteProduct as deleteProductFromDb,
  updateProduct,
} from "@/lib/db/products";
import { exportShoppingDoc } from "@/lib/export-doc";
import {
  loadHistory,
  loadShoppingList,
  saveHistory,
  saveShoppingList,
} from "@/lib/storage";
import { Category, HistoryEntry } from "@/types/shopping";

const initialCategories: Category[] = [];

const tickAudio =
  typeof Audio !== "undefined"
    ? new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      )
    : null;

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

  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductCategoryId, setEditingProductCategoryId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "popular">("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Scroll lock whenever any modal is open
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
      const savedList = loadShoppingList();
      const savedHistory = loadHistory();
      if (savedList) setShoppingList(savedList);
      if (savedHistory) setHistory(savedHistory);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    saveShoppingList(shoppingList);
  }, [shoppingList]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const editingCategory = useMemo(
    () => categories.find((c) => c.id === editingCategoryId) ?? null,
    [categories, editingCategoryId]
  );

  const editingProduct = useMemo(() => {
    if (!selectedCategory || !editingProductId) return null;

    return selectedCategory.products.find((p) => p.id === editingProductId) ?? null;
  }, [selectedCategory, editingProductId]);

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
        confirmDescription: `הקטגוריה "${pendingDelete.name}" תימחק יחד עם ${pendingDelete.productCount} מוצרים. הפעולה לא ניתנת לביטול.`,
      };
    }

    return {
      confirmTitle: "מחיקת מוצר?",
      confirmDescription: `המוצר "${pendingDelete.name}" יימחק מהרשימה. הפעולה לא ניתנת לביטול.`,
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

  const playSound = () => {
    if (!soundOn || !tickAudio) return;

    void tickAudio.play().catch(() => undefined);
  };

  const toggleItem = (item: string) => {
    playSound();

    setShoppingList((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  const quickAddItem = (item: string) => {
    if (shoppingList.includes(item)) return;

    playSound();
    setShoppingList((prev) => [...prev, item]);
    setGlobalSearch("");
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();

    if (!name) return;

    setNewCategoryName("");

    const { error } = await createCategory(HOUSEHOLD_ID, {
      name,
      icon: "general",
    });

    if (error) {
      console.error("Failed to create category:", error);
      return;
    }

    await refreshCategories();
  };

  const addProduct = async () => {
    const name = newProductName.trim();

    if (!name || !selectedCategory) return;

    setNewProductName("");

    const { error } = await createProduct(selectedCategory.id, name);

    if (error) {
      console.error("Failed to create product:", error);
      return;
    }

    await refreshCategories();
  };

  const saveProductEdit = async () => {
    if (!editingProductId || !editingProductCategoryId) return;

    const trimmedName = editingProductName.trim();

    if (!trimmedName) return;

    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductCategoryId(null);

    const { error } = await updateProduct(
      editingProductId,
      trimmedName,
      editingProductCategoryId
    );

    if (error) {
      console.error("Failed to update product:", error);
    }

    await refreshCategories();
  };

  const deleteProduct = () => {
    if (!editingProduct) return;

    setPendingDelete({
      type: "product",
      id: editingProduct.id,
      name: editingProduct.name,
    });
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    const { error } = await updateCategory(editingCategoryId, {
      name: editingCategoryName,
    });

    if (error) return;

    await refreshCategories();
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const deleteCategory = () => {
    if (!editingCategory) return;

    setPendingDelete({
      type: "category",
      id: editingCategory.id,
      name: editingCategory.name,
      productCount: editingCategory.products.length,
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === "product") {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedCategoryId
            ? {
                ...c,
                products: c.products.filter((p) => p.id !== pendingDelete.id),
              }
            : c
        )
      );

      setEditingProductId(null);
      setEditingProductName("");
      setEditingProductCategoryId(null);
      setPendingDelete(null);

      const { error } = await deleteProductFromDb(pendingDelete.id);

      if (error) {
        console.error("Failed to delete product:", error);
        await refreshCategories();
      }

      return;
    }

    if (pendingDelete.type === "category") {
      setCategories((prev) =>
        prev.filter((c) => c.id !== pendingDelete.id)
      );

      if (selectedCategoryId === pendingDelete.id) {
        setSelectedCategoryId(null);
      }

      setEditingCategoryId(null);
      setEditingCategoryName("");
      setPendingDelete(null);

      const { error } = await deleteCategoryFromDb(pendingDelete.id);

      if (error) {
        console.error("Failed to delete category:", error);
        await refreshCategories();
      }
    }
  };

  const exportDoc = async () => {
    const createdAt = await exportShoppingDoc(shoppingList);

    if (!createdAt) return;

    setHistory((prev) => [
      {
        id: createdAt,
        createdAt,
        items: shoppingList,
      },
      ...prev,
    ]);

    setShoppingList([]);
  };

  const handleEditProduct = useCallback(
    (productId: string) => {
      const product = selectedCategory?.products.find(
        (p) => p.id === productId
      );

      if (!product) return;

      setEditingProductId(product.id);
      setEditingProductName(product.name);
      setEditingProductCategoryId(product.category_id);
    },
    [selectedCategory]
  );

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
                    onClick={() => quickAddItem(product.name)}
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
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="הוסף קטגוריה"
                className="w-40 bg-transparent px-3 text-sm outline-none placeholder:opacity-50"
              />

              <button
                onClick={addCategory}
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
        onAddProduct={addProduct}
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
