import { useCallback, useState } from "react";

import { HOUSEHOLD_ID } from "@/lib/constants";
import {
  createCategory,
  deleteCategory as deleteCategoryFromDb,
  updateCategory,
} from "@/lib/db/categories";
import {
  createProduct,
  deleteProduct as deleteProductFromDb,
  updateProduct,
} from "@/lib/db/products";
import { Category } from "@/types/shopping";

type PendingDelete =
  | { type: "category"; id: string; name: string; productCount: number }
  | { type: "product"; id: string; name: string };

type UseCategoryManagementProps = {
  categories: Category[];
  selectedCategoryId: string | null;
  refreshCategories: () => Promise<void>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setSelectedCategoryId: React.Dispatch<React.SetStateAction<string | null>>;
  onError?: (message: string) => void;
};

export function useCategoryManagement({
  categories,
  selectedCategoryId,
  refreshCategories,
  setCategories,
  setSelectedCategoryId,
  onError,
}: UseCategoryManagementProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductCategoryId, setEditingProductCategoryId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const editingCategory =
    categories.find((category) => category.id === editingCategoryId) ?? null;

  const editingProduct =
    selectedCategory?.products.find(
      (product) => product.id === editingProductId
    ) ?? null;

  const addCategory = useCallback(async () => {
    const name = newCategoryName.trim();

    if (!name) return;

    setNewCategoryName("");

    const { error } = await createCategory(HOUSEHOLD_ID, {
      name,
      icon: "general",
    });

    if (error) {
      console.error("Failed to create category:", error);
      onError?.("הוספת הקטגוריה נכשלה.");
      return;
    }

    await refreshCategories();
  }, [newCategoryName, onError, refreshCategories]);

  const addProduct = useCallback(async () => {
    const name = newProductName.trim();

    if (!name || !selectedCategory) return;

    setNewProductName("");

    const { error } = await createProduct(selectedCategory.id, name);

    if (error) {
      console.error("Failed to create product:", error);
      onError?.("הוספת המוצר נכשלה.");
      return;
    }

    await refreshCategories();
  }, [newProductName, onError, refreshCategories, selectedCategory]);

  const saveCategoryEdit = useCallback(async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    const { error } = await updateCategory(editingCategoryId, {
      name: editingCategoryName,
    });

    if (error) {
      console.error("Failed to update category:", error);
      onError?.("שמירת הקטגוריה נכשלה.");
      return;
    }

    await refreshCategories();
    setEditingCategoryId(null);
    setEditingCategoryName("");
  }, [editingCategoryId, editingCategoryName, onError, refreshCategories]);

  const saveProductEdit = useCallback(async () => {
    if (!editingProductId || !editingProductCategoryId) return;

    const trimmedName = editingProductName.trim();

    if (!trimmedName) return;

    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductCategoryId(null);

    const { error } = await updateProduct(
      editingProductId,
      trimmedName,
      editingProductCategoryId
    );

    if (error) {
      console.error("Failed to update product:", error);
      onError?.("שמירת המוצר נכשלה.");
    }

    await refreshCategories();
  }, [
    editingProductCategoryId,
    editingProductId,
    editingProductName,
    onError,
    refreshCategories,
  ]);

  const deleteCategory = useCallback(() => {
    if (!editingCategory) return;

    setPendingDelete({
      type: "category",
      id: editingCategory.id,
      name: editingCategory.name,
      productCount: editingCategory.products.length,
    });
  }, [editingCategory]);

  const deleteProduct = useCallback(() => {
    if (!editingProduct) return;

    setPendingDelete({
      type: "product",
      id: editingProduct.id,
      name: editingProduct.name,
    });
  }, [editingProduct]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === "product") {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === selectedCategoryId
            ? {
                ...category,
                products: category.products.filter(
                  (product) => product.id !== pendingDelete.id
                ),
              }
            : category
        )
      );

      setEditingProductId(null);
      setEditingProductName("");
      setEditingProductCategoryId(null);
      setPendingDelete(null);

      const { error } = await deleteProductFromDb(pendingDelete.id);

      if (error) {
        console.error("Failed to delete product:", error);
        onError?.("מחיקת המוצר נכשלה.");
        await refreshCategories();
      }

      return;
    }

    setCategories((prev) =>
      prev.filter((category) => category.id !== pendingDelete.id)
    );

    if (selectedCategoryId === pendingDelete.id) {
      setSelectedCategoryId(null);
    }

    setEditingCategoryId(null);
    setEditingCategoryName("");
    setPendingDelete(null);

    const { error } = await deleteCategoryFromDb(pendingDelete.id);

    if (error) {
      console.error("Failed to delete category:", error);
      onError?.("מחיקת הקטגוריה נכשלה.");
      await refreshCategories();
    }
  }, [
    onError,
    pendingDelete,
    refreshCategories,
    selectedCategoryId,
    setCategories,
    setSelectedCategoryId,
  ]);

  const handleEditProduct = useCallback(
    (productId: string) => {
      const product = selectedCategory?.products.find(
        (item) => item.id === productId
      );

      if (!product) return;

      setEditingProductId(product.id);
      setEditingProductName(product.name);
      setEditingProductCategoryId(product.category_id);
    },
    [selectedCategory]
  );

  return {
    addCategory,
    addProduct,
    confirmDelete,
    deleteCategory,
    deleteProduct,
    editingCategory,
    editingCategoryId,
    editingCategoryName,
    editingProduct,
    editingProductCategoryId,
    editingProductId,
    editingProductName,
    handleEditProduct,
    newCategoryName,
    newProductName,
    pendingDelete,
    saveCategoryEdit,
    saveProductEdit,
    setEditingCategoryId,
    setEditingCategoryName,
    setEditingProductCategoryId,
    setEditingProductId,
    setEditingProductName,
    setNewCategoryName,
    setNewProductName,
    setPendingDelete,
  };
}
