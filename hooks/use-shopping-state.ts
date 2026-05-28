import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addProductsToShoppingList,
  exportShoppingList,
  fetchHistory,
} from "@/lib/db/history";
import { HOUSEHOLD_ID } from "@/lib/constants";
import {
  updateProductChecked,
  updateProductQuantity,
} from "@/lib/db/products";
import { exportShoppingDoc } from "@/lib/export-doc";
import { saveHistory } from "@/lib/storage";
import { Category, HistoryEntry } from "@/types/shopping";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  audioContext ??= new AudioContextConstructor();

  return audioContext;
}

async function playTickSound() {
  const context = getAudioContext();

  if (!context) return;

  if (context.state === "suspended") {
    await context.resume();
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.04);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

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
    const loadInitialData = async () => {
      const { data } = await fetchHistory(HOUSEHOLD_ID);

      if (data) {
        setHistory(
          data.map((entry: any) => ({
            id: entry.id,
            createdAt: entry.exported_at,
            items: Array.isArray(entry.items)
              ? entry.items.map((item: any) => {
                  if (typeof item === "string") {
                    return item;
                  }

                  const quantity = Number(item.quantity || 1);

                  return quantity > 1
                    ? `${item.name} ×${quantity}`
                    : item.name;
                })
              : [],
          }))
        );
      }

      setIsLoading(false);
    };

    void loadInitialData();
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
    if (!soundOn) return;

    void playTickSound().catch(() => undefined);
  }, [soundOn]);

  const previewSound = useCallback(() => {
    void playTickSound().catch(() => undefined);
  }, []);

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

  const optimisticQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  quantity,
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

  const removeProductFromShoppingList = useCallback(
    async (productId: string) => {
      const product = allProducts.find((p) => p.id === productId);

      if (!product || !product.checked) return;

      playSound();
      optimisticToggle(product.id, false);

      const { error } = await updateProductChecked(product.id, false);

      if (error) {
        console.error("Failed to remove product from shopping list:", error);
        optimisticToggle(product.id, true);
        await refreshCategories();
      }
    },
    [allProducts, optimisticToggle, playSound, refreshCategories]
  );

  const setProductQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const product = allProducts.find((p) => p.id === productId);

      if (!product) return;

      const nextQuantity = Math.max(1, quantity);

      if (nextQuantity === product.quantity) return;

      playSound();
      optimisticQuantity(product.id, nextQuantity);

      const { error } = await updateProductQuantity(product.id, nextQuantity);

      if (error) {
        console.error("Failed to update product quantity:", error);
        optimisticQuantity(product.id, product.quantity);
        await refreshCategories();
      }
    },
    [allProducts, optimisticQuantity, playSound, refreshCategories]
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

      playSound();

      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          products: category.products.map((product) => ({
            ...product,
            checked:
              product.checked || items.includes(product.name),
          })),
        }))
      );

      const { error } = await addProductsToShoppingList(items);

      if (error) {
        console.error("Failed to restore shopping list:", error);

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
    [allProducts, playSound, refreshCategories, setCategories]
  );

  const exportDoc = useCallback(async () => {
    const previousProducts = allProducts;

    setCategories((prev) =>
      prev.map((category) => ({
        ...category,
        products: category.products.map((product) => ({
          ...product,
          checked: false,
        })),
      }))
    );

    const { error } = await exportShoppingList();

    if (error) {
      console.error("Failed to export shopping list:", error);

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

      return false;
    }

    playSound();

    const createdAt = await exportShoppingDoc(shoppingProducts);

    if (createdAt) {
      setHistory((prev) => [
        {
          id: createdAt,
          createdAt,
          items: shoppingProducts.map((product) =>
            product.quantity > 1
              ? `${product.name} ×${product.quantity}`
              : product.name
          ),
        },
        ...prev,
      ]);
    }

    return true;
  }, [
    allProducts,
    playSound,
    refreshCategories,
    setCategories,
    shoppingProducts,
  ]);

  return {
    decreaseQuantity,
    exportDoc,
    history,
    increaseQuantity,
    isLoading,
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
