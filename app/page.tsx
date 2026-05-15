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
    <main dir="rtl" className={`relative min-h-screen overflow-hidden pb-40 transition-all duration-500 ${backgroundClass}`}>
      <AnimatedBackground />
    </main>
  );
}
