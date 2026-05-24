"use client";

import { useEffect, useState } from "react";
import { supabase, type Profile } from "@/lib/supabase";
import { setCurrentUserId } from "@/lib/session";

type Props = {
  onPicked: () => void;
};

// "Who are you?" picker. Mirror of apps/mobile/src/screens/OnboardingScreen.tsx.
export function OnboardingScreen({ onPicked }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setProfiles([]);
        return;
      }
      setProfiles((data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = (id: string) => {
    setCurrentUserId(id);
    onPicked();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-2 px-6 py-10">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--primary)]">
        Upkeep
      </h1>
      <h2 className="mt-6 text-2xl font-bold tracking-tight">Who are you?</h2>
      <p className="mb-6 text-[15px] font-medium text-[var(--muted)]">
        Tap your name to see what&apos;s assigned to you.
      </p>

      {profiles === null && (
        <div className="py-8 text-center text-[14px] text-[var(--muted)]">
          Loading residents…
        </div>
      )}

      {error && (
        <div className="soft-card mb-4 px-4 py-3">
          <p className="text-[14px] font-medium text-[var(--danger)]">
            Couldn&apos;t load residents: {error}
          </p>
        </div>
      )}

      {profiles !== null && profiles.length === 0 && !error && (
        <div className="soft-card mb-4 px-4 py-3">
          <p className="text-[14px] text-[var(--muted)]">
            No residents yet. Add some in the web app first.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {profiles?.map((p) => (
          <button
            key={p.id}
            onClick={() => pick(p.id)}
            className="blocky-card flex items-center gap-4 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Avatar name={p.full_name} />
            <span className="flex-1 text-xl font-bold tracking-tight">
              {p.full_name}
            </span>
            <span className="text-2xl text-[var(--muted)]">›</span>
          </button>
        ))}
      </div>
    </main>
  );
}

// Same circle-with-initial as the iOS avatar (PersonFigure is a Three.js
// figure; here we render a simpler circular initial badge).
function Avatar({ name }: { name: string }) {
  // Hash the name to a stable hue so each resident's avatar has a distinct
  // colour even though we don't store one in profiles.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const bg = `hsl(${h}, 55%, 52%)`;
  return (
    <div
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
      style={{ background: bg }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}
