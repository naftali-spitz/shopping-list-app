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
  const masterGain = context.createGain();
  const delay = context.createDelay();
  const feedback = context.createGain();
  const echoGain = context.createGain();
  const highPass = context.createBiquadFilter();

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(420, now);

  delay.delayTime.setValueAtTime(0.045, now);
  feedback.gain.setValueAtTime(0.22, now);
  echoGain.gain.setValueAtTime(0.18, now);

  masterGain.connect(highPass);
  highPass.connect(context.destination);
  masterGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(echoGain);
  echoGain.connect(highPass);

  const voices: Array<{
    type: OscillatorType;
    startFrequency: number;
    endFrequency: number;
    startOffset: number;
    duration: number;
    gain: number;
  }> = [
    {
      type: "triangle",
      startFrequency: 620,
      endFrequency: 1480,
      startOffset: 0,
      duration: 0.09,
      gain: 0.75,
    },
    {
      type: "sine",
      startFrequency: 1540,
      endFrequency: 2360,
      startOffset: 0.018,
      duration: 0.075,
      gain: 0.45,
    },
  ];

  voices.forEach((voice) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    const start = now + voice.startOffset;
    const end = start + voice.duration;

    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      voice.endFrequency,
      end
    );

    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.exponentialRampToValueAtTime(voice.gain, start + 0.01);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(voiceGain);
    voiceGain.connect(masterGain);

    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}

type UseShoppingStateProps = {
  categories: Category[];
  refreshCategories: () => Promise<void>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
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
            items: historyItemsToLabels(entry.items),
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
            checked: product.checked || items.includes(product.name),
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
            const previous = previousProducts.find((p) => p.id === product.id);

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

    await refreshCategories();

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
