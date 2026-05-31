import { Category } from "@/types/shopping";

export function buildShoppingExportCategories(categories: Category[]) {
  return categories
    .map((category) => ({
      name: category.name,
      items: category.products
        .filter((product) => product.checked)
        .map((product) => ({
          name: product.name,
          quantity: product.quantity,
        })),
    }))
    .filter((category) => category.items.length > 0);
}
