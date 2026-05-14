import { Category, HistoryEntry } from "@/types/shopping";

const CATEGORY_KEY = "futurecart-categories";
const LIST_KEY = "futurecart-list";
const HISTORY_KEY = "futurecart-history";

export function loadCategories(): Category[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(CATEGORY_KEY);

  return value ? JSON.parse(value) : null;
}

export function saveCategories(categories: Category[]) {
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
}

export function loadShoppingList(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(LIST_KEY);

  return value ? JSON.parse(value) : null;
}

export function saveShoppingList(items: string[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(items));
}

export function loadHistory(): HistoryEntry[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(HISTORY_KEY);

  return value ? JSON.parse(value) : null;
}

export function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
