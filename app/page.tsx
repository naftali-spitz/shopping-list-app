"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { AuthButton } from "@/components/auth-button";
import { CategoryCard } from "@/components/category-card";
import { CategoryModal } from "@/components/category-modal";
import { EditCategoryModal } from "@/components/edit-category-modal";
import { HistoryModal } from "@/components/history-modal";
import { LoadingScreen } from "@/components/loading-screen";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { isAllowedEmail } from "@/lib/auth/whitelist";
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

export default function Home() {
  const { session, loading } = useSession();

  const {
    categories,
    setCategories,
    loading: categoriesLoading,
  } = useSharedCategories(initialCategories);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "popular">("popular");
  const [searchTerm, setSearchTerm] = useState("");
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

    const confirmed = window.confirm("Delete this product?");

    if (!confirmed) return;

    setCategories((prev) =>
      prev.map((category) =>
        category.id === selectedCategory.id
          ? {
              ...category,
              products: category.products.filter(
                (product) => product.id !== productId
              ),
            }
          : category
      )
    );
  };

  const saveCategoryEdit = () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    setCategories((prev) =>
      prev.map((category) =>
        category.id === editingCategoryId
          ? {
              ...category,
              name: editingCategoryName,
            }
          : category
      )
    );

    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const deleteCategory = () => {
    if (!editingCategoryId) return;

    const confirmed = window.confirm(
      "Delete this category and all products?"
    );

    if (!confirmed) return;

    setCategories((prev) =>
      prev.filter((category) => category.id !== editingCategoryId)
    );

    setEditingCategoryId(null);
    setEditingCategoryName("");
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
