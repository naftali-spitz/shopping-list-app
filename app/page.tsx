"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { AuthButton } from "@/components/auth-button";
import { CategoryCard } from "@/components/category-card";
import { CategoryModal } from "@/components/category-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { EditCategoryModal } from "@/components/edit-category-modal";
import { HistoryModal } from "@/components/history-modal";
import { LoadingScreen } from "@/components/loading-screen";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { isAllowedEmail } from "@/lib/auth/whitelist";
import { updateCategory } from "@/lib/db/categories";
import { exportShoppingDoc } from "@/lib/export-doc";
import {
  loadHistory,
  loadShoppingList,
  saveHistory,
  saveShoppingList,
} from "@/lib/storage";
import { Category, HistoryEntry } from "@/types/shopping";

const initialCategories: Category[] = [];

const makeId = (value: string) =>
  `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editingCategoryName, setEditingCategoryName] = useState("");
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

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 1200);

    const savedList = loadShoppingList();
    const savedHistory = loadHistory();

    if (savedList) setShoppingList(savedList);
    if (savedHistory) setHistory(savedHistory);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => saveShoppingList(shoppingList), [shoppingList]);
  useEffect(() => saveHistory(history), [history]);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const editingCategory =
    categories.find((category) => category.id === editingCategoryId) ?? null;

  const globalResults = useMemo(() => {
    if (!globalSearch.trim()) return [];

    return categories
      .flatMap((category) =>
        category.products.map((product) => ({
          ...product,
          categoryName: category.name,
        }))
      )
      .filter((product) =>
        product.name.toLowerCase().includes(globalSearch.toLowerCase())
      )
      .slice(0, 8);
  }, [categories, globalSearch]);

  const backgroundClass = darkMode
    ? "bg-[#050816] text-white"
    : "bg-[#f3f7ff] text-slate-950";

  const cardClass = darkMode
    ? "border-white/10 bg-white/5"
    : "border-slate-950/10 bg-white/70 text-slate-950";

  const sortedProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return [...selectedCategory.products]
      .filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) =>
        sortMode === "az"
          ? a.name.localeCompare(b.name)
          : b.usageCount - a.usageCount
      );
  }, [searchTerm, selectedCategory, sortMode]);

  const confirmTitle =
    pendingDelete?.type === "category" ? "מחיקת קטגוריה?" : "מחיקת מוצר?";

  const confirmDescription =
    pendingDelete?.type === "category"
      ? `הקטגוריה "${pendingDelete.name}" תימחק יחד עם ${pendingDelete.productCount} מוצרים. הפעולה לא ניתנת לביטול.`
      : pendingDelete?.type === "product"
        ? `המוצר "${pendingDelete.name}" יימחק מהרשימה. הפעולה לא ניתנת לביטול.`
        : "";

  const playSound = () => {
    if (!soundOn) return;

    const audio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    );

    void audio.play().catch(() => undefined);
  };

  const toggleItem = (item: string) => {
    playSound();

    setShoppingList((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const quickAddItem = (item: string) => {
    if (shoppingList.includes(item)) return;

    playSound();

    setShoppingList((prev) => [...prev, item]);
    setGlobalSearch("");
  };

  const addCategory = () => {
    const name = newCategoryName.trim();

    if (!name) return;

    setCategories((prev) => [
      ...prev,
      {
        id: makeId(name),
        name,
        icon: "general",
        products: [],
      },
    ]);

    setNewCategoryName("");
  };

  const addProduct = () => {
    const name = newProductName.trim();

    if (!name || !selectedCategory) return;

    setCategories((prev) =>
      prev.map((category) =>
        category.id === selectedCategory.id
          ? {
              ...category,
              products: [
                ...category.products,
                {
                  id: makeId(name),
                  name,
                  usageCount: 0,
                },
              ],
            }
          : category
      )
    );

    setNewProductName("");
  };

  const removeProduct = (productId: string) => {
    if (!selectedCategory) return;

    const product = selectedCategory.products.find((item) => item.id === productId);

    if (!product) return;

    setPendingDelete({
      type: "product",
      id: productId,
      name: product.name,
    });
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    const { error } = await updateCategory(editingCategoryId, {
      name: editingCategoryName,
    });

    if (error) {
      return;
    }

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

  const confirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === "product") {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === selectedCategoryId
            ? {
                ...category,
                products: category.products.filter(
                  (product) => product.id !== pendingDelete.id
                ),
              }
            : category
        )
      );
    }

    if (pendingDelete.type === "category") {
      setCategories((prev) =>
        prev.filter((category) => category.id !== pendingDelete.id)
      );

      if (selectedCategoryId === pendingDelete.id) {
        setSelectedCategoryId(null);
      }

      setEditingCategoryId(null);
      setEditingCategoryName("");
    }

    setPendingDelete(null);
  };

  const exportDoc = () => {
    const createdAt = exportShoppingDoc(shoppingList);

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

  const email = session.user.email;

  if (!isAllowedEmail(email)) {
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
          onToggleSound={() => setSoundOn((value) => !value)}
          onToggleTheme={() => setDarkMode((value) => !value)}
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
                onChange={(event) => setGlobalSearch(event.target.value)}
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
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addCategory()}
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
        onRemoveProduct={removeProduct}
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
