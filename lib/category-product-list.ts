import { Product } from "@/types/shopping";

export type ProductSortMode = "az" | "popular" | "custom";

export function buildCategoryProductList(
  products: Product[],
  searchTerm: string,
  sortMode: ProductSortMode
) {
  const normalizedSearchTerm = searchTerm.toLowerCase();

  return [...products]
    .filter((product) =>
      product.name.toLowerCase().includes(normalizedSearchTerm)
    )
    .sort((firstProduct, secondProduct) => {
      if (sortMode === "az") {
        return firstProduct.name.localeCompare(secondProduct.name);
      }

      if (sortMode === "custom") {
        const firstOrder = firstProduct.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = secondProduct.displayOrder ?? Number.MAX_SAFE_INTEGER;

        if (firstOrder !== secondOrder) {
          return firstOrder - secondOrder;
        }

        return firstProduct.name.localeCompare(secondProduct.name);
      }

      return (
        secondProduct.usageCount - firstProduct.usageCount ||
        firstProduct.name.localeCompare(secondProduct.name)
      );
    });
}
