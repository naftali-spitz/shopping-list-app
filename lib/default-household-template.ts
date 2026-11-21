import { homeClient } from "@/lib/backend/home";
import { homeBackendEnabled } from "@/lib/backend/selection";
import { getDefaultHouseholdTemplate } from "@/integration/stage4/template.mjs";
import { supabase } from "@/lib/supabase";

export type DefaultHouseholdLanguage = "he" | "en";
export { getDefaultHouseholdTemplate };

export async function seedDefaultHouseholdData(
  householdId: string,
  language: DefaultHouseholdLanguage
) {
  if (homeBackendEnabled()) {
    const client = await homeClient(householdId);
    await client.read();
    return client.mutateLatest("household.seed", { language });
  }

  const template = getDefaultHouseholdTemplate(language);

  for (const category of template) {
    const { data: createdCategory, error: categoryError } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        name: category.name,
        icon: category.icon,
      })
      .select("id")
      .single();

    if (categoryError || !createdCategory) {
      return {
        error: categoryError ?? new Error("No category returned after insert"),
      };
    }

    const { error: productsError } = await supabase.from("products").insert(
      category.products.map((name, index) => ({
        category_id: createdCategory.id,
        name,
        checked: false,
        quantity: 1,
        display_order: (index + 1) * 1000,
      }))
    );

    if (productsError) {
      return { error: productsError };
    }
  }

  return { error: null };
}
