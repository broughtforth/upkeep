"use client";

import { useEffect, useState } from "react";
import { getCurrentUserId } from "@/lib/session";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { HomeScreen } from "@/components/HomeScreen";
import { CleaningFlowScreen } from "@/components/CleaningFlowScreen";

// Mirror of apps/mobile/src/App.tsx — picks a screen based on whether a user
// is signed in and whether they've tapped a room tile.

type View =
  | { kind: "onboarding" }
  | { kind: "home"; userId: string }
  | { kind: "flow"; userId: string; instanceId: string };

export default function Page() {
  // undefined = haven't checked storage yet; null = not signed in.
  const [view, setView] = useState<View | undefined>(undefined);

  useEffect(() => {
    const id = getCurrentUserId();
    setView(id ? { kind: "home", userId: id } : { kind: "onboarding" });
  }, []);

  if (view === undefined) {
    return <div className="min-h-screen bg-[var(--background)]" />;
  }

  if (view.kind === "onboarding") {
    return (
      <OnboardingScreen
        onPicked={() => {
          const id = getCurrentUserId();
          if (id) setView({ kind: "home", userId: id });
        }}
      />
    );
  }

  if (view.kind === "home") {
    return (
      <HomeScreen
        currentUserId={view.userId}
        onPickRoom={(instanceId) =>
          setView({ kind: "flow", userId: view.userId, instanceId })
        }
        onSignOut={() => setView({ kind: "onboarding" })}
      />
    );
  }

  return (
    <CleaningFlowScreen
      instanceId={view.instanceId}
      onBack={() => setView({ kind: "home", userId: view.userId })}
      onComplete={() => setView({ kind: "home", userId: view.userId })}
    />
  );
}
