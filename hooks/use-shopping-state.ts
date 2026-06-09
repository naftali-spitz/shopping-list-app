import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildShoppingExportCategories } from "@/hooks/use-shopping-export-doc";
import { AppSound, playAppSound } from "@/lib/app-sounds";
import {
  addProductsToShoppingList,
  deleteShoppingHistoryEntry,
  exportShoppingList,
  fetchHistory,
} from "@/lib/db/history";
import {
  updateProductChecked,
  updateProductQuantity,
} from "@/lib/db/products";
import { exportShoppingDoc } from "@/lib/export-doc";
import { saveHistory } from "@/lib/storage";
import { Category, HistoryEntry } from "@/types/shopping";

const SOUND_STORAGE_KEY = "futurecart.soundOn";

type CheckedOverrides = Record<string, boolean>;

function getInitialSoundOn() {
  if (typeof window === "undefined") return true;

  const savedValue = window.localStorage.getItem(SOUND_STORAGE_KEY);

  if (savedValue === null) return true;

  return savedValue === "true";
}

type UseShoppingStateProps = {
  categories: Category[];
  householdId: string | null;
  refreshCategories: () => Promise<void>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  onError?: (message: string) => void;
};

function historyItemsToLabels(items: unknown): string[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item: any) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item.name !== "string") return [];

    const quantity = Number(item.quantity || 1);

    return [quantity > 1 ? `${item.name} ×${quantity}` : item.name];
  });
}

function historyRowsToEntries(data: any[]): HistoryEntry[] {
  return data.map((entry: any) => ({
    id: entry.id,
    createdAt: entry.exported_at,
    items: historyItemsToLabels(entry.items),
  }));
}

function applyCheckedOverrides(categories: Category[], overrides: CheckedOverrides): Category[] {
  if (!Object.keys(overrides).length) return categories;

  return categories.map((category) => ({
    ...category,
    products: category.products.map((product) =>
      Object.prototype.hasOwnProperty.call(overrides, product.id)
        ? { ...product, checked: overrides[product.id] }
        : product
    ),
  }));
}

