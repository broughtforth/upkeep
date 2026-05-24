"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  instanceId: string;
  onBack: () => void;
  onComplete: () => void;
};

type InstanceRow = {
  id: string;
  status: "pending" | "queued" | "assigned" | "completed";
  subtasks_done: string[];
  completed_at: string | null;
  room: { id: string; name: string } | null;
  template: {
    id: string;
    name: string;
    instructions: string;
    subtasks: string[];
    duration_min: number;
  } | null;
};

const COMPLETE_FG = "#1F8F4E";
const COMPLETE_BG = "#E8F5EC";

export function CleaningFlowScreen({ instanceId, onBack, onComplete }: Props) {
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const fetchInstance = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_instances")
      .select(
        "id, status, subtasks_done, completed_at, room:rooms(id, name), template:task_templates(id, name, instructions, subtasks, duration_min)",
      )
      .eq("id", instanceId)
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setInstance(data as unknown as InstanceRow);
    setError(null);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    void fetchInstance();
  }, [fetchInstance]);

  // Realtime subscription on this specific row, mirrors the iOS app's
  // per-instance channel.
  useEffect(() => {
    const channel = supabase
      .channel(`mobile_web_instance_${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_instances",
          filter: `id=eq.${instanceId}`,
        },
        () => void fetchInstance(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [instanceId, fetchInstance]);

  const isComplete = instance?.status === "completed";
  const subtasks = instance?.template?.subtasks ?? [];
  const subtasksDone = instance?.subtasks_done ?? [];
  const doneCount = subtasksDone.length;
  const totalCount = subtasks.length;

  const toggleSubtask = async (label: string) => {
    if (!instance || isComplete) return;
    const isDone = subtasksDone.includes(label);
    const nextDone = isDone
      ? subtasksDone.filter((s) => s !== label)
      : [...subtasksDone, label];
    setInstance({ ...instance, subtasks_done: nextDone });
    const { error } = await supabase
      .from("task_instances")
      .update({ subtasks_done: nextDone })
      .eq("id", instance.id);
    if (error) {
      // Roll back the optimistic update.
      setInstance({ ...instance, subtasks_done: subtasksDone });
      alert(`Could not save: ${error.message}`);
    }
  };

  const markRoomComplete = async () => {
    if (!instance) return;
    setFinishing(true);
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("task_instances")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", instance.id);
    setFinishing(false);
    if (error) {
      alert(`Could not finish: ${error.message}`);
      return;
    }
    onComplete();
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Header onBack={onBack} title="" />
        <div className="flex flex-1 items-center justify-center text-[14px] text-[var(--muted)]">
          Loading…
        </div>
      </main>
    );
  }

  if (error || !instance || !instance.room || !instance.template) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Header onBack={onBack} title="" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-2xl font-bold tracking-tight">
            Couldn&apos;t load this room
          </p>
          <p className="text-[14px] text-[var(--muted)]">
            {error ?? "The task may have been unassigned. Try going back."}
          </p>
        </div>
      </main>
    );
  }

  const room = instance.room;
  const template = instance.template;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <Header onBack={onBack} title={room.name} />

      <div className="flex flex-1 flex-col gap-6">
        {/* Meta row: status + duration */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-3 py-1.5 text-[13px] font-bold"
            style={
              isComplete
                ? { background: COMPLETE_BG, color: COMPLETE_FG }
                : {
                    background: "var(--primary-container)",
                    color: "var(--primary)",
                  }
            }
          >
            {isComplete
              ? "Clean"
              : totalCount > 0
                ? `${doneCount}/${totalCount} done`
                : "Ready to start"}
          </span>
          <span className="text-[14px] font-bold text-[var(--muted)]">
            ~{template.duration_min} min
          </span>
        </div>

        {/* Instructions (collapsible) */}
        {template.instructions && (
          <button
            onClick={() => setInstructionsOpen((v) => !v)}
            className="soft-card text-left transition hover:bg-[var(--background)]"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Read first
              </span>
              <span className="text-[var(--muted)]">
                {instructionsOpen ? "−" : "+"}
              </span>
            </div>
            {instructionsOpen && (
              <p className="whitespace-pre-line border-t border-[var(--line)] px-4 py-3 text-[15px] leading-relaxed text-[var(--foreground-soft)]">
                {template.instructions}
              </p>
            )}
          </button>
        )}

        {/* Checklist */}
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Checklist
          </h2>
          <div className="soft-card overflow-hidden">
            {subtasks.length === 0 && (
              <p className="px-4 py-4 text-center text-[14px] text-[var(--muted)]">
                No checklist for this room.
              </p>
            )}
            {subtasks.map((label) => {
              const checked = subtasksDone.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleSubtask(label)}
                  disabled={isComplete}
                  className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 text-left last:border-b-0 disabled:cursor-default"
                  style={checked ? { background: "#F5F8F6" } : undefined}
                >
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-white"
                    style={{
                      background: checked ? COMPLETE_FG : "var(--surface)",
                      borderColor: checked
                        ? COMPLETE_FG
                        : "var(--muted-soft)",
                    }}
                  >
                    {checked && (
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8 l3 3 l7 -7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-[15px] font-medium ${
                      checked ? "text-[var(--muted)] line-through" : ""
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4">
        {isComplete ? (
          <div
            className="btn-pill-primary"
            style={{ background: COMPLETE_FG, cursor: "default" }}
          >
            ✓ Room marked clean
          </div>
        ) : (
          <button
            onClick={markRoomComplete}
            disabled={finishing}
            className="btn-pill-primary"
          >
            {finishing ? "Saving…" : "Mark room complete"}
          </button>
        )}
      </div>
    </main>
  );
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
