import { supabase } from "@/lib/supabase";
import { Category } from "@/types/shopping";

export async function fetchCategories(householdId: string) {
  return supabase
    .from("categories")
    .select("*, products(*)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
}

export async function createCategory(
  householdId: string,
  category: Pick<Category, "name" | "icon">
) {
  return supabase.from("categories").insert({
    household_id: householdId,
    name: category.name,
    icon: category.icon,
  });
}

export async function deleteCategory(categoryId: string) {
  return supabase.from("categories").delete().eq("id", categoryId);
}
