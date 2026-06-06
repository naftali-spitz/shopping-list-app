export const appLanguages = ["he", "en"] as const;

export type AppLanguage = (typeof appLanguages)[number];
export type AppDirection = "rtl" | "ltr";

export const DEFAULT_APP_LANGUAGE: AppLanguage = "he";
export const APP_LANGUAGE_STORAGE_KEY = "futurecart.appLanguage";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && appLanguages.includes(value as AppLanguage);
}

export function getAppDirection(language: AppLanguage): AppDirection {
  return language === "he" ? "rtl" : "ltr";
}

export function getBrowserDefaultLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return DEFAULT_APP_LANGUAGE;

  const browserLanguage = navigator.language.toLowerCase();

  if (browserLanguage.startsWith("en")) return "en";
  if (browserLanguage.startsWith("he") || browserLanguage.startsWith("iw")) return "he";

  return DEFAULT_APP_LANGUAGE;
}

const heIconLabels = {
  general: "כללי",
  dairy: "מוצרי חלב",
  fruit: "פירות וירקות",
  bakery: "מאפייה",
  meat: "בשר",
  eggs: "ביצים",
  grains: "יבשים ודגנים",
  cans: "שימורים",
  spices: "תבלינים",
  sauces: "רטבים",
  drinks: "שתייה",
  snacks: "חטיפים",
  cleaning: "ניקיון",
  baby: "תינוקות",
  beauty: "טיפוח",
} as const;

const enIconLabels = {
  general: "General",
  dairy: "Dairy",
  fruit: "Fruit & veg",
  bakery: "Bakery",
  meat: "Meat",
  eggs: "Eggs",
  grains: "Grains",
  cans: "Cans",
  spices: "Spices",
  sauces: "Sauces",
  drinks: "Drinks",
  snacks: "Snacks",
  cleaning: "Cleaning",
  baby: "Baby",
  beauty: "Beauty",
} as const;

