"use client";

import { useAppStore } from "@/lib/store";
import { PersonCard } from "./PersonCard";

export function PeopleList() {
  const profiles = useAppStore((s) => s.profiles);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));

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
    <div className="flex h-full min-h-0 flex-col text-[var(--parchment-silver)]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
            Residents
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-tighter text-white/60">
            {busyCount} <span className="text-white/35">busy</span> · {freeCount}{" "}
            <span className="text-white/35">free</span>
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/45">
          Drag a resident onto a flashing room.
        </p>
      </div>
      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
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
