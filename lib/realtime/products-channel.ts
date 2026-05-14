import { supabase } from "@/lib/supabase";

export function subscribeToProducts(onChange: () => void) {
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
