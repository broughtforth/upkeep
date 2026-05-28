"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  currentUserId: string;
  onBack: () => void;
};

type CompletedRow = {
  id: string;
  completed_at: string | null;
  room: { id: string; name: string } | null;
};

type CompletedItem = {
  instanceId: string;
  roomName: string;
  completedAt: string | null;
};

export function HistoryScreen({ currentUserId, onBack }: Props) {
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_instances")
      .select("id, completed_at, room:rooms(id, name)")
      .eq("assignee_id", currentUserId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as CompletedRow[];
    setItems(
      rows.map((r) => ({
        instanceId: r.id,
        roomName: r.room?.name ?? "Unknown room",
        completedAt: r.completed_at,
      })),
    );
    setError(null);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <Header onBack={onBack} title="Completed history" />

      <div className="flex flex-1 flex-col gap-3">
        {loading && (
          <div className="py-8 text-center text-[14px] text-[var(--muted)]">
            Loading…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="soft-card px-4 py-6 text-center">
            <p className="text-base font-bold tracking-tight">
              Nothing completed yet
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              {error ??
                "Rooms you finish will be listed here with the date you completed them."}
            </p>
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.instanceId}
            className="soft-card flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "var(--complete-fg)" }}
              >
                ✓
              </span>
              <span className="text-[16px] font-bold tracking-tight">
                {item.roomName}
              </span>
            </div>
            <span className="text-[13px] font-medium text-[var(--muted)]">
              {formatCompleted(item.completedAt)}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}

function formatCompleted(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--foreground)] bg-[var(--surface)] text-xl font-bold leading-none transition hover:bg-[var(--background)]"
      >
        ‹
      </button>
      <h1 className="flex-1 truncate text-center text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <div className="h-11 w-11" />
    </div>
  );
}
