"use client";

import { supabase } from "@/lib/supabase";

export function AuthButton() {
  const login = async () => {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}${window.location.search}`
        : undefined;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  };

  return (
    <button
      onClick={login}
      className="rounded-2xl bg-cyan-400 px-4 py-2 font-medium text-black"
    >
      Login with Google
    </button>
  );
}
