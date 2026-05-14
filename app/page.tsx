"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, Download, History, Milk, Moon, PackagePlus, Plus, Search, Sandwich, ShoppingCart, Sparkles, Sun, Trash2, X } from "lucide-react";
import { LoadingScreen } from "@/components/loading-screen";

type Product = { id: string; name: string; usageCount: number };
type Category = { id: string; name: string; icon: "dairy" | "fruit" | "bakery" | "general"; products: Product[] };
type HistoryEntry = { id: string; createdAt: string; items: string[] };

const iconMap = { dairy: Milk, fruit: Apple, bakery: Sandwich, general: PackagePlus };
const initialCategories: Category[] = [
  { id: "dairy", name: "Dairy", icon: "dairy", products: ["Milk", "Cheese", "Butter", "Yogurt", "Cottage Cheese"].map((name, index) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, usageCount: 12 - index })) },
  { id: "fruits", name: "Fruits", icon: "fruit", products: ["Bananas", "Apples", "Strawberries", "Mango", "Grapes"].map((name, index) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, usageCount: 10 - index })) },
  { id: "bakery", name: "Bakery", icon: "bakery", products: ["Bread", "Bagels", "Croissants", "Pita", "Buns"].map((name, index) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, usageCount: 14 - index })) },
];

const makeId = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [shoppingList, setShoppingList] = useState<string[]>(["Milk", "Bread"]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [sortMode, setSortMode] = useState<"az" | "popular">("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const savedCategories = localStorage.getItem("futurecart-categories");
    const savedList = localStorage.getItem("futurecart-list");
    const savedHistory = localStorage.getItem("futurecart-history");
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedList) setShoppingList(JSON.parse(savedList));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => localStorage.setItem("futurecart-categories", JSON.stringify(categories)), [categories]);
  useEffect(() => localStorage.setItem("futurecart-list", JSON.stringify(shoppingList)), [shoppingList]);
  useEffect(() => localStorage.setItem("futurecart-history", JSON.stringify(history)), [history]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const backgroundClass = darkMode ? "bg-[#050816] text-white" : "bg-[#f3f7ff] text-slate-950";
  const cardClass = darkMode ? "border-white/10 bg-white/5" : "border-slate-950/10 bg-white/70 text-slate-950";

  const sortedProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return [...selectedCategory.products]
      .filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => sortMode === "az" ? a.name.localeCompare(b.name) : b.usageCount - a.usageCount);
  }, [searchTerm, selectedCategory, sortMode]);

  const playSound = () => {
    if (!soundOn) return;
    const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=");
    void audio.play().catch(() => undefined);
  };

  const toggleItem = (item: string) => {
    playSound();
    setShoppingList((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategories((prev) => [...prev, { id: makeId(name), name, icon: "general", products: [] }]);
    setNewCategoryName("");
  };

  const addProduct = () => {
    const name = newProductName.trim();
    if (!name || !selectedCategory) return;
    setCategories((prev) => prev.map((category) => category.id === selectedCategory.id ? { ...category, products: [...category.products, { id: makeId(name), name, usageCount: 0 }] } : category));
    setNewProductName("");
  };

  const removeProduct = (productId: string) => {
    if (!selectedCategory) return;
    setCategories((prev) => prev.map((category) => category.id === selectedCategory.id ? { ...category, products: category.products.filter((product) => product.id !== productId) } : category));
  };

  const exportDoc = () => {
    if (!shoppingList.length) return;
    const createdAt = new Date().toISOString();
    const html = `<html><head><meta charset="utf-8" /></head><body style="font-family:Arial;padding:32px;background:#050816;color:#fff"><h1>FutureCart Shopping List</h1><p>${new Date(createdAt).toLocaleString()}</p><ul>${shoppingList.map((item) => `<li style="margin-bottom:8px">☐ ${item}</li>`).join("")}</ul></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shopping-list-${createdAt.slice(0, 10)}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    setHistory((prev) => [{ id: createdAt, createdAt, items: shoppingList }, ...prev]);
    setShoppingList([]);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className={`relative min-h-screen overflow-hidden pb-40 transition-all duration-500 ${backgroundClass}`}>
      <div className="absolute inset-0 overflow-hidden">
        <motion.div animate={{ x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 9, repeat: Infinity }} className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <motion.div animate={{ x: [0, -50, 0], y: [0, 20, 0] }} transition={{ duration: 11, repeat: Infinity }} className="absolute right-0 top-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <header className={`flex flex-wrap items-center justify-between gap-4 rounded-3xl border px-5 py-4 backdrop-blur-xl ${cardClass}`}>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: -8, scale: 1.08 }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/20"><ShoppingCart className="text-cyan-300" /></motion.div>
            <div><h1 className="text-xl font-semibold">FutureCart</h1><p className="text-sm opacity-60">Smart shopping companion</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSoundOn(!soundOn)} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20">Sound {soundOn ? "On" : "Off"}</button>
            <button onClick={() => setHistoryOpen(true)} className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"><History size={18} /></button>
            <button onClick={() => setDarkMode(!darkMode)} className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={exportDoc} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm transition hover:bg-cyan-400/20">Export List</button>
          </div>
        </header>

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><Sparkles className="text-cyan-300" /><h2 className="text-3xl font-bold">Choose Categories</h2></div>
            <div className={`flex gap-2 rounded-3xl border p-2 backdrop-blur-xl ${cardClass}`}>
              <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCategory()} placeholder="Add category" className="w-40 bg-transparent px-3 text-sm outline-none placeholder:opacity-50" />
              <button onClick={addCategory} className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-black">Add</button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category, index) => {
              const Icon = iconMap[category.icon];
              return (
                <motion.div key={category.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} whileHover={{ scale: 1.03 }} className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl ${cardClass}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 opacity-0 transition duration-500 group-hover:opacity-100" />
                  <div className="relative z-10">
                    <div className="mb-4 flex items-start justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><Icon className="text-cyan-300" /></div><button onClick={() => setCategories((prev) => prev.filter((item) => item.id !== category.id))} className="rounded-2xl bg-red-500/10 p-2 text-red-300 opacity-70 transition hover:opacity-100"><Trash2 size={16} /></button></div>
                    <h3 className="text-2xl font-semibold">{category.name}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">{category.products.slice(0, 3).map((product) => <span key={product.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-70">{product.name}</span>)}</div>
                    <button onClick={() => { setSelectedCategoryId(category.id); setSearchTerm(""); }} className="mt-6 w-full rounded-2xl bg-white/10 py-3 text-sm transition hover:bg-white/20">Open Category</button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-x-4 bottom-4 z-20 mx-auto h-fit max-w-[420px] rounded-3xl border border-white/10 bg-black/55 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-[360px]">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Shopping List</h2><div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">{shoppingList.length} Items</div></div>
        <div className="mt-4 max-h-[260px] space-y-3 overflow-auto pr-2"><AnimatePresence initial={false}>{shoppingList.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Your active list is empty. Pick a category to start.</p>}{shoppingList.map((item) => <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><span>{item}</span><button onClick={() => toggleItem(item)} className="rounded-full bg-red-500/20 p-1 text-red-300"><X size={14} /></button></motion.div>)}</AnimatePresence></div>
        <button onClick={exportDoc} disabled={!shoppingList.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"><Download size={18} />Export DOC</button>
      </motion.div>

      <AnimatePresence>
        {selectedCategory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[32px] border border-white/10 bg-[#0b1020]/90 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-3xl font-bold">{selectedCategory.name}</h2><p className="mt-2 text-sm text-white/60">Sort, add, remove, and choose products.</p></div><button onClick={() => setSelectedCategoryId(null)} className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20"><X size={18} /></button></div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4"><Search size={16} className="opacity-50" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/40" /></div><select value={sortMode} onChange={(event) => setSortMode(event.target.value as "az" | "popular")} className="rounded-2xl border border-white/10 bg-[#10172a] px-4 py-3 text-sm outline-none"><option value="popular">Most chosen</option><option value="az">A-Z</option></select></div>
              <div className="mt-4 flex gap-2"><input value={newProductName} onChange={(event) => setNewProductName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addProduct()} placeholder="Add product" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/40" /><button onClick={addProduct} className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black"><Plus size={18} /></button></div>
              <div className="mt-8 space-y-3">{sortedProducts.map((product, index) => { const selected = shoppingList.includes(product.name); return <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${selected ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}><button onClick={() => toggleItem(product.name)} className="flex flex-1 items-center gap-3 text-left"><div className={`h-4 w-4 rounded-full ${selected ? "bg-cyan-300" : "bg-white/20"}`} /><span>{product.name}</span><span className="ml-auto pr-3 text-xs text-white/40">{product.usageCount}x</span></button><button onClick={() => removeProduct(product.id)} className="rounded-full bg-red-500/10 p-2 text-red-300"><Trash2 size={15} /></button></motion.div>; })}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0b1020]/95 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between"><div><h2 className="text-3xl font-bold">History</h2><p className="mt-1 text-sm text-white/50">Reload an exported list and export again.</p></div><button onClick={() => setHistoryOpen(false)} className="rounded-2xl bg-white/10 p-3"><X size={18} /></button></div>
              <div className="mt-6 max-h-[55vh] space-y-3 overflow-auto">{history.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">No exported lists yet.</p>}{history.map((entry) => <button key={entry.id} onClick={() => { setShoppingList(entry.items); setHistoryOpen(false); }} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"><div className="font-medium">{new Date(entry.createdAt).toLocaleString()}</div><div className="mt-1 text-sm text-white/50">{entry.items.length} items · Tap to reload</div></button>)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
