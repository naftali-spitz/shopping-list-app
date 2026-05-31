"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCategories } from "@/lib/db/categories";
import { subscribeToProducts } from "@/lib/realtime/products-channel";
import { Category } from "@/types/shopping";

export function useSharedCategories(initialCategories: Category[], householdId: string | null) {
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

      setCategories(data);
      setLoadedHouseholdId(householdId);
    } finally {
      setLoading(false);
    }
  }, [householdId, initialCategories]);

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
    });

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
