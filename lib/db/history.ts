import { homeBackendEnabled } from "@/lib/backend/selection";
import { homeClient, homeHistory, homeMutation } from "@/lib/backend/home";
import { supabase } from "@/lib/supabase";

export async function fetchHistory(householdId: string) {
  if (homeBackendEnabled()) return homeHistory(householdId);
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
  if (homeBackendEnabled()) return { error: new Error("History is created atomically by export."), data: null };
  return supabase.from("shopping_history").insert({
    household_id: householdId,
    items,
  });
}

export async function exportShoppingList(householdId: string) {
  if (homeBackendEnabled()) return homeMutation(householdId, "list.export", { history_id: crypto.randomUUID() });
  return supabase.rpc("export_shopping_list", {
    p_household_id: householdId,
  });
}

export async function deleteShoppingHistoryEntry(
  householdId: string,
  historyId: string
) {
  if (homeBackendEnabled()) return homeMutation(householdId, "history.delete", { id: historyId });
  return supabase.rpc("delete_shopping_history_entry", {
    p_household_id: householdId,
    p_history_id: historyId,
  });
}

export async function addProductsToShoppingList(
  householdId: string,
  productNames: string[]
) {
  if (homeBackendEnabled()) {
    try {
      const snapshot = await (await homeClient(householdId)).read();
      const names = new Set(productNames.map(name => name.replace(/ ×[0-9.]+$/, "")));
      return homeMutation(householdId, "list.restore", { product_ids: snapshot.products.filter(p => names.has(p.name)).map(p => p.id) });
    } catch (error) { return { data: null, error: error as Error }; }
  }
  return supabase.rpc("add_products_to_shopping_list", {
    p_household_id: householdId,
    p_product_names: productNames,
  });
}
