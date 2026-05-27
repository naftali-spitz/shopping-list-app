import { supabase } from "@/lib/supabase";

export async function createProduct(categoryId: string, name: string) {
  return supabase.from("products").insert({
    category_id: categoryId,
    name,
    quantity: 1,
  });
}

export async function updateProduct(
  productId: string,
  name: string,
  categoryId: string
) {
  return supabase
    .from("products")
    .update({
      name,
      category_id: categoryId,
    })
    .eq("id", productId);
}

export async function deleteProduct(productId: string) {
  return supabase.from("products").delete().eq("id", productId);
}

export async function updateProductChecked(
  productId: string,
  checked: boolean
) {
  return supabase
    .from("products")
    .update({ checked })
    .eq("id", productId);
}

export async function updateProductQuantity(
  productId: string,
  quantity: number
) {
  return supabase
    .from("products")
    .update({ quantity })
    .eq("id", productId);
}