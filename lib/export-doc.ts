import { Category, Product } from "@/types/shopping";

type ExportItem = Pick<Product, "name" | "quantity">;

type ExportCategory = {
  name: Category["name"];
  items: ExportItem[];
};

export async function exportShoppingDoc(categories: ExportCategory[]) {
  const nonEmptyCategories = categories.filter((category) => category.items.length > 0);

  if (!nonEmptyCategories.length) {
    return null;
  }

  const createdAt = new Date().toISOString();

  const response = await fetch("/api/export-doc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      categories: nonEmptyCategories.map((category) => ({
        name: category.name,
        items: category.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to export document");
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `shopping-list-${createdAt.slice(0, 10)}.docx`;
  link.click();

  URL.revokeObjectURL(url);

  return createdAt;
}
