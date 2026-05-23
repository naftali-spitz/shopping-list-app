import { Sparkles } from "lucide-react";

import { CategoryCard } from "@/components/category-card";
import { Category } from "@/types/shopping";

type CategoriesSectionProps = {
  cardClass: string;
  categories: Category[];
  darkMode: boolean;
  newCategoryName: string;
  onAddCategory: () => void;
  onCategoryNameChange: (value: string) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onOpenCategory: (categoryId: string) => void;
};

export function CategoriesSection({
  cardClass,
  categories,
  darkMode,
  newCategoryName,
  onAddCategory,
  onCategoryNameChange,
  onDeleteCategory,
  onOpenCategory,
}: CategoriesSectionProps) {
  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="text-cyan-300" />
          <h2 className="text-3xl font-bold">בחר קטגוריה</h2>
        </div>

        <div
          className={`flex gap-2 rounded-3xl border p-2 backdrop-blur-xl ${cardClass}`}
        >
          <input
            value={newCategoryName}
            onChange={(e) => onCategoryNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddCategory()}
            placeholder="הוסף קטגוריה"
            className="w-40 bg-transparent px-3 text-sm outline-none placeholder:opacity-50"
          />

          <button
            onClick={onAddCategory}
            className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-black"
          >
            הוסף
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            index={index}
            cardClass={cardClass}
            darkMode={darkMode}
            onOpen={() => onOpenCategory(category.id)}
            onDelete={() =>
              onDeleteCategory(category.id, category.name)
            }
          />
        ))}
      </div>
    </section>
  );
}
