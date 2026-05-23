import { useCallback, useEffect, useState } from "react";

import { exportShoppingDoc } from "@/lib/export-doc";
import {
  loadHistory,
  loadShoppingList,
  saveHistory,
  saveShoppingList,
} from "@/lib/storage";
import { HistoryEntry } from "@/types/shopping";

const tickAudio =
  typeof Audio !== "undefined"
    ? new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      )
    : null;

export function useShoppingState() {
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);

      const savedList = loadShoppingList();
      const savedHistory = loadHistory();

      if (savedList) {
        setShoppingList(savedList);
      }

      if (savedHistory) {
        setHistory(savedHistory);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    saveShoppingList(shoppingList);
  }, [shoppingList]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const playSound = useCallback(() => {
    if (!soundOn || !tickAudio) return;

    void tickAudio.play().catch(() => undefined);
  }, [soundOn]);

  const toggleItem = useCallback(
    (item: string) => {
      playSound();

      setShoppingList((prev) =>
        prev.includes(item)
          ? prev.filter((i) => i !== item)
          : [...prev, item]
      );
    },
    [playSound]
  );

  const quickAddItem = useCallback(
    (item: string) => {
      setShoppingList((prev) => {
        if (prev.includes(item)) {
          return prev;
        }

        playSound();
        return [...prev, item];
      });
    },
    [playSound]
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

    setShoppingList([]);

    return true;
  }, [shoppingList]);

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