export const appCopy = {
  he: {
    language: { label: "שפה", options: { he: "עברית", en: "English" } },
    auth: { loginWithGoogle: "התחברות עם Google", useDifferentGoogleAccount: "השתמש בחשבון Google אחר" },
    login: { title: "FutureCart", subtitle: "רשימת קניות חכמה למשפחה", intro: "בחר שפה והתחבר כדי להמשיך." },
    topBar: { title: "FutureCart", subtitle: "עוזר קניות חכם", openHistory: "פתח היסטוריה", openMenu: "פתח תפריט והגדרות" },
    common: { close: "סגור", cancel: "ביטול", save: "שמור", delete: "מחק", create: "צור", add: "הוסף", back: "חזרה", change: "שנה", clear: "נקה", selectAll: "בחר הכל", unknownUser: "משתמש לא ידוע", doneTitle: "בוצע" },
    categories: { chooseCategory: "בחר קטגוריה", addCategoryPlaceholder: "שם קטגוריה", emptyCategory: "אין מוצרים בקטגוריה", createCategory: "קטגוריה חדשה", createCategoryDescription: "בחר שם ואייקון שיופיעו במסך הראשי.", editCategory: "עריכת קטגוריה", editCategoryDescription: "שנה שם או אייקון קטגוריה בצורה בטוחה.", categoryName: "שם קטגוריה", iconLabel: "אייקון", deleteCategory: "מחק קטגוריה", iconLabels: heIconLabels },
    categoryModal: { description: "מיין, הוסף, הסר ובחר מוצרים.", searchPlaceholder: "חיפוש מוצרים", sortPopular: "הכי נבחרים", sortAz: "א-ת / A-Z", sortCustom: "סדר מותאם", clearSearchToReorder: "נקה את החיפוש כדי לסדר מוצרים מחדש.", addProductPlaceholder: "הוסף מוצר", reorderProduct: "סדר מוצר מחדש", dragToReorder: "גרור כדי לסדר מחדש", clearSearchToReorderTitle: "נקה חיפוש כדי לסדר מחדש" },
    products: { editProduct: "עריכת מוצר", editProductDescription: "ערוך או מחק מוצר בצורה בטוחה.", productName: "שם מוצר", category: "קטגוריה", deleteProduct: "מחק מוצר" },
    search: { placeholder: "חיפוש מהיר להוספה לרשימה...", clearSearch: "נקה חיפוש", noResults: "לא נמצאו תוצאות", addMissing: (name: string) => `הוסף “${name}”` },
    shoppingDrawer: { title: "רשימת קניות", itemCount: (count: number) => `${count} מוצרים`, itemsInList: (count: number) => `${count} מוצרים ברשימה`, empty: "הרשימה ריקה כרגע.", exportDoc: "ייצא מסמך", removeItem: (name: string) => `הסר ${name}`, increaseItem: (name: string) => `הגדל כמות של ${name}`, decreaseItem: (name: string) => `הקטן כמות של ${name}` },
    history: { title: "היסטוריה", subtitle: "עיין בייצואים קודמים ושחזר פריטים נבחרים.", empty: "אין רשימות שיוצאו עדיין.", itemPreview: (count: number) => `${count} פריטים · הקש לתצוגה מקדימה`, selected: (count: number) => `${count} נבחרו`, addSelected: "הוסף נבחרים", deleteList: "מחק רשימת היסטוריה", deleteTitle: "למחוק רשימת היסטוריה?", deleteDescription: "הפעולה תסיר את הרשימה מההיסטוריה ותחשב מחדש את ספירת המוצרים לפי ההיסטוריה שנותרה.", deleting: "מוחק", itemCount: (count: number) => `${count} פריטים` },
    household: { welcome: "ברוכים הבאים ל-FutureCart", choose: "בחר בית", noHousehold: (email?: string | null) => email ? `${email} מחובר, אבל עדיין לא משויך לבית.` : "אתה מחובר, אבל עדיין לא משויך לבית.", inviteHelp: "אם משפחה או חברים כבר משתמשים באפליקציה, בקש מהם לפתוח תפריט/הגדרות ולשלוח לך קישור הזמנה. פתח את הקישור, התחבר עם Google ותצטרף לבית שלהם.", createNew: "צור בית חדש", createTitle: "יצירת בית", createDescription: "התחל רשימת קניות משותפת נפרדת.", nameLabel: "שם הבית", namePlaceholder: "הבית שלי", defaultName: "הבית שלי", current: "הבית הנוכחי", noActive: "אין בית פעיל", active: "בית פעיל", switchTo: "עבור אל", invite: "הזמנה", copyLink: "העתק קישור", newHousehold: "בית חדש", separateList: "רשימה נפרדת", deleteHousehold: "מחק בית", deleteAllowed: "מוחק לצמיתות את הבית הזה", deleteOwnerOnly: "רק בעל הבית יכול למחוק אותו", deleteTitle: "למחוק בית?", deleteDescription: (name: string) => `הפעולה תמחק לצמיתות את ${name}, כולל קטגוריות, מוצרים, רשימת קניות, היסטוריה, חברים וקישורי הזמנה. אי אפשר לבטל את הפעולה.`, inviteCopied: "קישור ההזמנה הועתק. אפשר לשלוח אותו למשפחה או חברים.", inviteCopiedTitle: "קישור הועתק", inviteReady: "קישור ההזמנה נוצר.", inviteReadyTitle: "קישור מוכן", joined: (name: string) => `הצטרפת לבית ${name}.`, joinedTitle: "ההזמנה התקבלה" },
    profile: { title: "תפריט", subtitle: "בתים והגדרות", signedIn: "מחובר כ-", preferences: "העדפות", preferencesSubtitle: "אישיות למכשיר הזה", theme: "ערכת נושא", darkMode: "מצב כהה", lightMode: "מצב בהיר", sound: "צלילים", enabled: "פעיל", disabled: "כבוי", logout: "התנתקות", logoutDescription: "יציאה מהחשבון הזה" },
    missingProduct: { title: "הוספת מוצר חדש", description: "בחר קטגוריה ונוסיף את המוצר ישירות לרשימת הקניות.", productName: "שם המוצר", category: "קטגוריה", chooseCategory: "בחר קטגוריה", addToList: "הוסף לרשימה" },
    errors: { noActiveHousehold: "לא נמצא בית פעיל.", inviteMissingHousehold: "לא נמצא בית פעיל להזמנה.", logoutFailed: "ההתנתקות נכשלה.", orderSaveFailed: "שמירת סדר המוצרים נכשלה." },
  },
  en: {
    language: { label: "Language", options: { he: "עברית", en: "English" } },
    auth: { loginWithGoogle: "Login with Google", useDifferentGoogleAccount: "Use a different Google account" },
    login: { title: "FutureCart", subtitle: "Smart shopping list for the family", intro: "Choose a language and sign in to continue." },
    topBar: { title: "FutureCart", subtitle: "Smart shopping companion", openHistory: "Open history", openMenu: "Open menu and settings" },
    common: { close: "Close", cancel: "Cancel", save: "Save", delete: "Delete", create: "Create", add: "Add", back: "Back", change: "Change", clear: "Clear", selectAll: "Select all", unknownUser: "Unknown user", doneTitle: "Done" },
    categories: { chooseCategory: "Choose category", addCategoryPlaceholder: "Category name", emptyCategory: "No products in this category", createCategory: "New category", createCategoryDescription: "Choose the name and icon that will appear on the main screen.", editCategory: "Edit category", editCategoryDescription: "Safely rename or change this category icon.", categoryName: "Category name", iconLabel: "Icon", deleteCategory: "Delete category", iconLabels: enIconLabels },
    categoryModal: { description: "Sort, add, remove, and choose products.", searchPlaceholder: "Search products", sortPopular: "Most chosen", sortAz: "A-Z", sortCustom: "Custom", clearSearchToReorder: "Clear search to reorder products.", addProductPlaceholder: "Add product", reorderProduct: "Reorder product", dragToReorder: "Drag to reorder", clearSearchToReorderTitle: "Clear search to reorder" },
    products: { editProduct: "Edit product", editProductDescription: "Safely edit or delete this product.", productName: "Product name", category: "Category", deleteProduct: "Delete product" },
    search: { placeholder: "Quick search to add to the list...", clearSearch: "Clear search", noResults: "No results found", addMissing: (name: string) => `Add “${name}”` },
    shoppingDrawer: { title: "Shopping list", itemCount: (count: number) => `${count} products`, itemsInList: (count: number) => `${count} products in list`, empty: "The list is currently empty.", exportDoc: "Export document", removeItem: (name: string) => `Remove ${name}`, increaseItem: (name: string) => `Increase ${name}`, decreaseItem: (name: string) => `Decrease ${name}` },
    history: { title: "History", subtitle: "Browse previous exports and restore selected items.", empty: "No exported lists yet.", itemPreview: (count: number) => `${count} items · Tap to preview`, selected: (count: number) => `${count} selected`, addSelected: "Add selected", deleteList: "Delete history list", deleteTitle: "Delete history list?", deleteDescription: "This will remove the exported list from history and recalculate product counts from the remaining history.", deleting: "Deleting", itemCount: (count: number) => `${count} items` },
    household: { welcome: "Welcome to FutureCart", choose: "Choose your household", noHousehold: (email?: string | null) => email ? `${email} is signed in, but it is not connected to a household yet.` : "You are signed in, but not connected to a household yet.", inviteHelp: "If family or friends already use this app, ask them to open Menu/Settings and send you an invite link. Open that link, login with Google, and you will join their household.", createNew: "Create new household", createTitle: "Create household", createDescription: "Start a separate shared shopping list.", nameLabel: "Household name", namePlaceholder: "My household", defaultName: "My household", current: "Current household", noActive: "No active household", active: "Active household", switchTo: "Switch to", invite: "Invite", copyLink: "Copy link", newHousehold: "New household", separateList: "Separate list", deleteHousehold: "Delete household", deleteAllowed: "Permanently removes this household", deleteOwnerOnly: "Only the owner can delete this household", deleteTitle: "Delete household?", deleteDescription: (name: string) => `This will permanently delete ${name}, including its categories, products, shopping list, history, members, and invite links. This cannot be undone.`, inviteCopied: "The invite link was copied. You can send it to family or friends.", inviteCopiedTitle: "Link copied", inviteReady: "The invite link was created.", inviteReadyTitle: "Link ready", joined: (name: string) => `You joined ${name}.`, joinedTitle: "Invite accepted" },
    profile: { title: "Menu", subtitle: "Households and settings", signedIn: "Signed in", preferences: "Preferences", preferencesSubtitle: "Personal to this device", theme: "Theme", darkMode: "Dark mode", lightMode: "Light mode", sound: "Sound", enabled: "Enabled", disabled: "Disabled", logout: "Logout", logoutDescription: "Sign out of this account" },
    missingProduct: { title: "Add new product", description: "Choose a category and we will add the product directly to the shopping list.", productName: "Product name", category: "Category", chooseCategory: "Choose category", addToList: "Add to list" },
    errors: { noActiveHousehold: "No active household found.", inviteMissingHousehold: "No active household found for the invite.", logoutFailed: "Logout failed.", orderSaveFailed: "Saving product order failed." },
  },
} as const;

export type AppCopy = (typeof appCopy)[AppLanguage];
