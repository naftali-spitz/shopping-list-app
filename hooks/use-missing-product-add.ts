"use client";

import { useCallback, useMemo, useState } from "react";
import { createProduct } from "@/lib/db/products";
import { playUiSound, UiSoundType } from "@/lib/ui-sounds";
import { Category } from "@/types/shopping";

type UseMissingProductAddOptions = {
  categories: Category[];
  refreshCategories: () => Promise<void>;
  soundOn?: boolean;
  onSuccess?: (message: string, title?: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

export function useMissingProductAdd({
  categories,
  refreshCategories,
  soundOn = false,
  onSuccess,
  onError,
  onDone,
}: UseMissingProductAddOptions) {
  const [productName, setProductName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const firstCategoryId = useMemo(() => categories[0]?.id ?? "", [categories]);

  const playSound = useCallback(
    (type: UiSoundType) => {
      if (!soundOn) return;

      void playUiSound(type).catch(() => undefined);
    },
    [soundOn]
  );

  const openAddMissingProduct = useCallback(
    (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) return;

      playSound("click");
      setProductName(trimmedName);
      setSelectedCategoryId(firstCategoryId);
      setOpen(true);
    },
    [firstCategoryId, playSound]
  );

  const closeAddMissingProduct = useCallback(() => {
    if (saving) return;

    playSound("click");
    setOpen(false);
    setProductName("");
    setSelectedCategoryId("");
  }, [playSound, saving]);

  const confirmAddMissingProduct = useCallback(async () => {
    const trimmedName = productName.trim();

    if (!trimmedName || !selectedCategoryId || saving) return false;

    setSaving(true);

    const { error } = await createProduct(selectedCategoryId, trimmedName, {
      checked: true,
    });

    if (error) {
      console.error("Failed to add missing product from search:", error);
      playSound("error");
      onError?.("הוספת המוצר מהחיפוש נכשלה.");
      setSaving(false);
      return false;
    }

    await refreshCategories();
    playSound("success");
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
    playSound,
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
