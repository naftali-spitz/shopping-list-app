"use client";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { configureShoppingBackend, currentShoppingBackend, subscribeShoppingBackend, type ShoppingBackend } from "@/lib/backend/selection";
import { LoadingScreen } from "@/components/loading-screen";

export function BackendProvider({ backend, children }: { backend: ShoppingBackend; children: ReactNode }) {
  const selected = useSyncExternalStore(subscribeShoppingBackend, currentShoppingBackend, () => null);
  useEffect(() => {
    configureShoppingBackend(backend);
  }, [backend]);
  return selected === backend ? children : <LoadingScreen />;
}
