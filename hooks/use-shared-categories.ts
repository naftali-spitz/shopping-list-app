"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCategories } from "@/lib/db/categories";
import { subscribeToProducts } from "@/lib/realtime/products-channel";
import { Category } from "@/types/shopping";

export function useSharedCategories(initialCategories: Category[], householdId: string | null) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    try {
      if (!householdId) {
        setCategories(initialCategories);
        setLoading(false);
        return;
      }

      const data = await fetchCategories(householdId);

      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, [householdId, initialCategories]);

  useEffect(() => {
    if (!householdId) {
      setCategories(initialCategories);
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

  return {
    categories,
    setCategories,
    loading,
    refreshCategories,
  };
}
