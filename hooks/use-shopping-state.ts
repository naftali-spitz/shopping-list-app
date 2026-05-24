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
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

export function useShoppingState({
  categories,
  refreshCategories,
  setCategories,
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

  const allProducts = useMemo(
    () => categories.flatMap((category) => category.products),
    [categories]
  );

  const shoppingProducts = useMemo(
    () => allProducts.filter((product) => product.checked),
    [allProducts]
  );

  const shoppingList = useMemo(
    () => shoppingProducts.map((product) => product.name),
    [shoppingProducts]
  );

  const playSound = useCallback(() => {
    if (!soundOn || !tickAudio) return;

    void tickAudio.play().catch(() => undefined);
  }, [soundOn]);

  const optimisticToggle = useCallback(
    (productId: string, checked: boolean) => {
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  checked,
                }
              : product
          ),
        }))
      );
    },
    [setCategories]
  );

  const toggleItem = useCallback(
    async (item: string) => {
      const product = allProducts.find((p) => p.name === item);

      if (!product) return;

      playSound();

      optimisticToggle(product.id, !product.checked);

      const { error } = await updateProductChecked(
        product.id,
        !product.checked
      );

      if (error) {
        console.error("Failed to toggle product:", error);

        optimisticToggle(product.id, product.checked);

        await refreshCategories();
      }
    },
    [allProducts, optimisticToggle, playSound, refreshCategories]
  );

  const quickAddItem = useCallback(
    async (item: string) => {
      const product = allProducts.find((p) => p.name === item);

      if (!product || product.checked) {
        return;
      }

      playSound();

      optimisticToggle(product.id, true);

      const { error } = await updateProductChecked(product.id, true);

      if (error) {
        console.error("Failed to add product:", error);

        optimisticToggle(product.id, false);

        await refreshCategories();
      }
    },
    [allProducts, optimisticToggle, playSound, refreshCategories]
  );

  const setShoppingList = useCallback(
    async (items: string[]) => {
      const previousProducts = allProducts;

      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) => ({
            ...product,
            checked: items.includes(product.name),
          })),
        }))
      );

      const results = await Promise.all(
        allProducts.map((product) =>
          updateProductChecked(product.id, items.includes(product.name))
        )
      );

      const hasError = results.some((result) => result.error);

      if (hasError) {
        setCategories((prev) =>
          prev.map((category) => ({
            ...category,
            products: category.products.map((product) => {
              const previous = previousProducts.find(
                (p) => p.id === product.id
              );

              return previous
                ? {
                    ...product,
                    checked: previous.checked,
                  }
                : product;
            }),
          }))
        );

        await refreshCategories();
      }
    },
    [allProducts, refreshCategories, setCategories]
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

    setCategories((prev) =>
      prev.map((category) => ({
        ...category,
        products: category.products.map((product) => ({
          ...product,
          checked: false,
        })),
      }))
    );

    const results = await Promise.all(
      shoppingProducts.map((product) =>
        updateProductChecked(product.id, false)
      )
    );

    const hasError = results.some((result) => result.error);

    if (hasError) {
      await refreshCategories();
    }

    return true;
  }, [
    refreshCategories,
    setCategories,
    shoppingList,
    shoppingProducts,
  ]);

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
