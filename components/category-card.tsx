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
  onOpen: () => void;
  onDelete: () => void;
};

export function CategoryCard({
  category,
  index,
  cardClass,
  onOpen,
  onDelete,
}: CategoryCardProps) {
  const Icon =
    iconMap[category.icon as keyof typeof iconMap] || ShoppingCart;

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
      {/* Hover Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Icon className="text-cyan-300" />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevents the card's onClick (onOpen) from firing when editing
              onDelete();
            }}
            className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300 opacity-70 transition hover:opacity-100 relative z-20"
          >
            <Pencil size={16} />
          </button>
        </div>

        <h3 className="text-2xl font-semibold">{category.name}</h3>

        <div className="mt-4 flex flex-wrap gap-2">
          {category.products.slice(0, 3).map((product) => (
            <span
              key={product.id}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm opacity-70"
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
