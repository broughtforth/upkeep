"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setCurrentUserId } from "@/lib/session";

type Props = {
  currentUserId: string;
  onPickRoom: (instanceId: string) => void;
  onSignOut: () => void;
};

type AssignedRoom = {
  instanceId: string;
  roomId: string;
  roomName: string;
  durationMin: number;
  completed: boolean;
};

// Joined row shape returned by Supabase. Both joins are nullable defensively.
type AssignedRow = {
  id: string;
  status: "pending" | "queued" | "assigned" | "completed";
  room: { id: string; name: string } | null;
  template: { duration_min: number } | null;
};

export function HomeScreen({ currentUserId, onPickRoom, onSignOut }: Props) {
  const [rooms, setRooms] = useState<AssignedRoom[]>([]);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the resident's name once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUserId)
        .single();
      if (cancelled) return;
      if (error) {
        // Most likely the stored user id is no longer valid (resident deleted
        // from Supabase). Bounce back to the picker.
        setCurrentUserId(null);
        onSignOut();
        return;
      }
      setAssigneeName(data?.full_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, onSignOut]);

  // Fetch the resident's assigned rooms.
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_instances")
      .select(
        "id, status, room:rooms(id, name), template:task_templates(duration_min)",
      )
      .eq("assignee_id", currentUserId)
      .in("status", ["assigned", "queued", "completed"]);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setError(null);
    const rows = (data ?? []) as unknown as AssignedRow[];

    // One tile per room (dedupe in case multiple instances per room in future).
    const seen = new Set<string>();
    const mapped: AssignedRoom[] = [];
    for (const r of rows) {
      if (!r.room) continue;
      if (seen.has(r.room.id)) continue;
      seen.add(r.room.id);
      mapped.push({
        instanceId: r.id,
        roomId: r.room.id,
        roomName: r.room.name,
        durationMin: r.template?.duration_min ?? 15,
        completed: r.status === "completed",
      });
    }
    setRooms(mapped);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refetch whenever any task_instance row changes. Cheap enough
  // for our scale; mirrors the iOS app's HomeScreen subscription.
  useEffect(() => {
    const channel = supabase
      .channel("mobile_web_home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_instances" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const remainingMinutes = rooms
    .filter((r) => !r.completed)
    .reduce((sum, r) => sum + r.durationMin, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--primary)]">
            Upkeep
          </h1>
          <p className="mt-1 text-[15px] font-medium text-[var(--muted)]">
            {assigneeName ? `Hi ${assigneeName} · your rooms` : "Your rooms today"}
          </p>
        </div>
        <button
          onClick={() => {
            setCurrentUserId(null);
            onSignOut();
          }}
          className="btn-pill-ghost"
        >
          Sign out
        </button>
      </header>

      {loading && (
        <div className="py-8 text-center text-[14px] text-[var(--muted)]">
          Loading your rooms…
        </div>
      )}

      {!loading && rooms.length === 0 && (
        <div className="soft-card px-4 py-6 text-center">
          <p className="text-base font-bold tracking-tight">
            Nothing assigned to you
          </p>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {error ??
              "When someone assigns you a room on the house display, it'll show up here."}
          </p>
        </div>
      )}

      {rooms.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((r) => (
            <RoomTile
              key={r.instanceId}
              name={r.roomName}
              minutes={r.durationMin}
              completed={r.completed}
              onClick={() => onPickRoom(r.instanceId)}
            />
          ))}
        </div>
      )}

      {rooms.length > 0 && (
        <div className="mt-6 self-center rounded-full bg-[var(--muted-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--foreground-soft)]">
          {remainingMinutes === 0
            ? "All your rooms cleaned · nice work"
            : `Estimated time remaining · ${remainingMinutes} min`}
        </div>
      )}
    </main>
  );
}

function RoomTile({
  name,
  minutes,
  completed,
  onClick,
}: {
  name: string;
  minutes: number;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="blocky-card flex aspect-square flex-col justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      style={
        completed
          ? {
              background: "var(--complete-bg)",
              borderColor: "var(--complete-fg)",
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="line-clamp-2 text-xl font-bold leading-tight tracking-tight"
          style={{
            color: completed ? "var(--complete-fg)" : "var(--primary)",
          }}
        >
          {name}
        </span>
        <span
          className="text-[13px] font-bold"
          style={{
            color: completed ? "var(--complete-fg)" : "var(--primary)",
          }}
        >
          {completed ? "Clean" : `${minutes}m`}
        </span>
      </div>
      {completed && (
        <div className="self-end">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ background: "var(--complete-fg)" }}
          >
            ✓
          </div>
        </div>
      )}
    </button>
  );
}
