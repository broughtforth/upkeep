"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-data";

const ORG_DOMAIN = (process.env.NEXT_PUBLIC_ORG_DOMAIN ?? "")
  .toLowerCase()
  .replace(/^@/, "");

// Google (Workspace) sign-in. Access is decided after the redirect, in
// AppRoot, by the account's email (admin email -> admin view; org-domain
// email -> user view; anything else -> not authorised).
export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Surface OAuth errors that Supabase appends to the redirect URL (query or
  // hash) so a failed sign-in shows a message instead of silently looping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromBoth = (key: string) => {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      return q.get(key) ?? h.get(key);
    };
    const desc = fromBoth("error_description") ?? fromBoth("error");
    if (desc) {
      setError(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
        // hd hints Google to the org workspace; real enforcement is the
        // email-domain check in AppRoot.
        queryParams: {
          prompt: "select_account",
          ...(ORG_DOMAIN ? { hd: ORG_DOMAIN } : {}),
        },
      },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
    // On success the browser redirects to Google and back.
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--primary)]">
          Upkeep
        </h1>
        <p className="mb-8 mt-1 text-[15px] font-medium text-[var(--muted)]">
          Sign in with your{ORG_DOMAIN ? ` ${ORG_DOMAIN}` : " organisation"} account
        </p>

        <div className="blocky-card flex flex-col gap-4 p-6">
          <button
            onClick={signIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--foreground)] bg-[var(--surface)] px-6 py-3 text-[15px] font-bold text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:opacity-50"
          >
            <GoogleMark />
            {busy ? "Redirecting…" : "Continue with Google"}
          </button>

          {error && (
            <p className="text-[13px] font-medium text-[var(--danger)]">{error}</p>
          )}

          <p className="text-center text-[12px] text-[var(--muted)]">
            Use your organisation Google account.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
