import { Plus, Sparkles } from "lucide-react";

import { CategoryCard } from "@/components/category-card";
import { AppCopy } from "@/lib/i18n";
import { Category } from "@/types/shopping";

type CategoriesSectionProps = {
  copy: AppCopy;
  cardClass: string;
  categories: Category[];
  darkMode: boolean;
  onCreateCategory: () => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onOpenCategory: (categoryId: string) => void;
};

export function CategoriesSection({
  copy,
  cardClass,
  categories,
  darkMode,
  onCreateCategory,
  onDeleteCategory,
  onOpenCategory,
}: CategoriesSectionProps) {
  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="text-cyan-300" />
          <h2 className="text-3xl font-bold">{copy.categories.chooseCategory}</h2>
        </div>

        <button
          onClick={onCreateCategory}
          className={`flex items-center gap-2 rounded-3xl border px-5 py-3 text-sm font-semibold backdrop-blur-xl transition hover:scale-[1.02] ${cardClass}`}
        >
          <Plus size={18} className="text-cyan-300" />
          {copy.categories.createCategory}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            copy={copy}
            category={category}
            index={index}
            cardClass={cardClass}
            darkMode={darkMode}
            onOpen={() => onOpenCategory(category.id)}
            onDelete={() => onDeleteCategory(category.id, category.name)}
          />
        ))}
      </div>
    </section>
  );
}
