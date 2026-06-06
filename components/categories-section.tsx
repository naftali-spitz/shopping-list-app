import { Sparkles } from "lucide-react";

import { CategoryCard } from "@/components/category-card";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { CategoryIcon } from "@/lib/category-icons";
import { AppCopy } from "@/lib/i18n";
import { Category } from "@/types/shopping";

type CategoriesSectionProps = {
  copy: AppCopy;
  cardClass: string;
  categories: Category[];
  darkMode: boolean;
  newCategoryName: string;
  newCategoryIcon: CategoryIcon;
  onAddCategory: () => void;
  onCategoryNameChange: (value: string) => void;
  onCategoryIconChange: (icon: CategoryIcon) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onOpenCategory: (categoryId: string) => void;
};

export function CategoriesSection({
  copy,
  cardClass,
  categories,
  darkMode,
  newCategoryName,
  newCategoryIcon,
  onAddCategory,
  onCategoryNameChange,
  onCategoryIconChange,
  onDeleteCategory,
  onOpenCategory,
}: CategoriesSectionProps) {
  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="text-cyan-300" />
          <h2 className="text-3xl font-bold">{copy.categories.chooseCategory}</h2>
        </div>

        <div className={`w-full rounded-3xl border p-3 backdrop-blur-xl sm:w-auto ${cardClass}`}>
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => onCategoryNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddCategory()}
              placeholder={copy.categories.addCategoryPlaceholder}
              dir="auto"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:opacity-50 sm:w-48"
            />

            <button
              onClick={onAddCategory}
              className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-black"
            >
              {copy.common.add}
            </button>
          </div>

          <div className="mt-3 max-w-sm">
            <CategoryIconPicker
              value={newCategoryIcon}
              onChange={onCategoryIconChange}
              label={copy.categories.iconLabel ?? "Icon"}
            />
          </div>
        </div>
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
