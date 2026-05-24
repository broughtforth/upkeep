// Tiny localStorage wrapper for "who is signed in on this browser".
// Mirrors the iOS app's getCurrentUserId / setCurrentUserId in storage.ts.

const KEY = "upkeep:current-user";

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setCurrentUserId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, id);
}
