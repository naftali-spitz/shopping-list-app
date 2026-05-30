import { supabase } from "@/lib/supabase";

export async function fetchHistory(householdId: string) {
  return supabase
    .from("shopping_history")
    .select("*")
    .eq("household_id", householdId)
    .order("exported_at", { ascending: false });
}

export async function createHistory(
  householdId: string,
  items: string[]
) {
  return supabase.from("shopping_history").insert({
    household_id: householdId,
    items,
  });
}

export async function exportShoppingList(householdId: string) {
  return supabase.rpc("export_shopping_list", {
    p_household_id: householdId,
  });
}

export async function deleteShoppingHistoryEntry(
  householdId: string,
  historyId: string
) {
  return supabase.rpc("delete_shopping_history_entry", {
    p_household_id: householdId,
    p_history_id: historyId,
  });
}

export async function addProductsToShoppingList(
  householdId: string,
  productNames: string[]
) {
  return supabase.rpc("add_products_to_shopping_list", {
    p_household_id: householdId,
    p_product_names: productNames,
  });
}
