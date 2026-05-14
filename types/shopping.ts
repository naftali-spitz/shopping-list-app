export type Product = {
  id: string;
  name: string;
  usageCount: number;
};

export type Category = {
  id: string;
  name: string;
  icon: "dairy" | "fruit" | "bakery" | "general";
  products: Product[];
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  items: string[];
};
