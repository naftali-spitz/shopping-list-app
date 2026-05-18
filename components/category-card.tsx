"use client";

import { motion } from "framer-motion";
import {
  Apple,
  Baby,
  Beef,
  Coffee,
  Cookie,
  Droplets,
  Egg,
  HeartHandshake,
  Milk,
  PackagePlus,
  Pencil,
  Sandwich,
  ShoppingCart,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import { Category } from "@/types/shopping";

const iconMap = {
  dairy: Milk,
  fruit: Apple,
  bakery: Sandwich,
  meat: Beef,
  eggs: Egg,
  grains: Wheat,
  cans: Soup,
  spices: UtensilsCrossed,
  sauces: Droplets,
  drinks: Coffee,
  snacks: Cookie,
  cleaning: Sparkles,
  baby: Baby,
  beauty: HeartHandshake,
  general: PackagePlus,
};

type CategoryCardProps = {
  category: Category;
  index: number;
  cardClass: string;
  darkMode: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

export function CategoryCard({
  category,
  index,
  cardClass,
  darkMode,
  onOpen,
  onDelete,
}: CategoryCardProps) {
  const Icon =
    iconMap[category.icon as keyof typeof iconMap] || ShoppingCart;

  // FIX: icon and edit button use mode-aware colours
  const iconColor = darkMode ? "text-cyan-300" : "text-cyan-600";
  const iconBg    = darkMode ? "bg-white/10"   : "bg-cyan-100";
  const editBg    = darkMode
    ? "bg-cyan-500/10 text-cyan-300"
    : "bg-cyan-100 text-cyan-700";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl cursor-pointer text-right ${cardClass}`}
    >
      {/* Hover background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="relative z-10">
        {/* FIX: items-center so the pencil button is vertically aligned with the icon */}
        <div className="mb-4 flex items-center justify-between">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg}`}>
            <Icon className={iconColor} />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={`rounded-2xl p-2 opacity-70 transition hover:opacity-100 relative z-20 ${editBg}`}
          >
            <Pencil size={16} />
          </button>
        </div>

        <h3 className="text-2xl font-semibold">{category.name}</h3>

        <div className="mt-4 flex flex-wrap gap-2">
          {category.products.slice(0, 3).map((product) => (
            <span
              key={product.id}
              className={`rounded-full border px-3 py-1 text-sm opacity-70 ${
                darkMode
                  ? "border-white/10 bg-black/20"
                  : "border-slate-200 bg-slate-100"
              }`}
            >
              {product.name}
            </span>
          ))}
          {category.products.length === 0 && (
            <span className="text-sm opacity-40">אין מוצרים בקטגוריה</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}