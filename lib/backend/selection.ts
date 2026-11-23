export type ShoppingBackend = "supabase" | "home";

// Browser-only selection supplied by the guarded server page, never storage or URL input.
let backend: ShoppingBackend | null = null;
const listeners = new Set<() => void>();
export function configureShoppingBackend(next: ShoppingBackend) {
  if (typeof window !== "undefined" && backend !== next) {
    backend = next;
    for (const listener of listeners) listener();
  }
}
export function homeBackendEnabled() { return backend === "home"; }
export function currentShoppingBackend() { return backend; }
export function subscribeShoppingBackend(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
