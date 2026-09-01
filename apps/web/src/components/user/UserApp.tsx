"use client";

import { useState } from "react";
import { HomeScreen } from "@/components/user/HomeScreen";
import { CleaningFlowScreen } from "@/components/user/CleaningFlowScreen";
import { HistoryScreen } from "@/components/user/HistoryScreen";

type View =
  | { kind: "home" }
  | { kind: "history" }
  | { kind: "flow"; instanceId: string };

// The resident-facing app: current rooms, a room's task flow, and completed
// history. The signed-in profile id drives everything (no name-picker).
export function UserApp({
  currentUserId,
  onSignOut,
}: {
  currentUserId: string;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "home" });

  if (view.kind === "history") {
    return (
      <HistoryScreen
        currentUserId={currentUserId}
        onBack={() => setView({ kind: "home" })}
      />
    );
  }

  if (view.kind === "flow") {
    return (
      <CleaningFlowScreen
        instanceId={view.instanceId}
        currentUserId={currentUserId}
        onBack={() => setView({ kind: "home" })}
        onComplete={() => setView({ kind: "home" })}
      />
    );
  }

  return (
    <HomeScreen
      currentUserId={currentUserId}
      onPickRoom={(instanceId) => setView({ kind: "flow", instanceId })}
      onOpenHistory={() => setView({ kind: "history" })}
      onSignOut={onSignOut}
    />
  );
}
