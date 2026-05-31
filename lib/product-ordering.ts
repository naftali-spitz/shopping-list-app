import { Product } from "@/types/shopping";

const ORDER_STEP = 100;

export function getNewDisplayOrder(
  previousProduct: Product | null,
  nextProduct: Product | null
) {
  if (previousProduct && previousProduct.displayOrder === null) return null;
  if (nextProduct && nextProduct.displayOrder === null) return null;

  const previousOrder = previousProduct?.displayOrder ?? null;
  const nextOrder = nextProduct?.displayOrder ?? null;

  if (previousOrder === null && nextOrder === null) {
    return ORDER_STEP;
  }

  if (previousOrder === null) {
    return nextOrder! - ORDER_STEP;
  }

  if (nextOrder === null) {
    return previousOrder + ORDER_STEP;
  }

  const gap = nextOrder - previousOrder;

  if (gap > 1) {
    return Math.floor((previousOrder + nextOrder) / 2);
  }

  return null;
}

export function buildBalancedDisplayOrder(products: Product[]) {
  return products.map((product, index) => ({
    id: product.id,
    displayOrder: (index + 1) * ORDER_STEP,
  }));
}
