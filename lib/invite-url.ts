export function getInviteTokenFromUrl() {
  if (typeof window === "undefined") return null;

  return new URLSearchParams(window.location.search).get("invite");
}

export function removeInviteTokenFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
