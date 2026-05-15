import { supabase } from "@/lib/supabase";
import { Category } from "@/types/shopping";

export async function fetchCategories(
  householdId: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, products(*)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error(error);
    return [];
  }

  return data.map((category: any) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    products: (category.products || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      usageCount: product.usage_count || 0,
    })),
  }));
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
