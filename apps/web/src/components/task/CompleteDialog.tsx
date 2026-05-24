"use client";

import { useState } from "react";
import { useAppStore, colorFromString } from "@/lib/store";
import { useCountdown } from "@/lib/countdown";

const CATEGORY_SYMBOL: Record<string, string> = {
  cleaning: "◐",
  supplies: "⚡",
  cooking: "⌂",
  laundry: "≋",
};

type Mode = "checklist" | "overview";

export function CompleteDialog() {
  const selectedId = useAppStore((s) => s.selectedInstanceId);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const rooms = useAppStore((s) => s.rooms);
  const profiles = useAppStore((s) => s.profiles);
  const completeTask = useAppStore((s) => s.completeTask);
  const unassignTask = useAppStore((s) => s.unassignTask);
  const toggleSubtask = useAppStore((s) => s.toggleSubtask);

  const [mode, setMode] = useState<Mode>("checklist");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const instance = selectedId ? instances.find((i) => i.id === selectedId) : null;
  const template = instance ? templates.find((t) => t.id === instance.template_id) : null;

  // Hooks must run on every render — call useCountdown before any early
  // return. It returns null when there's no `assigned_at` to count from.
  const countdown = useCountdown(
    instance?.status === "assigned" ? instance.assigned_at : null,
    template?.duration_min ?? 0,
  );

  if (!selectedId) return null;
  if (!instance) return null;

  const room = rooms.find((r) => r.id === instance.room_id);
  const assignee = instance.assignee_id ? profiles.find((p) => p.id === instance.assignee_id) : null;
  const assigneeColor = assignee ? colorFromString(assignee.id) : null;
  const symbol = template ? CATEGORY_SYMBOL[template.category] ?? "◌" : "◌";

  const subtasks = template?.subtasks ?? [];
  const doneCount = subtasks.filter((s) => instance.subtasks_done.includes(s)).length;
  const allDone = subtasks.length > 0 && doneCount === subtasks.length;

  const close = () => {
    setPhotoUrl(null);
    setInstructionsOpen(false);
    selectInstance(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const onComplete = () => {
    if (!photoUrl && instance.status === "assigned") {
      if (!confirm("Mark complete without a photo?")) return;
    }
    completeTask(instance.id, photoUrl ?? "");
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border-[3px] border-[var(--foreground)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--line)] bg-[var(--background)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xl text-[var(--foreground)]">
              {symbol}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {room?.name}
              </div>
              <h3 className="mt-0.5 text-xl font-bold leading-tight tracking-tight text-[var(--foreground)]">
                {template?.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                {assignee ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                    style={{ backgroundColor: assigneeColor! }}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[9px] font-bold leading-none"
                    >
                      {assignee.full_name[0]}
                    </span>
                    {assignee.full_name}
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                    Unassigned
                  </span>
                )}
                {template && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600">
                    {template.duration_min} min budget
                  </span>
                )}
                {countdown && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono font-semibold ${
                      countdown.overdue
                        ? "bg-red-100 text-red-700"
                        : countdown.fraction > 0.75
                          ? "bg-orange-100 text-orange-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {countdown.overdue ? "Overdue " : ""}
                    {countdown.label}
                  </span>
                )}
              </div>
            </div>
            <StatusBadge status={instance.status} />
          </div>
        </div>

        {/* Mode tabs — only when the task is in progress */}
        {instance.status === "assigned" && subtasks.length > 0 && (
          <div className="flex-shrink-0 border-b border-neutral-200 px-5 pt-3">
            <div className="inline-flex rounded-md bg-neutral-100 p-0.5 text-xs">
              <button
                onClick={() => setMode("checklist")}
                className={`rounded-[5px] px-3 py-1.5 font-medium transition ${
                  mode === "checklist" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Step by step
              </button>
              <button
                onClick={() => setMode("overview")}
                className={`rounded-[5px] px-3 py-1.5 font-medium transition ${
                  mode === "overview" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Mark all at once
              </button>
            </div>
            {mode === "checklist" && subtasks.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full transition-all ${allDone ? "bg-green-500" : "bg-orange-500"}`}
                    style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                  />
                </div>
                <span className="font-mono tabular-nums">
                  {doneCount}/{subtasks.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {instance.status === "queued" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                — In the queue —
              </div>
              <p className="mt-1">
                {assignee?.full_name ?? "This person"} is doing the earlier
                tasks in this room first. The timer starts when this one
                becomes active.
              </p>
            </div>
          )}

          {/* Instructions — collapsible */}
          {template?.instructions && (
            <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setInstructionsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600 hover:bg-neutral-100"
              >
                <span>— Read before you start —</span>
                <span className="text-neutral-400">{instructionsOpen ? "−" : "+"}</span>
              </button>
              {instructionsOpen && (
                <div className="whitespace-pre-line border-t border-neutral-200 bg-white px-3 py-3 text-[13px] leading-relaxed text-neutral-700">
                  {template.instructions}
                </div>
              )}
            </div>
          )}

          {/* Subtask checklist — visible in checklist mode (default) and for pending tasks */}
          {(instance.status === "pending" ||
            (instance.status === "assigned" && mode === "checklist") ||
            instance.status === "completed") &&
            subtasks.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  <span>— Checklist —</span>
                  <span className="font-mono text-neutral-400">
                    {doneCount}/{subtasks.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {subtasks.map((s) => {
                    const isDone = instance.subtasks_done.includes(s);
                    const interactive = instance.status === "assigned" && mode === "checklist";
                    return (
                      <li key={s}>
                        <button
                          disabled={!interactive}
                          onClick={() => toggleSubtask(instance.id, s)}
                          className={`flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition ${
                            interactive ? "hover:bg-neutral-50" : "cursor-default"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                              isDone
                                ? "border-green-600 bg-green-600 text-white"
                                : "border-neutral-300 bg-white"
                            }`}
                          >
                            {isDone && (
                              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M3 8 l3 3 l7 -7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={isDone ? "text-neutral-400 line-through" : "text-neutral-800"}>
                            {s}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          {/* Overview mode body — "Ready when" checklist (display only) */}
          {instance.status === "assigned" && mode === "overview" && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                — The room is ready when —
              </div>
              <ul className="grid grid-cols-2 gap-1.5 text-[12px]">
                {readyWhenFor(room?.type).map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-neutral-700">
                    <span className="text-neutral-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] italic text-neutral-500">
                When you're done with all of these, mark the whole task complete below.
              </p>
            </div>
          )}

          {/* Meta when completed */}
          {instance.status === "completed" && (
            <dl className="space-y-1.5 text-sm">
              <Row label="Completed">
                {instance.completed_at
                  ? new Date(instance.completed_at).toLocaleString()
                  : "—"}
              </Row>
            </dl>
          )}

          {/* Photo upload */}
          {instance.status === "assigned" && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Completion photo (optional)
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFile}
                className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-white hover:file:bg-neutral-800"
              />
              {photoUrl && (
                <img src={photoUrl} alt="" className="mt-2 max-h-48 w-full rounded-md object-cover ring-1 ring-neutral-200" />
              )}
            </div>
          )}

          {instance.status === "completed" && instance.photo_url && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Evidence
              </div>
              <img src={instance.photo_url} alt="" className="w-full rounded-md object-cover ring-1 ring-neutral-200" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--background)] px-5 py-3">
          <button
            onClick={close}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--foreground-soft)] hover:bg-[var(--surface)]"
          >
            Close
          </button>
          {instance.status === "assigned" && (
            <div className="flex gap-2">
              <button
                onClick={() => { unassignTask(instance.id); close(); }}
                className="btn-pill-ghost"
              >
                Unassign
              </button>
              <button
                onClick={onComplete}
                disabled={uploading}
                className="btn-pill-primary disabled:opacity-50"
              >
                {mode === "overview" ? "Mark task complete" : allDone ? "Done — finish task" : "Finish anyway"}
              </button>
            </div>
          )}
          {instance.status === "queued" && (
            <button
              onClick={() => { unassignTask(instance.id); close(); }}
              className="btn-pill-ghost"
            >
              Remove from queue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function readyWhenFor(type?: string): string[] {
  switch (type) {
    case "bathroom":  return ["Sink clear", "Toilet clean", "Glass squeegeed", "Tools at home"];
    case "kitchen":   return ["Counters wiped", "Stove clean", "Sink empty", "Dishwasher running"];
    case "tech":      return ["Tables match", "Pegboard full", "Cabinet locked", "Door locked"];
    case "living":    return ["Wardrobe full", "Stations clear", "Instruments home", "No food, no bags"];
    case "bedroom":   return ["Mode honoured", "Objects home", "Candles out", "Silence held"];
    default:          return ["Used with intent", "Reset completely", "Left ready"];
  }
}

function StatusBadge({ status }: { status: "pending" | "queued" | "assigned" | "completed" }) {
  const styles = {
    pending: "bg-red-100 text-red-700",
    queued: "bg-amber-100 text-amber-700",
    assigned: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
  }[status];
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles}`}>
      {status}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-right text-[13px] text-neutral-900">{children}</dd>
    </div>
  );
}
