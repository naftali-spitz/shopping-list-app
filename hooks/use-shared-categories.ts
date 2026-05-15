"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCategories } from "@/lib/db/categories";
import { subscribeToProducts } from "@/lib/realtime/products-channel";
import { HOUSEHOLD_ID } from "@/lib/constants";
import { Category } from "@/types/shopping";

export function useSharedCategories(initialCategories: Category[]) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await fetchCategories(HOUSEHOLD_ID);

      if (data.length > 0) {
        setCategories(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCategories();

    const channel = subscribeToProducts(() => {
      void refreshCategories();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [refreshCategories]);

  return {
    categories,
    setCategories,
    loading,
    refreshCategories,
  };
}
