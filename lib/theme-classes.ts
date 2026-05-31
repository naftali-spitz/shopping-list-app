export function getAppBackgroundClass(darkMode: boolean) {
  return darkMode
    ? "bg-[#050816] text-white"
    : "bg-[#f3f7ff] text-slate-950";
}

export function getCardClass(darkMode: boolean) {
  return darkMode
    ? "border-white/10 bg-white/5"
    : "border-slate-950/10 bg-white/70 text-slate-950";
}
