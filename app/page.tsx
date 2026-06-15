"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddMissingProductModal } from "@/components/add-missing-product-modal";
import { AnimatedBackground } from "@/components/animated-background";
import { AppFeedback, AppFeedbackMessage } from "@/components/app-feedback";
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
import { LanguageSelector } from "@/components/language-selector";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileSettingsModal } from "@/components/profile-settings-modal";
import { ShoppingDrawer } from "@/components/shopping-drawer";
import { TopBar } from "@/components/top-bar";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useMissingProductAdd } from "@/hooks/use-missing-product-add";
import { useSession } from "@/hooks/use-session";
import { useSharedCategories } from "@/hooks/use-shared-categories";
import { useShoppingState } from "@/hooks/use-shopping-state";
import { useCurrentHousehold } from "@/hooks/useCurrentHousehold";
import { buildCategoryProductList, ProductSortMode } from "@/lib/category-product-list";
import { DEFAULT_CATEGORY_ICON } from "@/lib/category-icons";
import { getDeleteConfirmationCopy } from "@/lib/delete-confirmation";
import { fetchCategories } from "@/lib/db/categories";
import { updateProductDisplayOrder, updateProductDisplayOrders } from "@/lib/db/products";
import { seedDefaultHouseholdData, type DefaultHouseholdLanguage } from "@/lib/default-household-template";
import { buildBalancedDisplayOrder, getNewDisplayOrder } from "@/lib/product-ordering";
import { buildGlobalProductSearchResults } from "@/lib/product-search";
import { supabase } from "@/lib/supabase";
import { getAppBackgroundClass, getCardClass } from "@/lib/theme-classes";
import { Category, Product } from "@/types/shopping";

const initialCategories: Category[] = [];

function removeInviteTokenFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function Home() {
  const { language, setLanguage, direction, copy } = useAppLanguage();
  const { session, loading } = useSession();
  const [feedback, setFeedback] = useState<AppFeedbackMessage | null>(null);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const showError = useCallback((message: string) => setFeedback({ id: Date.now(), message, variant: "error" }), []);
  const showSuccess = useCallback((message: string, title?: string) => setFeedback({ id: Date.now(), message, title: title ?? copy.common.doneTitle, variant: "success" }), [copy.common.doneTitle]);
  const closeFeedback = useCallback(() => setFeedback(null), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) setPendingInviteToken(token);
  }, []);

  const { acceptInvite, createHousehold, createInviteLink, currentHouseholdId, households, loading: householdLoading, setCurrentHouseholdId } = useCurrentHousehold({ onError: showError });
  const { categories, setCategories, loading: categoriesLoading, refreshCategories } = useSharedCategories(initialCategories, currentHouseholdId);
  const { decreaseQuantity, deleteHistoryEntry, exportDoc, history, increaseQuantity, isLoading, playSound, previewSound, quickAddItem, removeProductFromShoppingList, setShoppingList, shoppingList, shoppingProducts, soundOn, setSoundOn, toggleItem } = useShoppingState({ categories, householdId: currentHouseholdId, refreshCategories, setCategories, onError: showError });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useDarkMode();
  const [sortMode, setSortMode] = useState<ProductSortMode>("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState<string>(copy.household.defaultName);
  const [newHouseholdUseDefaults, setNewHouseholdUseDefaults] = useState(true);
  const [newHouseholdDefaultLanguage, setNewHouseholdDefaultLanguage] = useState<DefaultHouseholdLanguage>(language);
  const [creatingHousehold, setCreatingHousehold] = useState(false);

  const { addCategory, addProduct, confirmDelete, deleteCategory, deleteProduct, editingCategory, editingCategoryIcon, editingCategoryId, editingCategoryName, editingProduct, editingProductCategoryId, editingProductId, editingProductName, handleEditProduct, newCategoryIcon, newCategoryName, newProductName, pendingDelete, saveCategoryEdit, saveProductEdit, setEditingCategoryIcon, setEditingCategoryId, setEditingCategoryName, setEditingProductCategoryId, setEditingProductId, setEditingProductName, setNewCategoryIcon, setNewCategoryName, setNewProductName, setPendingDelete } = useCategoryManagement({ categories, householdId: currentHouseholdId, selectedCategoryId, refreshCategories, setCategories, setSelectedCategoryId, onError: showError });
  const { addMissingProductModalOpen, addMissingProductName, addMissingProductSelectedCategoryId, closeAddMissingProduct, confirmAddMissingProduct, openAddMissingProduct, setAddMissingProductSelectedCategoryId } = useMissingProductAdd({ categories, refreshCategories, soundOn, onSuccess: showSuccess, onError: showError, onDone: () => setGlobalSearch("") });

  useEffect(() => {
    if (!session || !pendingInviteToken || householdLoading || acceptingInvite) return;
    const acceptPendingInvite = async () => {
      setAcceptingInvite(true);
      const household = await acceptInvite(pendingInviteToken);
      if (household) showSuccess(copy.household.joined(household.name), copy.household.joinedTitle);
      setPendingInviteToken(null);
      removeInviteTokenFromUrl();
      setAcceptingInvite(false);
    };
    void acceptPendingInvite();
  }, [acceptInvite, acceptingInvite, copy.household, householdLoading, pendingInviteToken, session, showSuccess]);

  useBodyScrollLock(Boolean(selectedCategoryId) || Boolean(editingCategoryId) || Boolean(editingProductId) || Boolean(pendingDelete) || addMissingProductModalOpen || historyOpen || profileOpen || createHouseholdOpen || createCategoryOpen);
  const selectedCategory = useMemo(() => categories.find((c) => c.id === selectedCategoryId) ?? null, [categories, selectedCategoryId]);
  const globalResults = useMemo(() => buildGlobalProductSearchResults(categories, globalSearch), [categories, globalSearch]);
  const { confirmTitle, confirmDescription } = useMemo(() => getDeleteConfirmationCopy(pendingDelete), [pendingDelete]);
  const backgroundClass = getAppBackgroundClass(darkMode);
  const cardClass = getCardClass(darkMode);
  const sortedProducts = useMemo(() => selectedCategory ? buildCategoryProductList(selectedCategory.products, searchTerm, sortMode) : [], [searchTerm, selectedCategory, sortMode]);

  const resetViewState = () => {
    setSelectedCategoryId(null);
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductCategoryId(null);
    setPendingDelete(null);
    setHistoryOpen(false);
    setProfileOpen(false);
    setCreateCategoryOpen(false);
    setSearchTerm("");
    setGlobalSearch("");
  };

  const handleCustomOrderChange = async (productsInFinalOrder: Product[], movedProductId: string) => {
    if (!selectedCategoryId) return;
    const movedIndex = productsInFinalOrder.findIndex((product) => product.id === movedProductId);
    if (movedIndex === -1) return;
    const newDisplayOrder = getNewDisplayOrder(productsInFinalOrder[movedIndex - 1] ?? null, productsInFinalOrder[movedIndex + 1] ?? null);
    if (newDisplayOrder !== null) {
      setCategories((prev) => prev.map((category) => category.id === selectedCategoryId ? { ...category, products: category.products.map((product) => product.id === movedProductId ? { ...product, displayOrder: newDisplayOrder } : product) } : category));
      const { error } = await updateProductDisplayOrder(movedProductId, newDisplayOrder);
      if (error) { console.error("Failed to update custom product order:", error); showError(copy.errors.orderSaveFailed); await refreshCategories(); }
      return;
    }
    const balancedUpdates = buildBalancedDisplayOrder(productsInFinalOrder);
    const orderByProductId = new Map(balancedUpdates.map((update) => [update.id, update.displayOrder]));
    setCategories((prev) => prev.map((category) => category.id === selectedCategoryId ? { ...category, products: category.products.map((product) => ({ ...product, displayOrder: orderByProductId.get(product.id) ?? product.displayOrder })) } : category));
    const { error } = await updateProductDisplayOrders(balancedUpdates);
    if (error) { console.error("Failed to rebalance custom product order:", error); showError(copy.errors.orderSaveFailed); await refreshCategories(); }
  };

  const handleSwitchHousehold = (householdId: string) => { if (householdId === currentHouseholdId) return; playSound("open"); setCurrentHouseholdId(householdId); resetViewState(); };
  const handleCreateHousehold = () => { playSound("open"); setNewHouseholdName(copy.household.defaultName); setNewHouseholdUseDefaults(true); setNewHouseholdDefaultLanguage(language); setProfileOpen(false); setCreateHouseholdOpen(true); };
  const handleConfirmCreateHousehold = async () => {
    const name = newHouseholdName.trim();
    if (!name || creatingHousehold) return;

    setCreatingHousehold(true);

    try {
      const household = await createHousehold(name);
      if (!household) return;

      if (newHouseholdUseDefaults) {
        const { error } = await seedDefaultHouseholdData(household.id, newHouseholdDefaultLanguage);

        if (error) {
          console.error("Failed to seed default household data:", error);
          showError(direction === "rtl" ? "הבית נוצר, אבל הוספת מוצרי ברירת המחדל נכשלה." : "The household was created, but the starter products could not be added.");
        } else {
          setCategories(await fetchCategories(household.id));
        }
      } else {
        setCategories([]);
      }

      playSound("success");
      resetViewState();
      setCreateHouseholdOpen(false);
      setNewHouseholdName(copy.household.defaultName);
      setNewHouseholdUseDefaults(true);
      setNewHouseholdDefaultLanguage(language);
    } finally {
      setCreatingHousehold(false);
    }
  };
  const handleOpenCreateCategory = () => { playSound("open"); setNewCategoryName(""); setNewCategoryIcon(DEFAULT_CATEGORY_ICON); setCreateCategoryOpen(true); };
  const handleConfirmCreateCategory = async () => { if (!newCategoryName.trim()) return; await addCategory(); playSound("success"); setCreateCategoryOpen(false); };
  const handleCreateInviteLink = async () => {
    if (!currentHouseholdId) { showError(copy.errors.inviteMissingHousehold); return; }
    playSound("tap");
    const inviteLink = await createInviteLink(currentHouseholdId);
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); playSound("success"); showSuccess(copy.household.inviteCopied, copy.household.inviteCopiedTitle); }
    catch { window.prompt("Copy this invite link", inviteLink); playSound("success"); showSuccess(copy.household.inviteReady, copy.household.inviteReadyTitle); }
  };
  const handleLogout = async () => { playSound("open"); const { error } = await supabase.auth.signOut(); if (error) { console.error("Logout failed:", error); showError(copy.errors.logoutFailed); } };

  if (loading || householdLoading || acceptingInvite || isLoading || categoriesLoading) return <LoadingScreen />;

  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] p-4 text-white" dir={direction}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.14),_transparent_36%)]" />
        <div className="absolute top-4 z-20 sm:top-6" style={{ insetInlineEnd: "1rem" }}><LanguageSelector language={language} copy={copy} onChange={setLanguage} compact /></div>
        <section className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/10 bg-white/10 p-7 text-center shadow-2xl backdrop-blur-2xl">
          <h1 className="text-3xl font-bold">{copy.login.title}</h1><p className="mt-2 text-sm text-cyan-100/75">{copy.login.subtitle}</p><p className="mt-5 text-sm leading-6 text-white/60">{copy.login.intro}</p>
          <div className="mt-6 flex justify-center"><AuthButton label={copy.auth.loginWithGoogle} /></div>
        </section>
      </main>
    );
  }

  if (!currentHouseholdId && households.length === 0) {
    return <><HouseholdOnboarding email={session.user.email} language={language} direction={direction} copy={copy} onLanguageChange={setLanguage} onCreateHousehold={handleCreateHousehold} /><CreateHouseholdModal open={createHouseholdOpen} value={newHouseholdName} copy={copy} direction={direction} useDefaultProducts={newHouseholdUseDefaults} defaultLanguage={newHouseholdDefaultLanguage} isCreating={creatingHousehold} onChange={setNewHouseholdName} onUseDefaultProductsChange={setNewHouseholdUseDefaults} onDefaultLanguageChange={setNewHouseholdDefaultLanguage} onClose={() => setCreateHouseholdOpen(false)} onCreate={() => void handleConfirmCreateHousehold()} /><AppFeedback feedback={feedback} onClose={closeFeedback} /></>;
  }

  return (
    <main dir={direction} className={`relative min-h-screen overflow-hidden pb-40 transition-all duration-500 ${backgroundClass}`}>
      <AnimatedBackground />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <TopBar copy={copy} cardClass={cardClass} onOpenHistory={() => { playSound("open"); setHistoryOpen(true); }} onOpenProfile={() => { playSound("open"); setProfileOpen(true); }} />
        <GlobalSearchSection copy={copy} cardClass={cardClass} globalSearch={globalSearch} globalResults={globalResults} onGlobalSearchChange={setGlobalSearch} onQuickAdd={(item) => { void quickAddItem(item); setGlobalSearch(""); }} onAddMissingProduct={(name) => { playSound("open"); openAddMissingProduct(name); }} />
        <CategoriesSection copy={copy} cardClass={cardClass} categories={categories} darkMode={darkMode} onCreateCategory={handleOpenCreateCategory} onDeleteCategory={(categoryId, categoryName) => { playSound("open"); setEditingCategoryId(categoryId); setEditingCategoryName(categoryName); }} onOpenCategory={(categoryId) => { playSound("open"); setSelectedCategoryId(categoryId); setSearchTerm(""); }} />
      </div>
      <ShoppingDrawer copy={copy} items={shoppingProducts} onRemove={(productId) => void removeProductFromShoppingList(productId)} onIncreaseQuantity={(productId) => increaseQuantity(productId)} onDecreaseQuantity={(productId) => decreaseQuantity(productId)} onExport={() => void exportDoc()} />
      <CategoryModal copy={copy} category={selectedCategory} shoppingList={shoppingList} searchTerm={searchTerm} sortMode={sortMode} newProductName={newProductName} products={sortedProducts} onClose={() => setSelectedCategoryId(null)} onToggleItem={(item) => void toggleItem(item)} onSearchChange={setSearchTerm} onSortChange={setSortMode} onNewProductChange={setNewProductName} onAddProduct={() => void addProduct()} onEditProduct={handleEditProduct} onCustomOrderChange={(productsInFinalOrder, movedProductId) => void handleCustomOrderChange(productsInFinalOrder, movedProductId)} onPlaySound={playSound} />
      <EditCategoryModal copy={copy} category={null} mode="create" open={createCategoryOpen} value={newCategoryName} icon={newCategoryIcon} onClose={() => setCreateCategoryOpen(false)} onChange={setNewCategoryName} onIconChange={setNewCategoryIcon} onSave={() => void handleConfirmCreateCategory()} onPlaySound={playSound} />
      <AddMissingProductModal open={addMissingProductModalOpen} productName={addMissingProductName} categories={categories} selectedCategoryId={addMissingProductSelectedCategoryId} onCategoryChange={setAddMissingProductSelectedCategoryId} onClose={closeAddMissingProduct} onAdd={() => void confirmAddMissingProduct()} />
      <EditCategoryModal copy={copy} category={editingCategory} mode="edit" open={Boolean(editingCategory)} value={editingCategoryName} icon={editingCategoryIcon} onClose={() => { setEditingCategoryId(null); setEditingCategoryName(""); }} onChange={setEditingCategoryName} onIconChange={setEditingCategoryIcon} onSave={() => { playSound("success"); void saveCategoryEdit(); }} onDelete={() => { playSound("delete"); deleteCategory(); }} onPlaySound={playSound} />
      <EditProductModal product={editingProduct} categories={categories} selectedCategoryId={editingProductCategoryId} open={Boolean(editingProductId)} value={editingProductName} onClose={() => { setEditingProductId(null); setEditingProductName(""); setEditingProductCategoryId(null); }} onChange={setEditingProductName} onCategoryChange={setEditingProductCategoryId} onSave={() => { playSound("success"); void saveProductEdit(); }} onDelete={() => { playSound("delete"); deleteProduct(); }} />
      <ConfirmModal open={Boolean(pendingDelete)} title={confirmTitle} description={confirmDescription} confirmText={copy.common.delete} cancelText={copy.common.cancel} onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />
      <CreateHouseholdModal open={createHouseholdOpen} value={newHouseholdName} copy={copy} direction={direction} useDefaultProducts={newHouseholdUseDefaults} defaultLanguage={newHouseholdDefaultLanguage} isCreating={creatingHousehold} onChange={setNewHouseholdName} onUseDefaultProductsChange={setNewHouseholdUseDefaults} onDefaultLanguageChange={setNewHouseholdDefaultLanguage} onClose={() => setCreateHouseholdOpen(false)} onCreate={() => void handleConfirmCreateHousehold()} />
      <ProfileSettingsModal open={profileOpen} email={session.user.email} darkMode={darkMode} soundOn={soundOn} households={households} currentHouseholdId={currentHouseholdId} language={language} copy={copy} onLanguageChange={setLanguage} onClose={() => setProfileOpen(false)} onToggleTheme={() => { playSound("toggle"); setDarkMode((v) => !v); }} onToggleSound={() => { soundOn ? playSound("toggle") : previewSound(); setSoundOn((v) => !v); }} onSwitchHousehold={handleSwitchHousehold} onCreateHousehold={handleCreateHousehold} onCreateInviteLink={() => void handleCreateInviteLink()} onLogout={() => { void handleLogout(); }} />
      <HistoryModal open={historyOpen} history={history} onClose={() => setHistoryOpen(false)} onLoad={(items) => { void setShoppingList(items); setHistoryOpen(false); }} onDelete={async (historyId) => { const deleted = await deleteHistoryEntry(historyId); if (!deleted) throw new Error("History delete failed"); }} />
      <AppFeedback feedback={feedback} onClose={closeFeedback} />
    </main>
  );
}
