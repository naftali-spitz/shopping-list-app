"use client";

import { useCallback, useMemo, useState } from "react";
import { createProduct } from "@/lib/db/products";
import { Category } from "@/types/shopping";

type UseMissingProductAddOptions = {
  categories: Category[];
  refreshCategories: () => Promise<void>;
  onSuccess?: (message: string, title?: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

export function useMissingProductAdd({
  categories,
  refreshCategories,
  onSuccess,
  onError,
  onDone,
}: UseMissingProductAddOptions) {
  const [productName, setProductName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const firstCategoryId = useMemo(() => categories[0]?.id ?? "", [categories]);

  const openAddMissingProduct = useCallback(
    (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) return;

      setProductName(trimmedName);
      setSelectedCategoryId(firstCategoryId);
      setOpen(true);
    },
    [firstCategoryId]
  );

  const closeAddMissingProduct = useCallback(() => {
    if (saving) return;

    setOpen(false);
    setProductName("");
    setSelectedCategoryId("");
  }, [saving]);

  const confirmAddMissingProduct = useCallback(async () => {
    const trimmedName = productName.trim();

    if (!trimmedName || !selectedCategoryId || saving) return false;

    setSaving(true);

    const { error } = await createProduct(selectedCategoryId, trimmedName, {
      checked: true,
    });

    if (error) {
      console.error("Failed to add missing product from search:", error);
      onError?.("הוספת המוצר מהחיפוש נכשלה.");
      setSaving(false);
      return false;
    }

    await refreshCategories();
    onSuccess?.(`המוצר “${trimmedName}” נוסף לרשימת הקניות.`, "המוצר נוסף");
    onDone?.();
    setSaving(false);
    setOpen(false);
    setProductName("");
    setSelectedCategoryId("");
    return true;
  }, [
    onDone,
    onError,
    onSuccess,
    productName,
    refreshCategories,
    saving,
    selectedCategoryId,
  ]);

  return {
    addMissingProductModalOpen: open,
    addMissingProductName: productName,
    addMissingProductSelectedCategoryId: selectedCategoryId,
    addMissingProductSaving: saving,
    closeAddMissingProduct,
    confirmAddMissingProduct,
    openAddMissingProduct,
    setAddMissingProductSelectedCategoryId: setSelectedCategoryId,
  };
}
