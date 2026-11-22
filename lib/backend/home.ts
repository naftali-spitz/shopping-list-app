import { supabase } from "@/lib/supabase";
import { getShoppingClient, disposeShoppingClients } from "@/integration/stage3/client";
import { normalizeCategoryIcon } from "@/lib/category-icons";
import type { Category } from "@/types/shopping";

// Indexes select a locally cached record's household; PostgreSQL authorizes each
// command again. They are never an authorization source.
const recordHouseholds = new Map<string, string>();
let identity: string | null = null;

export async function homeClient(householdId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again.");
  if (identity !== session.user.id) {
    disposeShoppingClients();
    recordHouseholds.clear();
    identity = session.user.id;
  }
  return getShoppingClient(session.user.id, householdId ?? session.user.id);
}

export async function homeRecordClient(recordId: string) {
  const householdId = recordHouseholds.get(recordId);
  if (!householdId) throw new Error("Reload the list before editing this record.");
  return homeClient(householdId);
}

export async function homeCategories(householdId: string): Promise<Category[]> {
  const client = await homeClient(householdId);
  await client.read();
  const snapshot = client.view()!;
  return snapshot.categories
    .slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map(category => {
      recordHouseholds.set(category.id, householdId);
      return {
        id: category.id, name: category.name, icon: normalizeCategoryIcon(category.icon),
        products: snapshot.products.filter(product => product.category_id === category.id).map(product => {
          recordHouseholds.set(product.id, householdId);
          return {
            id: product.id, name: product.name, category_id: product.category_id,
            usageCount: Number(product.usage_count), checked: product.checked,
            quantity: Number(product.quantity), displayOrder: product.display_order,
          };
        }),
      };
    });
}

export async function homeHistory(householdId: string) {
  try {
    const client = await homeClient(householdId);
    const snapshot = await client.read();
    for (const entry of snapshot.shopping_history) recordHouseholds.set(entry.id, householdId);
    return { data: snapshot.shopping_history.slice().sort((a, b) => b.exported_at.localeCompare(a.exported_at)), error: null };
  } catch (error) { return { data: null, error: error as Error }; }
}

export async function homeMutation(householdId: string | undefined, type: string, payload: Record<string, unknown>, recordId?: string) {
  const started = performance.now();
  try {
    const client = recordId ? await homeRecordClient(recordId) : await homeClient(householdId);
    return await client.mutateLatest(type, payload, { started, identityReady: performance.now() });
  } catch (error) { return { data: null, error: error as Error }; }
}
