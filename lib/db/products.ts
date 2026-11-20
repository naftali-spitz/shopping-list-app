import { homeBackendEnabled } from "@/lib/backend/selection";
import { homeMutation } from "@/lib/backend/home";
import { supabase } from "@/lib/supabase";

export async function createProduct(
  categoryId: string,
  name: string,
  options: { checked?: boolean } = {}
) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.create", { id: crypto.randomUUID(), category_id: categoryId, name, checked: options.checked ?? false, quantity: 1 }, categoryId);
  return supabase.from("products").insert({
    category_id: categoryId,
    name,
    checked: options.checked ?? false,
    quantity: 1,
  });
}

export async function updateProduct(
  productId: string,
  name: string,
  categoryId: string
) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.update", { id: productId, name, category_id: categoryId }, productId);
  return supabase
    .from("products")
    .update({
      name,
      category_id: categoryId,
    })
    .eq("id", productId);
}

export async function deleteProduct(productId: string) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.delete", { id: productId }, productId);
  return supabase.from("products").delete().eq("id", productId);
}

export async function updateProductChecked(
  productId: string,
  checked: boolean
) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.update", { id: productId, checked: checked }, productId);
  return supabase
    .from("products")
    .update({ checked })
    .eq("id", productId);
}

export async function updateProductQuantity(
  productId: string,
  quantity: number
) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.update", { id: productId, quantity: quantity }, productId);
  return supabase
    .from("products")
    .update({ quantity })
    .eq("id", productId);
}

export async function updateProductDisplayOrder(
  productId: string,
  displayOrder: number
) {
  if (homeBackendEnabled()) return homeMutation(undefined, "product.update", { id: productId, display_order: displayOrder }, productId);
  return supabase
    .from("products")
    .update({ display_order: displayOrder })
    .eq("id", productId);
}

export async function updateProductDisplayOrders(
  updates: { id: string; displayOrder: number }[]
) {
  const results = await Promise.all(
    updates.map((update) =>
      updateProductDisplayOrder(update.id, update.displayOrder)
    )
  );

  const failedResult = results.find((result) => result.error);

  return {
    error: failedResult?.error ?? null,
  };
}
