// Trusted starter defaults shared by the existing UI and transactional Debian seed.
const STARTER_TEMPLATES = {
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

export function getDefaultHouseholdTemplate(language) {
  if (!["he", "en"].includes(language)) throw new Error("invalid_template_language");
  return structuredClone(STARTER_TEMPLATES[language]);
}
