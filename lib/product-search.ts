import { Category } from "@/types/shopping";

export type GlobalProductSearchResult = {
  id: string;
  name: string;
  categoryName: string;
};

export function buildGlobalProductSearchResults(
  categories: Category[],
  searchTerm: string,
  limit = 8
): GlobalProductSearchResult[] {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) return [];

  return categories
    .flatMap((category) =>
      category.products.map((product) => ({
        ...product,
        categoryName: category.name,
      }))
    )
    .filter((product) =>
      product.name.toLowerCase().includes(normalizedSearchTerm)
    )
    .slice(0, limit);
}
