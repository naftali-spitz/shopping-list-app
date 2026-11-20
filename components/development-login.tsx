"use client";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

/** Rendered only by the server-authorized experimental development app. */
export function DevelopmentLogin({ hebrew }: { hebrew: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      setPassword("");
      if (result.error) setError(hebrew ? "ההתחברות נכשלה." : "Sign-in failed.");
    } catch { setError(hebrew ? "ההתחברות נכשלה." : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={login} className="mt-5 space-y-3 text-start">
    <p className="text-xs text-white/60">{hebrew ? "חשבון בדיקה בפיתוח" : "Development test account"}</p>
    <label className="block text-sm">{hebrew ? "דוא״ל" : "Email"}<input aria-label="Email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 p-2" /></label>
    <label className="block text-sm">{hebrew ? "סיסמה" : "Password"}<input aria-label="Password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 p-2" /></label>
    <button disabled={busy} className="w-full rounded-xl bg-cyan-400 p-2 font-medium text-black disabled:opacity-50">{busy ? (hebrew ? "מתחבר…" : "Signing in…") : (hebrew ? "התחברות" : "Sign in")}</button>
    {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
  </form>;
}
