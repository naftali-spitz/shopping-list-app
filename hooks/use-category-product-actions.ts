import { useCallback } from "react";

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

type Props = {
  categories: Category[];
  selectedCategory: Category | null;
  selectedCategoryId: string | null;
  editingCategoryId: string | null;
  editingCategoryName: string;
  editingProductId: string | null;
  editingProductName: string;
  editingProductCategoryId: string | null;
  pendingDelete: PendingDelete | null;
  refreshCategories: () => Promise<void>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setEditingCategoryId: (value: string | null) => void;
  setEditingCategoryName: (value: string) => void;
  setEditingProductId: (value: string | null) => void;
  setEditingProductName: (value: string) => void;
  setEditingProductCategoryId: (value: string | null) => void;
  setPendingDelete: (value: PendingDelete | null) => void;
  setSelectedCategoryId: (value: string | null) => void;
  setNewCategoryName: (value: string) => void;
  setNewProductName: (value: string) => void;
};

export function useCategoryProductActions({
  categories,
  selectedCategory,
  selectedCategoryId,
  editingCategoryId,
  editingCategoryName,
  editingProductId,
  editingProductName,
  editingProductCategoryId,
  pendingDelete,
  refreshCategories,
  setCategories,
  setEditingCategoryId,
  setEditingCategoryName,
  setEditingProductId,
  setEditingProductName,
  setEditingProductCategoryId,
  setPendingDelete,
  setSelectedCategoryId,
  setNewCategoryName,
  setNewProductName,
}: Props) {
  const addCategory = useCallback(
    async (newCategoryName: string) => {
      const name = newCategoryName.trim();

      if (!name) return;

      setNewCategoryName("");

      const { error } = await createCategory(HOUSEHOLD_ID, {
        name,
        icon: "general",
      });

      if (error) {
        console.error("Failed to create category:", error);
        return;
      }

      await refreshCategories();
    },
    [refreshCategories, setNewCategoryName]
  );

  const addProduct = useCallback(
    async (newProductName: string) => {
      const name = newProductName.trim();

      if (!name || !selectedCategory) return;

      setNewProductName("");

      const { error } = await createProduct(selectedCategory.id, name);

      if (error) {
        console.error("Failed to create product:", error);
        return;
      }

      await refreshCategories();
    },
    [refreshCategories, selectedCategory, setNewProductName]
  );

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
    }

    await refreshCategories();
  }, [
    editingProductCategoryId,
    editingProductId,
    editingProductName,
    refreshCategories,
    setEditingProductCategoryId,
    setEditingProductId,
    setEditingProductName,
  ]);

  const saveCategoryEdit = useCallback(async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;

    const { error } = await updateCategory(editingCategoryId, {
      name: editingCategoryName,
    });

    if (error) return;

    await refreshCategories();

    setEditingCategoryId(null);
    setEditingCategoryName("");
  }, [
    editingCategoryId,
    editingCategoryName,
    refreshCategories,
    setEditingCategoryId,
    setEditingCategoryName,
  ]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === "product") {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedCategoryId
            ? {
                ...c,
                products: c.products.filter((p) => p.id !== pendingDelete.id),
              }
            : c
        )
      );

      setEditingProductId(null);
      setEditingProductName("");
      setEditingProductCategoryId(null);
      setPendingDelete(null);

      const { error } = await deleteProductFromDb(pendingDelete.id);

      if (error) {
        console.error("Failed to delete product:", error);
        await refreshCategories();
      }

      return;
    }

    setCategories((prev) =>
      prev.filter((c) => c.id !== pendingDelete.id)
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
      await refreshCategories();
    }
  }, [
    pendingDelete,
    refreshCategories,
    selectedCategoryId,
    setCategories,
    setEditingCategoryId,
    setEditingCategoryName,
    setEditingProductCategoryId,
    setEditingProductId,
    setEditingProductName,
    setPendingDelete,
    setSelectedCategoryId,
  ]);

  const handleEditProduct = useCallback(
    (productId: string) => {
      const product = selectedCategory?.products.find(
        (p) => p.id === productId
      );

      if (!product) return;

      setEditingProductId(product.id);
      setEditingProductName(product.name);
      setEditingProductCategoryId(product.category_id);
    },
    [
      selectedCategory,
      setEditingProductCategoryId,
      setEditingProductId,
      setEditingProductName,
    ]
  );

  const editingCategory =
    categories.find((c) => c.id === editingCategoryId) ?? null;

  const editingProduct =
    selectedCategory?.products.find((p) => p.id === editingProductId) ?? null;

  const deleteCategory = useCallback(() => {
    if (!editingCategory) return;

    setPendingDelete({
      type: "category",
      id: editingCategory.id,
      name: editingCategory.name,
      productCount: editingCategory.products.length,
    });
  }, [editingCategory, setPendingDelete]);

  const deleteProduct = useCallback(() => {
    if (!editingProduct) return;

    setPendingDelete({
      type: "product",
      id: editingProduct.id,
      name: editingProduct.name,
    });
  }, [editingProduct, setPendingDelete]);

  return {
    addCategory,
    addProduct,
    confirmDelete,
    deleteCategory,
    deleteProduct,
    editingCategory,
    editingProduct,
    handleEditProduct,
    saveCategoryEdit,
    saveProductEdit,
  };
}
