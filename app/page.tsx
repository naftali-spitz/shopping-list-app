"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingCart,
  Milk,
  Apple,
  Sandwich,
  Sparkles,
  X,
  Plus,
  Moon,
  Sun,
} from "lucide-react";

const categories = [
  {
    name: "Dairy",
    icon: Milk,
    items: ["Milk", "Cheese", "Butter", "Yogurt", "Cottage Cheese"],
  },
  {
    name: "Fruits",
    icon: Apple,
    items: ["Bananas", "Apples", "Strawberries", "Mango", "Grapes"],
  },
  {
    name: "Bakery",
    icon: Sandwich,
    items: ["Bread", "Bagels", "Croissants", "Pita", "Buns"],
  },
];

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<null | (typeof categories)[0]>(null);
  const [shoppingList, setShoppingList] = useState<string[]>([
    "Milk",
    "Bread",
  ]);
  const [darkMode, setDarkMode] = useState(true);

  const backgroundClass = useMemo(
    () =>
      darkMode
        ? "bg-[#050816] text-white"
        : "bg-[#f3f7ff] text-black",
    [darkMode]
  );

  const toggleItem = (item: string) => {
    setShoppingList((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  return (
    <main className={`relative min-h-screen overflow-hidden transition-all duration-500 ${backgroundClass}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/20">
              <ShoppingCart className="text-cyan-300" />
            </div>

            <div>
              <h1 className="text-xl font-semibold">FutureCart</h1>
              <p className="text-sm opacity-60">Smart shopping companion</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/20"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm transition hover:bg-cyan-400/20">
              Export List
            </button>
          </div>
        </header>

        <section className="mt-12 flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles className="text-cyan-300" />
              <h2 className="text-3xl font-bold">Choose Categories</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category, index) => {
                const Icon = category.icon;

                return (
                  <motion.div
                    key={category.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.03 }}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 opacity-0 transition duration-500 group-hover:opacity-100" />

                    <div className="relative z-10">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                        <Icon className="text-cyan-300" />
                      </div>

                      <h3 className="text-2xl font-semibold">{category.name}</h3>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {category.items.slice(0, 3).map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-70"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => setSelectedCategory(category)}
                        className="mt-6 w-full rounded-2xl bg-white/10 py-3 text-sm transition hover:bg-white/20"
                      >
                        Open Category
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-6 right-6 z-20 h-fit w-[320px] rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Shopping List</h2>
              <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">
                {shoppingList.length} Items
              </div>
            </div>

            <div className="mt-6 max-h-[320px] space-y-3 overflow-auto pr-2">
              {shoppingList.map((item) => (
                <motion.div
                  layout
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span>{item}</span>

                  <button
                    onClick={() => toggleItem(item)}
                    className="rounded-full bg-red-500/20 p-1 text-red-300"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>

            <button className="mt-6 w-full rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02]">
              Export DOC
            </button>
          </motion.div>
        </section>
      </div>

      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#0b1020]/90 p-8 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold">{selectedCategory.name}</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Frequently purchased products
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-8 space-y-3">
                {selectedCategory.items.map((item, index) => {
                  const selected = shoppingList.includes(item);

                  return (
                    <motion.button
                      key={item}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => toggleItem(item)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 transition ${
                        selected
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4 w-4 rounded-full ${
                            selected ? "bg-cyan-300" : "bg-white/20"
                          }`}
                        />

                        <span>{item}</span>
                      </div>

                      <Plus size={18} className="opacity-60" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
