import {
  Apple,
  Baby,
  Beef,
  Coffee,
  Cookie,
  Droplets,
  Egg,
  HeartHandshake,
  LucideIcon,
  Milk,
  PackagePlus,
  Sandwich,
  ShoppingCart,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";

export const categoryIconOptions = [
  { value: "general", label: "General", Icon: PackagePlus },
  { value: "dairy", label: "Dairy", Icon: Milk },
  { value: "fruit", label: "Fruit", Icon: Apple },
  { value: "bakery", label: "Bakery", Icon: Sandwich },
  { value: "meat", label: "Meat", Icon: Beef },
  { value: "eggs", label: "Eggs", Icon: Egg },
  { value: "grains", label: "Grains", Icon: Wheat },
  { value: "cans", label: "Cans", Icon: Soup },
  { value: "spices", label: "Spices", Icon: UtensilsCrossed },
  { value: "sauces", label: "Sauces", Icon: Droplets },
  { value: "drinks", label: "Drinks", Icon: Coffee },
  { value: "snacks", label: "Snacks", Icon: Cookie },
  { value: "cleaning", label: "Cleaning", Icon: Sparkles },
  { value: "baby", label: "Baby", Icon: Baby },
  { value: "beauty", label: "Beauty", Icon: HeartHandshake },
] as const;

export type CategoryIcon = (typeof categoryIconOptions)[number]["value"];

export const DEFAULT_CATEGORY_ICON: CategoryIcon = "general";

export function isCategoryIcon(value: unknown): value is CategoryIcon {
  return (
    typeof value === "string" &&
    categoryIconOptions.some((option) => option.value === value)
  );
}

export function normalizeCategoryIcon(value: unknown): CategoryIcon {
  return isCategoryIcon(value) ? value : DEFAULT_CATEGORY_ICON;
}

export function getCategoryIconComponent(value: unknown): LucideIcon {
  return (
    categoryIconOptions.find((option) => option.value === value)?.Icon ??
    ShoppingCart
  );
}
