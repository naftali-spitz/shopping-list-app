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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="text-cyan-300" />
          <h2 className="text-3xl font-bold">{copy.categories.chooseCategory}</h2>
        </div>

        <div className={`flex w-full flex-wrap items-center gap-2 rounded-3xl border p-2 backdrop-blur-xl sm:w-auto ${cardClass}`}>
          <input
            value={newCategoryName}
            onChange={(e) => onCategoryNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddCategory()}
            placeholder={copy.categories.addCategoryPlaceholder}
            dir="auto"
            className="h-11 min-w-[150px] flex-1 bg-transparent px-3 text-sm outline-none placeholder:opacity-50 sm:w-44 sm:flex-none"
          />

          <div className="min-w-[155px] flex-1 sm:flex-none">
            <CategoryIconPicker
              value={newCategoryIcon}
              onChange={onCategoryIconChange}
              label={copy.categories.iconLabel}
              variant={darkMode ? "dark" : "light"}
            />
          </div>

          <button
            onClick={onAddCategory}
            className="h-11 rounded-2xl bg-cyan-400 px-4 text-sm font-medium text-black"
          >
            {copy.common.add}
          </button>
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
