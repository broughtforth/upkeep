"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-data";

type Props = {
  currentUserId: string;
  onPickRoom: (instanceId: string) => void;
  onOpenHistory: () => void;
  onSignOut: () => void;
};

type AssignedRoom = {
  instanceId: string;
  roomId: string;
  roomName: string;
  durationMin: number;
};

// Joined row shape returned by Supabase. Both joins are nullable defensively.
type AssignedRow = {
  id: string;
  status: "pending" | "queued" | "assigned" | "completed";
  room: { id: string; name: string } | null;
  template: { duration_min: number } | null;
};

export function HomeScreen({
  currentUserId,
  onPickRoom,
  onOpenHistory,
  onSignOut,
}: Props) {
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
        // Profile vanished — bounce back to sign-in.
        onSignOut();
        return;
      }
      setAssigneeName(data?.full_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, onSignOut]);

  // Fetch the resident's *current* rooms — assigned or queued, not completed.
  // Completed work lives in the Completed history screen (opened from the menu).
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_instances")
      .select(
        "id, status, room:rooms(id, name), template:task_templates(duration_min)",
      )
      .eq("assignee_id", currentUserId)
      .in("status", ["assigned", "queued"]);
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
      });
    }
    setRooms(mapped);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refetch whenever any task_instance row changes.
  useEffect(() => {
    const channel = supabase
      .channel("web_user_home")
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

  const remainingMinutes = rooms.reduce((sum, r) => sum + r.durationMin, 0);

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
        <Menu onOpenHistory={onOpenHistory} onSignOut={onSignOut} />
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
          {rooms.map((r, i) => {
            // A lone card (or the odd one out) spans both columns so the grid
            // never leaves a lopsided empty half.
            const isLastOdd = i === rooms.length - 1 && rooms.length % 2 === 1;
            return (
              <RoomTile
                key={r.instanceId}
                name={r.roomName}
                minutes={r.durationMin}
                fullWidth={isLastOdd}
                onClick={() => onPickRoom(r.instanceId)}
              />
            );
          })}
        </div>
      )}

      {rooms.length > 0 && (
        <div className="mt-6 self-center rounded-full bg-[var(--muted-soft)] px-4 py-2 text-[13px] font-semibold text-[var(--foreground-soft)]">
          {`Estimated time remaining · ${remainingMinutes} min`}
        </div>
      )}
    </main>
  );
}

function RoomTile({
  name,
  minutes,
  fullWidth,
  onClick,
}: {
  name: string;
  minutes: number;
  fullWidth: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`blocky-card flex min-h-[112px] flex-col justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        fullWidth ? "col-span-2" : ""
      }`}
    >
      <span className="line-clamp-2 text-xl font-bold leading-tight tracking-tight text-[var(--primary)]">
        {name}
      </span>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full bg-[var(--primary-container)] px-2.5 py-1 text-[12px] font-bold text-[var(--primary)]">
          {minutes}m
        </span>
        <span className="text-xl leading-none text-[var(--muted)]">›</span>
      </div>
    </button>
  );
}

// Header overflow menu: Completed history + Sign out.
function Menu({
  onOpenHistory,
  onSignOut,
}: {
  onOpenHistory: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--foreground)] bg-[var(--surface)] transition hover:bg-[var(--background)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="soft-card absolute right-0 z-10 mt-2 w-52 overflow-hidden p-1">
          <MenuItem
            label="Completed history"
            onClick={() => {
              setOpen(false);
              onOpenHistory();
            }}
          />
          <MenuItem
            label="Sign out"
            danger
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold transition hover:bg-[var(--background)]"
      style={danger ? { color: "var(--danger)" } : undefined}
    >
      {label}
    </button>
  );
}
