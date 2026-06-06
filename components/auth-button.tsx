"use client";

import { supabase } from "@/lib/supabase";

type AuthButtonProps = {
  label: string;
  variant?: "primary" | "secondary";
};

export function AuthButton({
  label,
  variant = "primary",
}: AuthButtonProps) {
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
      className={
        variant === "primary"
          ? "rounded-2xl bg-cyan-400 px-4 py-2 font-medium text-black"
          : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
      }
    >
      {label}
    </button>
  );
}