export function useShoppingState({
  categories,
  householdId,
  refreshCategories,
  setCategories,
  onError,
}: UseShoppingStateProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [soundOn, setSoundOn] = useState(getInitialSoundOn);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedHistoryHouseholdId, setLoadedHistoryHouseholdId] = useState<string | null>(null);
  const [checkedOverrides, setCheckedOverrides] = useState<CheckedOverrides>({});
  const pendingCheckedUpdatesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundOn));
  }, [soundOn]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!householdId) {
        setHistory([]);
        setLoadedHistoryHouseholdId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await fetchHistory(householdId);

      if (error) {
        console.error("Failed to load shopping history:", error);
        onError?.("טעינת היסטוריית הקניות נכשלה. נסה לרענן את הדף.");
      }

      if (data) setHistory(historyRowsToEntries(data));

      setLoadedHistoryHouseholdId(householdId);
      setIsLoading(false);
    };

    void loadInitialData();
  }, [householdId, onError]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    setCheckedOverrides((prev) => {
      const entries = Object.entries(prev);
      if (!entries.length) return prev;

      let next = prev;

      entries.forEach(([productId, expectedChecked]) => {
        const product = categories
          .flatMap((category) => category.products)
          .find((item) => item.id === productId);

        if (!product || product.checked === expectedChecked) {
          if (next === prev) next = { ...prev };
          delete next[productId];
        }
      });

      return next;
    });
  }, [categories]);

  const categoriesWithCheckedOverrides = useMemo(
    () => applyCheckedOverrides(categories, checkedOverrides),
    [categories, checkedOverrides]
  );

  const allProducts = useMemo(
    () => categoriesWithCheckedOverrides.flatMap((category) => category.products),
    [categoriesWithCheckedOverrides]
  );

  const shoppingProducts = useMemo(
    () => allProducts.filter((product) => product.checked),
    [allProducts]
  );

  const shoppingExportCategories = useMemo(
    () => buildShoppingExportCategories(categoriesWithCheckedOverrides),
    [categoriesWithCheckedOverrides]
  );

  const shoppingList = useMemo(
    () => shoppingProducts.map((product) => product.name),
    [shoppingProducts]
  );

  const playSound = useCallback(
    (sound: AppSound = "tap") => {
      if (!soundOn) return;
      void playAppSound(sound).catch(() => undefined);
    },
    [soundOn]
  );

  const previewSound = useCallback(() => {
    void playAppSound("success").catch(() => undefined);
  }, []);

  const optimisticQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) =>
            product.id === productId ? { ...product, quantity } : product
          ),
        }))
      );
    },
    [setCategories]
  );

  const setCheckedOverride = useCallback((productId: string, checked: boolean) => {
    setCheckedOverrides((prev) => ({ ...prev, [productId]: checked }));
  }, []);

  const clearCheckedOverride = useCallback((productId: string) => {
    setCheckedOverrides((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, productId)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const updateCheckedWithPendingGuard = useCallback(
    async (productId: string, nextChecked: boolean, previousChecked: boolean) => {
      if (pendingCheckedUpdatesRef.current.has(productId)) return false;

      pendingCheckedUpdatesRef.current.add(productId);
      setCheckedOverride(productId, nextChecked);

      const { error } = await updateProductChecked(productId, nextChecked);

      pendingCheckedUpdatesRef.current.delete(productId);

      if (error) {
        console.error("Failed to update product checked state:", error);
        onError?.("עדכון המוצר ברשימת הקניות נכשל.");
        setCheckedOverride(productId, previousChecked);
        window.setTimeout(() => clearCheckedOverride(productId), 400);
        await refreshCategories();
        return false;
      }

      void refreshCategories();
      return true;
    },
    [clearCheckedOverride, onError, refreshCategories, setCheckedOverride]
  );

  const toggleItem = useCallback(
    async (item: string) => {
      const product = allProducts.find((p) => p.name === item);
      if (!product) return;
      if (pendingCheckedUpdatesRef.current.has(product.id)) return;

      const nextChecked = !product.checked;
      playSound(nextChecked ? "add" : "remove");
      await updateCheckedWithPendingGuard(product.id, nextChecked, product.checked);
    },
    [allProducts, playSound, updateCheckedWithPendingGuard]
  );

  const removeProductFromShoppingList = useCallback(
    async (productId: string) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product || !product.checked) return;
      if (pendingCheckedUpdatesRef.current.has(product.id)) return;

      playSound("remove");
      await updateCheckedWithPendingGuard(product.id, false, true);
    },
    [allProducts, playSound, updateCheckedWithPendingGuard]
  );

  const setProductQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return;

      const nextQuantity = Math.max(1, quantity);
      if (nextQuantity === product.quantity) return;

      playSound("quantity");
      optimisticQuantity(product.id, nextQuantity);

      const { error } = await updateProductQuantity(product.id, nextQuantity);

      if (error) {
        console.error("Failed to update product quantity:", error);
        onError?.("עדכון הכמות נכשל.");
        optimisticQuantity(product.id, product.quantity);
        await refreshCategories();
      }
    },
    [allProducts, onError, optimisticQuantity, playSound, refreshCategories]
  );

  const increaseQuantity = useCallback(
    (productId: string) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return;
      void setProductQuantity(product.id, product.quantity + 1);
    },
    [allProducts, setProductQuantity]
  );

  const decreaseQuantity = useCallback(
    (productId: string) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product || product.quantity <= 1) return;
      void setProductQuantity(product.id, product.quantity - 1);
    },
    [allProducts, setProductQuantity]
  );

  const quickAddItem = useCallback(
    async (item: string) => {
      const product = allProducts.find((p) => p.name === item);
      if (!product || product.checked) return;
      if (pendingCheckedUpdatesRef.current.has(product.id)) return;

      playSound("add");
      await updateCheckedWithPendingGuard(product.id, true, false);
    },
    [allProducts, playSound, updateCheckedWithPendingGuard]
  );

  const setShoppingList = useCallback(
    async (items: string[]) => {
      if (!householdId) {
        onError?.("לא נמצא בית פעיל.");
        return false;
      }

      const previousProducts = allProducts;

      playSound("success");
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) => ({
            ...product,
            checked: product.checked || items.includes(product.name),
          })),
        }))
      );

      const { error } = await addProductsToShoppingList(householdId, items);

      if (error) {
        console.error("Failed to restore shopping list:", error);
        onError?.("שחזור הרשימה מההיסטוריה נכשל.");
        setCategories((prev) =>
          prev.map((category) => ({
            ...category,
            products: category.products.map((product) => {
              const previous = previousProducts.find((p) => p.id === product.id);
              return previous ? { ...product, checked: previous.checked } : product;
            }),
          }))
        );
        await refreshCategories();
      }
    },
    [allProducts, householdId, onError, playSound, refreshCategories, setCategories]
  );

  const deleteHistoryEntry = useCallback(
    async (historyId: string) => {
      if (!householdId) {
        onError?.("לא נמצא בית פעיל.");
        return false;
      }

      playSound("delete");
      const { error } = await deleteShoppingHistoryEntry(householdId, historyId);

      if (error) {
        console.error("Failed to delete history entry:", error);
        onError?.("מחיקת רשימת ההיסטוריה נכשלה.");
        return false;
      }

      setHistory((prev) => prev.filter((entry) => entry.id !== historyId));
      void refreshCategories();
      return true;
    },
    [householdId, onError, playSound, refreshCategories]
  );

  const exportDoc = useCallback(async () => {
    if (!householdId) {
      onError?.("לא נמצא בית פעיל.");
      return false;
    }

    const previousProducts = allProducts;

    setCategories((prev) =>
      prev.map((category) => ({
        ...category,
        products: category.products.map((product) => ({ ...product, checked: false })),
      }))
    );

    const { error } = await exportShoppingList(householdId);

    if (error) {
      console.error("Failed to export shopping list:", error);
      onError?.("ייצוא רשימת הקניות נכשל.");
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) => {
            const previous = previousProducts.find((p) => p.id === product.id);
            return previous ? { ...product, checked: previous.checked } : product;
          }),
        }))
      );
      await refreshCategories();
      return false;
    }

    playSound("success");

    try {
      await exportShoppingDoc(shoppingExportCategories);
    } catch (error) {
      console.error("Failed to generate shopping document:", error);
      onError?.("יצירת מסמך הקניות נכשלה.");
      await refreshCategories();
      return false;
    }

    const { data: freshHistory, error: historyError } = await fetchHistory(householdId);

    if (historyError) {
      console.error("Failed to reload shopping history after export:", historyError);
      onError?.("הרשימה יוצאה, אבל טעינת ההיסטוריה מחדש נכשלה. נסה לרענן את הדף.");
    }

    if (freshHistory) setHistory(historyRowsToEntries(freshHistory));

    await refreshCategories();
    return true;
  }, [
    allProducts,
    householdId,
    onError,
    playSound,
    refreshCategories,
    setCategories,
    shoppingExportCategories,
  ]);

  const activeHouseholdHistoryReady = !householdId || loadedHistoryHouseholdId === householdId;

  return {
    decreaseQuantity,
    deleteHistoryEntry,
    exportDoc,
    history,
    increaseQuantity,
    isLoading: isLoading || !activeHouseholdHistoryReady,
    playSound,
    previewSound,
    quickAddItem,
    removeProductFromShoppingList,
    setHistory,
    setShoppingList,
    shoppingList,
    shoppingProducts,
    soundOn,
    setSoundOn,
    toggleItem,
  };
}
