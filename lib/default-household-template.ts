import type { CategoryIcon } from "@/lib/category-icons";
import { supabase } from "@/lib/supabase";

export type DefaultHouseholdLanguage = "he" | "en";

type StarterCategoryTemplate = {
  name: string;
  icon: CategoryIcon;
  products: string[];
};

const STARTER_TEMPLATES: Record<DefaultHouseholdLanguage, StarterCategoryTemplate[]> = {
  he: [
    {
      name: "מוצרי חלב",
      icon: "dairy",
      products: ["חלב", "גבינה לבנה", "גבינה צהובה", "יוגורט", "חמאה", "ביצים"],
    },
    {
      name: "פירות וירקות",
      icon: "fruit",
      products: ["עגבניות", "מלפפונים", "חסה", "תפוחים", "בננות", "תפוחי אדמה", "בצל"],
    },
    {
      name: "לחם ומאפים",
      icon: "bakery",
      products: ["לחם", "פיתות", "לחמניות", "חלות"],
    },
    {
      name: "מזווה",
      icon: "grains",
      products: ["אורז", "פסטה", "שמן", "סוכר", "קפה", "קמח"],
    },
    {
      name: "ניקיון",
      icon: "cleaning",
      products: ["נייר טואלט", "סבון כלים", "שקיות אשפה", "מגבונים"],
    },
  ],
  en: [
    {
      name: "Dairy",
      icon: "dairy",
      products: ["Milk", "White cheese", "Yellow cheese", "Yogurt", "Butter", "Eggs"],
    },
    {
      name: "Fruit & Vegetables",
      icon: "fruit",
      products: ["Tomatoes", "Cucumbers", "Lettuce", "Apples", "Bananas", "Potatoes", "Onions"],
    },
    {
      name: "Bakery",
      icon: "bakery",
      products: ["Bread", "Pita", "Rolls", "Challah"],
    },
    {
      name: "Pantry",
      icon: "grains",
      products: ["Rice", "Pasta", "Oil", "Sugar", "Coffee", "Flour"],
    },
    {
      name: "Cleaning",
      icon: "cleaning",
      products: ["Toilet paper", "Dish soap", "Trash bags", "Wipes"],
    },
  ],
};

export function getDefaultHouseholdTemplate(language: DefaultHouseholdLanguage) {
  return STARTER_TEMPLATES[language];
}

export async function seedDefaultHouseholdData(
  householdId: string,
  language: DefaultHouseholdLanguage
) {
  const template = getDefaultHouseholdTemplate(language);

  for (const category of template) {
    const { data: createdCategory, error: categoryError } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        name: category.name,
        icon: category.icon,
      })
      .select("id")
      .single();

    if (categoryError || !createdCategory) {
      return {
        error: categoryError ?? new Error("No category returned after insert"),
      };
    }

    const { error: productsError } = await supabase.from("products").insert(
      category.products.map((name, index) => ({
        category_id: createdCategory.id,
        name,
        checked: false,
        quantity: 1,
        display_order: (index + 1) * 1000,
      }))
    );

    if (productsError) {
      return { error: productsError };
    }
  }

  return { error: null };
}
