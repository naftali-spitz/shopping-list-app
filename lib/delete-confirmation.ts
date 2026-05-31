type PendingDelete =
  | { type: "category"; id: string; name: string; productCount: number }
  | { type: "product"; id: string; name: string };

export function getDeleteConfirmationCopy(pendingDelete: PendingDelete | null) {
  if (!pendingDelete) {
    return {
      confirmTitle: "",
      confirmDescription: "",
    };
  }

  if (pendingDelete.type === "category") {
    return {
      confirmTitle: "מחיקת קטגוריה?",
      confirmDescription: `הקטגוריה \"${pendingDelete.name}\" תימחק יחד עם ${pendingDelete.productCount} מוצרים. הפעולה לא ניתנת לביטול.`,
    };
  }

  return {
    confirmTitle: "מחיקת מוצר?",
    confirmDescription: `המוצר \"${pendingDelete.name}\" יימחק מהרשימה. הפעולה לא ניתנת לביטול.`,
  };
}
