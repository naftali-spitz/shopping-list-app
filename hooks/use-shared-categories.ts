"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCategories } from "@/lib/db/categories";
import { subscribeToProducts } from "@/lib/realtime/products-channel";
import { Category } from "@/types/shopping";

export function useSharedCategories(initialCategories: Category[], householdId: string | null, onError?: (message: string) => void) {
  const lastError = useRef<string | null>(null);
  const activeHousehold = useRef(householdId);
  activeHousehold.current = householdId;
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(true);
  const [loadedHouseholdId, setLoadedHouseholdId] = useState<string | null>(null);

  const refreshCategories = useCallback(async () => {
    try {
      if (!householdId) {
        setCategories(initialCategories);
        setLoadedHouseholdId(null);
        setLoading(false);
        return;
      }

      const data = await fetchCategories(householdId);
      if (activeHousehold.current !== householdId) return;

      lastError.current = null;
      setCategories(data);
      setLoadedHouseholdId(householdId);
    } catch {
      if (activeHousehold.current !== householdId) return;
      setCategories([]);
      setLoadedHouseholdId(householdId);
      if (lastError.current !== householdId) {
        lastError.current = householdId;
        onError?.("Could not load this list. Your session or membership may have changed.");
      }
    } finally {
      setLoading(false);
    }
  }, [householdId, initialCategories, onError]);

  useEffect(() => {
    if (!householdId) {
      setCategories(initialCategories);
      setLoadedHouseholdId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void refreshCategories();

    const channel = subscribeToProducts(() => {
      void refreshCategories();
    }, householdId);

    return () => {
      channel.unsubscribe();
    };
  }, [householdId, initialCategories, refreshCategories]);

  const activeHouseholdReady = !householdId || loadedHouseholdId === householdId;

  return {
    categories,
    setCategories,
    loading: loading || !activeHouseholdReady,
    refreshCategories,
  };
}
