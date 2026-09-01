"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-data";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { DashboardClient } from "@/components/DashboardClient";
import { UserApp } from "@/components/user/UserApp";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").toLowerCase();
const ORG_DOMAIN = (process.env.NEXT_PUBLIC_ORG_DOMAIN ?? "")
  .toLowerCase()
  .replace(/^@/, "");

type Access = "admin" | "resident" | "denied";

function accessFor(email: string | undefined | null): Access {
  const e = (email ?? "").toLowerCase();
  if (ADMIN_EMAIL && e === ADMIN_EMAIL) return "admin";
  if (ORG_DOMAIN && e.endsWith("@" + ORG_DOMAIN)) return "resident";
  return "denied";
}

// Root gate. No session -> Google login. With a session, route by the
// account's email: the admin email gets the 3D admin view; any org-domain
// email gets the user view (profile auto-provisioned by the handle_new_user
// trigger, keyed to the auth user id); everything else is rejected.
export function AppRoot() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profileId, setProfileId] = useState<string | null | undefined>(undefined);
  // Bypass auth when the URL contains ?dev=1 (or localStorage flag is set).
  // Lets us preview the admin view without Google login. Toggles by
  // visiting /?dev=1 once; clear with /?dev=0.
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("dev");
    if (flag === "1") {
      window.localStorage.setItem("upkeep:devBypass", "1");
      setDevBypass(true);
    } else if (flag === "0") {
      window.localStorage.removeItem("upkeep:devBypass");
      setDevBypass(false);
    } else {
      setDevBypass(window.localStorage.getItem("upkeep:devBypass") === "1");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setProfileId(undefined);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const access: Access = session ? accessFor(session.user.email) : "denied";

  // Resident: make sure a profile row exists (the DB trigger creates it on the
  // auth.users insert) and grab its id. Match by id = auth user id. Retry a
  // couple of times in case the trigger insert hasn't propagated yet.
  useEffect(() => {
    if (session === undefined) return;
    if (!session || access !== "resident") {
      setProfileId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.id) {
          setProfileId(data.id);
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!cancelled) setProfileId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, access]);

  // Best-effort: label the admin's auto-created profile as admin so they read
  // as ADMIN (not a free resident) in the people list.
  useEffect(() => {
    if (session && access === "admin") {
      void supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", session.user.id);
    }
  }, [session, access]);

  const signOut = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("upkeep:devBypass");
    }
    void supabase.auth.signOut();
  };

  if (session === undefined) return <Splash />;

  // Dev bypass: jump straight into the admin view without auth.
  if (devBypass) return <DashboardClient onSignOut={signOut} />;

  if (!session) return <LoginScreen />;

  if (access === "admin") return <DashboardClient onSignOut={signOut} />;

  if (access === "denied") {
    return (
      <Notice
        title="Not authorised"
        body={`${session.user.email ?? "This account"} isn't allowed in. Sign in with your organisation Google account.`}
        onSignOut={signOut}
      />
    );
  }

  // resident
  if (profileId === undefined) return <Splash />;
  if (!profileId) {
    return (
      <Notice
        title="Couldn't set up your profile"
        body="Try signing in again. If this keeps happening, contact your admin."
        onSignOut={signOut}
      />
    );
  }
  return <UserApp currentUserId={profileId} onSignOut={signOut} />;
}

function Splash() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <span className="text-[14px] font-medium text-[var(--muted)]">Loading…</span>
    </main>
  );
}

function Notice({
  title,
  body,
  onSignOut,
}: {
  title: string;
  body: string;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] px-6 text-center">
      <p className="text-2xl font-bold tracking-tight">{title}</p>
      <p className="max-w-sm text-[14px] text-[var(--muted)]">{body}</p>
      <button onClick={onSignOut} className="btn-pill-ghost mt-2">
        Sign out
      </button>
    </main>
  );
}
