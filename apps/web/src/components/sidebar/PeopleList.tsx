"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PersonCard } from "./PersonCard";

export function PeopleList() {
  const profiles = useAppStore((s) => s.profiles);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const addProfile = useAppStore((s) => s.addProfile);
  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const submit = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    setAddError(null);
    try {
      await addProfile(newName);
      setNewName("");
      setAdding(false);
    } catch (e) {
      setAddError(
        e instanceof Error ? e.message : "Could not add resident",
      );
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setAdding(false);
    setNewName("");
    setAddError(null);
  };

  const decoratedProfiles = profiles.map((p) => {
    const mine = instances.filter((i) => i.assignee_id === p.id);
    const active = mine.find((i) => i.status === "assigned");
    return {
      profile: p,
      activeCount: mine.filter((i) => i.status === "assigned").length,
      queuedCount: mine.filter((i) => i.status === "queued").length,
      completedCount: mine.filter((i) => i.status === "completed").length,
      currentTaskName: active ? templateById[active.template_id]?.name ?? null : null,
    };
  });

  // Sort: busy first, then by completed (most active = top of mind)
  decoratedProfiles.sort((a, b) => {
    if (a.activeCount !== b.activeCount) return b.activeCount - a.activeCount;
    return b.completedCount - a.completedCount;
  });

  const busyCount = decoratedProfiles.filter((d) => d.activeCount > 0).length;
  const freeCount = decoratedProfiles.length - busyCount;

  return (
    <div className="flex h-full min-h-0 flex-col text-[var(--foreground)]">
      <div className="border-b border-[var(--line)] px-5 py-5">
        {/* Row 1: title + add button. The + sits at the visual end of the
            row, not jammed against the counter. */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">
            Residents
          </h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add resident"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--foreground)] bg-[var(--surface)] text-xl font-bold leading-none text-[var(--foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-container)] hover:text-[var(--primary)]"
          >
            +
          </button>
        </div>

        {/* Row 2: busy/free counter on its own line so it never wraps. */}
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[13px] font-bold">
          <span className="text-[var(--primary)]">{busyCount}</span>
          <span className="text-[var(--muted)]">busy</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="text-[var(--foreground-soft)]">{freeCount}</span>
          <span className="text-[var(--muted)]">free</span>
        </div>

        {/* Row 3: helper text */}
        <p className="mt-3 text-[14px] font-medium leading-snug text-[var(--foreground-soft)]">
          Drag a resident onto a flashing room.
        </p>
      </div>
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {adding && (
          <div className="blocky-card flex flex-col gap-2 px-3 py-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              New resident
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
                if (e.key === "Escape") cancel();
              }}
              placeholder="Their name"
              className="w-full rounded-md border-2 border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[15px] font-bold text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:font-medium placeholder:text-[var(--muted)]"
            />
            {addError && (
              <p className="text-[12px] font-medium text-[var(--danger)]">
                {addError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                className="rounded-full px-3 py-1.5 text-[12px] font-bold text-[var(--foreground-soft)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!newName.trim() || saving}
                className="btn-pill-primary disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        )}
        {decoratedProfiles.map((d) => (
          <PersonCard
            key={d.profile.id}
            profile={d.profile}
            activeCount={d.activeCount}
            queuedCount={d.queuedCount}
            completedCount={d.completedCount}
            currentTaskName={d.currentTaskName}
          />
        ))}
      </div>
    </div>
  );
}
