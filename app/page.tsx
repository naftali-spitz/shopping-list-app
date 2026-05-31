"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddMissingProductModal } from "@/components/add-missing-product-modal";
import { AnimatedBackground } from "@/components/animated-background";
import {
  AppFeedback,
  AppFeedbackMessage,
} from "@/components/app-feedback";
import { AuthButton } from "@/components/auth-button";
import { CategoriesSection } from "@/components/categories-section";
import { CategoryModal } from "@/components/category-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { CreateHouseholdModal } from "@/components/create-household-modal";
import { EditCategoryModal } from "@/components/edit-category-modal";
import { EditProductModal } from "@/components/edit-product-modal";
import { GlobalSearchSection } from "@/components/global-search-section";
import { HistoryModal } from "@/components/history-modal";
import { HouseholdOnboarding } from "@/components/household-onboarding";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileSettingsModal } from "@/components/profile-settings-modal";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useMissingProductAdd } from "@/hooks/use-missing-product-add";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { useShoppingState } from "@/hooks/use-shopping-state";
import { useCurrentHousehold } from "@/hooks/useCurrentHousehold";
import {
  updateProductDisplayOrder,
  updateProductDisplayOrders,
} from "@/lib/db/products";
import {
  buildBalancedDisplayOrder,
  getNewDisplayOrder,
} from "@/lib/product-ordering";
import { buildGlobalProductSearchResults } from "@/lib/product-search";
import { supabase } from "@/lib/supabase";
import { Category, Product } from "@/types/shopping";

const initialCategories: Category[] = [];

type ProductSortMode = "az" | "popular" | "custom";

function removeInviteTokenFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function Home() {
  const { session, loading } = useSession();
  const [feedback, setFeedback] = useState<AppFeedbackMessage | null>(null);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const showError = useCallback((message: string) => {
    setFeedback({
      id: Date.now(),
      message,
      variant: "error",
    });
  }, []);

  const showSuccess = useCallback((message: string, title = "בוצע") => {
    setFeedback({
      id: Date.now(),
      message,
      title,
      variant: "success",
    });
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) {
      setPendingInviteToken(token);
    }
  }, []);

  const {
    acceptInvite,
    createHousehold,
    createInviteLink,
    currentHouseholdId,
    households,
    loading: householdLoading,
    setCurrentHouseholdId,
  } = useCurrentHousehold({ onError: showError });

  const {
    categories,
    setCategories,
    loading: categoriesLoading,
    refreshCategories,
  } = useSharedCategories(initialCategories, currentHouseholdId);

  const {
    decreaseQuantity,
    deleteHistoryEntry,
    exportDoc,
    history,
    increaseQuantity,
    isLoading,
    playSound,
    previewSound,
    quickAddItem,
    removeProductFromShoppingList,
    setShoppingList,
    shoppingList,
    shoppingProducts,
    soundOn,
    setSoundOn,
    toggleItem,
  } = useShoppingState({
    categories,
    householdId: currentHouseholdId,
    refreshCategories,
    setCategories,
    onError: showError,
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useDarkMode();
  const [sortMode, setSortMode] = useState<ProductSortMode>("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("My household");

  const {
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
  } = useCategoryManagement({
    categories,
    householdId: currentHouseholdId,
    selectedCategoryId,
    refreshCategories,
    setCategories,
    setSelectedCategoryId,
    onError: showError,
  });

  const {
    addMissingProductModalOpen,
    addMissingProductName,
    addMissingProductSelectedCategoryId,
    closeAddMissingProduct,
    confirmAddMissingProduct,
    openAddMissingProduct,
    setAddMissingProductSelectedCategoryId,
  } = useMissingProductAdd({
    categories,
    refreshCategories,
    soundOn,
    onSuccess: showSuccess,
    onError: showError,
    onDone: () => setGlobalSearch(""),
  });

  useEffect(() => {
    if (!session || !pendingInviteToken || householdLoading || acceptingInvite) return;

    const acceptPendingInvite = async () => {
      setAcceptingInvite(true);
      const household = await acceptInvite(pendingInviteToken);

      if (household) {
        showSuccess(`הצטרפת לבית ${household.name}.`, "ההזמנה התקבלה");
      }

      setPendingInviteToken(null);
      removeInviteTokenFromUrl();
      setAcceptingInvite(false);
    };

    void acceptPendingInvite();
  }, [
    acceptInvite,
    acceptingInvite,
    householdLoading,
    pendingInviteToken,
    session,
    showSuccess,
  ]);

  const anyModalOpen =
    Boolean(selectedCategoryId) ||
    Boolean(editingCategoryId) ||
    Boolean(editingProductId) ||
    Boolean(pendingDelete) ||
    addMissingProductModalOpen ||
    historyOpen ||
    profileOpen ||
    createHouseholdOpen;

  useBodyScrollLock(anyModalOpen);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const globalResults = useMemo(
    () => buildGlobalProductSearchResults(categories, globalSearch),
    [categories, globalSearch]
  );

  const { confirmTitle, confirmDescription } = useMemo(() => {
    if (!pendingDelete) {
      return {
        confirmTitle: "",
        confirmDescription: "",
      };
    }

    if (pendingDelete.type === "category") {
      return {
        confirmTitle: "מחיקת קטגוריה?",
        confirmDescription: `הקטגוריה \"${pendingDelete.name}\" תימחק יחד עם ${pendingDelete.productCount} מוצרים. הפעולה לא ניתנת לביטול.`,
      };
    }

    return {
      confirmTitle: "מחיקת מוצר?",
      confirmDescription: `המוצר \"${pendingDelete.name}\" יימחק מהרשימה. הפעולה לא ניתנת לביטול.`,
    };
  }, [pendingDelete]);

  const backgroundClass = darkMode
    ? "bg-[#050816] text-white"
    : "bg-[#f3f7ff] text-slate-950";

  const cardClass = darkMode
    ? "border-white/10 bg-white/5"
    : "border-slate-950/10 bg-white/70 text-slate-950";

  const sortedProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return [...selectedCategory.products]
      .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortMode === "az") {
          return a.name.localeCompare(b.name);
        }

        if (sortMode === "custom") {
          const aOrder = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.displayOrder ?? Number.MAX_SAFE_INTEGER;

          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }

          return a.name.localeCompare(b.name);
        }

        return b.usageCount - a.usageCount || a.name.localeCompare(b.name);
      });
  }, [searchTerm, selectedCategory, sortMode]);

  const handleCustomOrderChange = async (
    productsInFinalOrder: Product[],
    movedProductId: string
  ) => {
    if (!selectedCategoryId) return;

    const movedIndex = productsInFinalOrder.findIndex(
      (product) => product.id === movedProductId
    );

    if (movedIndex === -1) return;

    const previousProduct = productsInFinalOrder[movedIndex - 1] ?? null;
    const nextProduct = productsInFinalOrder[movedIndex + 1] ?? null;
    const newDisplayOrder = getNewDisplayOrder(previousProduct, nextProduct);

    if (newDisplayOrder !== null) {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === selectedCategoryId
            ? {
                ...category,
                products: category.products.map((product) =>
                  product.id === movedProductId
                    ? { ...product, displayOrder: newDisplayOrder }
                    : product
                ),
              }
            : category
        )
      );

      const { error } = await updateProductDisplayOrder(
        movedProductId,
        newDisplayOrder
      );

      if (error) {
        console.error("Failed to update custom product order:", error);
        showError("שמירת סדר המוצרים נכשלה.");
        await refreshCategories();
      }

      return;
    }

    const balancedUpdates = buildBalancedDisplayOrder(productsInFinalOrder);
    const orderByProductId = new Map(
      balancedUpdates.map((update) => [update.id, update.displayOrder])
    );

    setCategories((prev) =>
      prev.map((category) =>
        category.id === selectedCategoryId
          ? {
              ...category,
              products: category.products.map((product) => ({
                ...product,
                displayOrder:
                  orderByProductId.get(product.id) ?? product.displayOrder,
              })),
            }
          : category
      )
    );

    const { error } = await updateProductDisplayOrders(balancedUpdates);

    if (error) {
      console.error("Failed to rebalance custom product order:", error);
      showError("שמירת סדר המוצרים נכשלה.");
      await refreshCategories();
    }
  };

  const handleSwitchHousehold = (householdId: string) => {
    if (householdId === currentHouseholdId) return;

    playSound();
    setCurrentHouseholdId(householdId);
    setSelectedCategoryId(null);
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductCategoryId(null);
    setPendingDelete(null);
    setHistoryOpen(false);
    setProfileOpen(false);
    setSearchTerm("");
    setGlobalSearch("");
  };

  const handleCreateHousehold = () => {
    playSound();
    setNewHouseholdName("My household");
    setProfileOpen(false);
    setCreateHouseholdOpen(true);
  };

  const handleConfirmCreateHousehold = async () => {
    const name = newHouseholdName.trim();

    if (!name) return;

    const household = await createHousehold(name);

    if (!household) return;

    setSelectedCategoryId(null);
    setHistoryOpen(false);
    setCreateHouseholdOpen(false);
    setNewHouseholdName("My household");
    setSearchTerm("");
    setGlobalSearch("");
  };

  const handleCreateInviteLink = async () => {
    if (!currentHouseholdId) {
      showError("לא נמצא בית פעיל להזמנה.");
      return;
    }

    playSound();

    const inviteLink = await createInviteLink(currentHouseholdId);

    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      showSuccess("קישור ההזמנה הועתק. אפשר לשלוח אותו למשפחה או חברים.", "קישור הועתק");
    } catch {
      window.prompt("Copy this invite link", inviteLink);
      showSuccess("קישור ההזמנה נוצר.", "קישור מוכן");
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error);
      showError("ההתנתקות נכשלה.");
    }
  };

  if (loading || householdLoading || acceptingInvite || isLoading || categoriesLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816]">
        <AuthButton />
      </main>
    );
  }

  if (!currentHouseholdId && households.length === 0) {
    return (
      <>
        <HouseholdOnboarding
          email={session.user.email}
          onCreateHousehold={handleCreateHousehold}
        />
        <CreateHouseholdModal
          open={createHouseholdOpen}
          value={newHouseholdName}
          onChange={setNewHouseholdName}
          onClose={() => setCreateHouseholdOpen(false)}
          onCreate={() => void handleConfirmCreateHousehold()}
        />
        <AppFeedback feedback={feedback} onClose={closeFeedback} />
      </>
    );
  }

  return (
    <main
      dir="rtl"
      className={`relative min-h-screen overflow-hidden pb-40 transition-all duration-500 ${backgroundClass}`}
    >
      <AnimatedBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <TopBar
          cardClass={cardClass}
          onOpenHistory={() => {
            playSound();
            setHistoryOpen(true);
          }}
          onOpenProfile={() => {
            playSound();
            setProfileOpen(true);
          }}
        />

        <GlobalSearchSection
          cardClass={cardClass}
          globalSearch={globalSearch}
          globalResults={globalResults}
          onGlobalSearchChange={setGlobalSearch}
          onQuickAdd={(item) => {
            void quickAddItem(item);
            setGlobalSearch("");
          }}
          onAddMissingProduct={openAddMissingProduct}
        />

        <CategoriesSection
          cardClass={cardClass}
          categories={categories}
          darkMode={darkMode}
          newCategoryName={newCategoryName}
          onAddCategory={() => void addCategory()}
          onCategoryNameChange={setNewCategoryName}
          onDeleteCategory={(categoryId, categoryName) => {
            setEditingCategoryId(categoryId);
            setEditingCategoryName(categoryName);
          }}
          onOpenCategory={(categoryId) => {
            playSound();
            setSelectedCategoryId(categoryId);
            setSearchTerm("");
          }}
        />
      </div>

      <ShoppingDrawer
        items={shoppingProducts}
        onRemove={(productId) =>
          void removeProductFromShoppingList(productId)
        }
        onIncreaseQuantity={(productId) => increaseQuantity(productId)}
        onDecreaseQuantity={(productId) => decreaseQuantity(productId)}
        onExport={() => void exportDoc()}
      />

      <CategoryModal
        category={selectedCategory}
        shoppingList={shoppingList}
        searchTerm={searchTerm}
        sortMode={sortMode}
        newProductName={newProductName}
        products={sortedProducts}
        onClose={() => setSelectedCategoryId(null)}
        onToggleItem={(item) => void toggleItem(item)}
        onSearchChange={setSearchTerm}
        onSortChange={setSortMode}
        onNewProductChange={setNewProductName}
        onAddProduct={() => void addProduct()}
        onEditProduct={handleEditProduct}
        onCustomOrderChange={(productsInFinalOrder, movedProductId) =>
          void handleCustomOrderChange(productsInFinalOrder, movedProductId)
        }
      />

      <AddMissingProductModal
        open={addMissingProductModalOpen}
        productName={addMissingProductName}
        categories={categories}
        selectedCategoryId={addMissingProductSelectedCategoryId}
        onCategoryChange={setAddMissingProductSelectedCategoryId}
        onClose={closeAddMissingProduct}
        onAdd={() => void confirmAddMissingProduct()}
      />

      <EditCategoryModal
        category={editingCategory}
        open={Boolean(editingCategory)}
        value={editingCategoryName}
        onClose={() => {
          setEditingCategoryId(null);
          setEditingCategoryName("");
        }}
        onChange={setEditingCategoryName}
        onSave={() => void saveCategoryEdit()}
        onDelete={deleteCategory}
      />

      <EditProductModal
        product={editingProduct}
        categories={categories}
        selectedCategoryId={editingProductCategoryId}
        open={Boolean(editingProductId)}
        value={editingProductName}
        onClose={() => {
          setEditingProductId(null);
          setEditingProductName("");
          setEditingProductCategoryId(null);
        }}
        onChange={setEditingProductName}
        onCategoryChange={setEditingProductCategoryId}
        onSave={() => void saveProductEdit()}
        onDelete={deleteProduct}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <CreateHouseholdModal
        open={createHouseholdOpen}
        value={newHouseholdName}
        onChange={setNewHouseholdName}
        onClose={() => setCreateHouseholdOpen(false)}
        onCreate={() => void handleConfirmCreateHousehold()}
      />

      <ProfileSettingsModal
        open={profileOpen}
        email={session.user.email}
        darkMode={darkMode}
        soundOn={soundOn}
        households={households}
        currentHouseholdId={currentHouseholdId}
        onClose={() => setProfileOpen(false)}
        onToggleTheme={() => {
          playSound();
          setDarkMode((v) => !v);
        }}
        onToggleSound={() => {
          if (soundOn) {
            playSound();
          } else {
            previewSound();
          }

          setSoundOn((v) => !v);
        }}
        onSwitchHousehold={handleSwitchHousehold}
        onCreateHousehold={handleCreateHousehold}
        onCreateInviteLink={() => void handleCreateInviteLink()}
        onLogout={() => {
          playSound();
          void handleLogout();
        }}
      />

      <HistoryModal
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onLoad={(items) => {
          void setShoppingList(items);
          setHistoryOpen(false);
        }}
        onDelete={(historyId) => void deleteHistoryEntry(historyId)}
      />

      <AppFeedback feedback={feedback} onClose={closeFeedback} />
    </main>
  );
}
