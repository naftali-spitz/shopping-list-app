"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Milk, Apple, Sandwich, Sparkles } from "lucide-react";

const categories = [
  {
    name: "Dairy",
    icon: Milk,
    items: ["Milk", "Cheese", "Butter"],
  },
  {
    name: "Fruits",
    icon: Apple,
    items: ["Bananas", "Apples", "Strawberries"],
  },
  {
    name: "Bakery",
    icon: Sandwich,
    items: ["Bread", "Bagels", "Croissants"],
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
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
              <p className="text-sm text-white/60">Smart shopping companion</p>
            </div>
          </div>

          <button className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm transition hover:bg-cyan-400/20">
            Export List
          </button>
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
                        {category.items.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-white/70"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <button className="mt-6 w-full rounded-2xl bg-white/10 py-3 text-sm transition hover:bg-white/20">
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
            className="h-fit w-full rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:w-[340px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Shopping List</h2>
              <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">
                6 Items
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Milk",
                "Bread",
                "Bananas",
                "Cheese",
                "Butter",
                "Strawberries",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span>{item}</span>
                  <div className="h-3 w-3 rounded-full bg-cyan-300" />
                </div>
              ))}
            </div>

            <button className="mt-6 w-full rounded-2xl bg-cyan-400 py-3 font-medium text-black transition hover:scale-[1.02]">
              Export DOC
            </button>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
