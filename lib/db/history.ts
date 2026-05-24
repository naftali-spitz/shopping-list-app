import { HOUSEHOLD_ID } from "@/lib/constants";
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

export async function exportShoppingList() {
  return supabase.rpc("export_shopping_list", {
    p_household_id: HOUSEHOLD_ID,
  });
}
