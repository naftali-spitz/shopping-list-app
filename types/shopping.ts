import { CategoryIcon } from "@/lib/category-icons";

export type Product = {
  id: string;
  name: string;
  usageCount: number;
  category_id: string;
  checked: boolean;
  quantity: number;
  displayOrder: number | null;
};

export type Category = {
  id: string;
  name: string;
  icon: CategoryIcon;
  products: Product[];
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  items: string[];
};
