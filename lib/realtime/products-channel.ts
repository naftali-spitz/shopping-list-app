import { homeBackendEnabled } from "@/lib/backend/selection";
import { homeClient } from "@/lib/backend/home";
import { supabase } from "@/lib/supabase";

export function subscribeToProducts(onChange: () => void, householdId?: string) {
  if (homeBackendEnabled()) {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (householdId) void homeClient(householdId).then(client => {
      if (!cancelled) unsubscribe = client.subscribe(onChange);
    });
    return { unsubscribe() { cancelled = true; unsubscribe?.(); } };
  }
  return supabase
    .channel("products-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "products",
      },
      () => {
        onChange();
      }
    )
    .subscribe();
}
