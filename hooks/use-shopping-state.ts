import { useCallback, useEffect, useMemo, useState } from "react";

import { updateProductChecked } from "@/lib/db/products";
import { exportShoppingDoc } from "@/lib/export-doc";
import { loadHistory, saveHistory } from "@/lib/storage";
import { Category, HistoryEntry } from "@/types/shopping";

const tickAudio =
  typeof Audio !== "undefined"
    ? new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      )
    : null;

type UseShoppingStateProps = {
  categories: Category[];
  refreshCategories: () => Promise<void>;
};

export function useShoppingState({
  categories,
  refreshCategories,
}: UseShoppingStateProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);

      const savedHistory = loadHistory();

      if (savedHistory) {
        setHistory(savedHistory);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const shoppingProducts = useMemo(
    () =>
      categories.flatMap((category) =>
        category.products.filter((product) => product.checked)
      ),
    [categories]
  );

  const shoppingList = useMemo(
    () => shoppingProducts.map((product) => product.name),
    [shoppingProducts]
  );

  const playSound = useCallback(() => {
    if (!soundOn || !tickAudio) return;

    void tickAudio.play().catch(() => undefined);
  }, [soundOn]);

  const toggleItem = useCallback(
    async (item: string) => {
      const product = shoppingProducts.find((p) => p.name === item);

      if (!product) return;

      playSound();

      const { error } = await updateProductChecked(
        product.id,
        !product.checked
      );

      if (error) {
        console.error("Failed to toggle product:", error);
        return;
      }

      await refreshCategories();
    },
    [playSound, refreshCategories, shoppingProducts]
  );

  const quickAddItem = useCallback(
    async (item: string) => {
      const product = categories
        .flatMap((category) => category.products)
        .find((p) => p.name === item);

      if (!product || product.checked) {
        return;
      }

      playSound();

      const { error } = await updateProductChecked(product.id, true);

      if (error) {
        console.error("Failed to add product:", error);
        return;
      }

      await refreshCategories();
    },
    [categories, playSound, refreshCategories]
  );

  const setShoppingList = useCallback(
    async (items: string[]) => {
      const allProducts = categories.flatMap((category) => category.products);

      await Promise.all(
        allProducts.map((product) =>
          updateProductChecked(product.id, items.includes(product.name))
        )
      );

      await refreshCategories();
    },
    [categories, refreshCategories]
  );

  const exportDoc = useCallback(async () => {
    const createdAt = await exportShoppingDoc(shoppingList);

    if (!createdAt) {
      return false;
    }

    setHistory((prev) => [
      {
        id: createdAt,
        createdAt,
        items: shoppingList,
      },
      ...prev,
    ]);

    await Promise.all(
      shoppingProducts.map((product) =>
        updateProductChecked(product.id, false)
      )
    );

    await refreshCategories();

    return true;
  }, [refreshCategories, shoppingList, shoppingProducts]);

  return {
    exportDoc,
    history,
    isLoading,
    quickAddItem,
    setHistory,
    setShoppingList,
    shoppingList,
    soundOn,
    setSoundOn,
    toggleItem,
  };
}
