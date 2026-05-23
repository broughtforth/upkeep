"use client";

import { useState } from "react";
import { useAppStore, colorFromString } from "@/lib/store";
import { PersonFigure } from "@/components/sidebar/PersonFigure";
import type { TaskCategory, TaskInstance } from "@/lib/types";

const CATEGORY_SYMBOL: Record<TaskCategory, string> = {
  cleaning: "◐",
  supplies: "⚡",
  cooking: "⌂",
  laundry: "≋",
};

type Period = "today" | "7d" | "30d" | "all";

export function ProfileHistoryDialog() {
  const selectedProfileId = useAppStore((s) => s.selectedProfileId);
  const selectProfile = useAppStore((s) => s.selectProfile);
  const profiles = useAppStore((s) => s.profiles);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const rooms = useAppStore((s) => s.rooms);
  const selectInstance = useAppStore((s) => s.selectInstance);

  const [period, setPeriod] = useState<Period>("today");

  if (!selectedProfileId) return null;
  const profile = profiles.find((p) => p.id === selectedProfileId);
  if (!profile) return null;

  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));

  const cutoff = (() => {
    const now = new Date();
    switch (period) {
      case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case "7d":    return now.getTime() - 7  * 24 * 3600 * 1000;
      case "30d":   return now.getTime() - 30 * 24 * 3600 * 1000;
      case "all":   return 0;
    }
  })();

  const inRange = (i: TaskInstance) => {
    const t = i.completed_at ?? i.assigned_at ?? i.scheduled_for;
    return new Date(t).getTime() >= cutoff;
  };

  const mine = instances.filter((i) => i.assignee_id === profile.id && inRange(i));
  const assigned = mine.filter((i) => i.status === "assigned");
  const completed = mine.filter((i) => i.status === "completed");

  const byCategory: Record<TaskCategory, number> = { cleaning: 0, supplies: 0, cooking: 0, laundry: 0 };
  for (const i of completed) {
    const t = templateById[i.template_id];
    if (t) byCategory[t.category]++;
  }

  const close = () => selectProfile(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-neutral-200 bg-neutral-50 px-6 py-5">
          <div className="flex items-center gap-4">
            <PersonFigure color={colorFromString(profile.id)} size={64} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {profile.role === "admin" ? "Admin" : "Resident"}
              </div>
              <h2 className="font-serif text-xl font-semibold leading-tight">{profile.full_name}</h2>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-600">
                <span><strong className="font-mono text-neutral-900">{completed.length}</strong> completed</span>
                <span className="text-neutral-300">·</span>
                <span><strong className="font-mono text-neutral-900">{assigned.length}</strong> in progress</span>
              </div>
            </div>
            <button
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex-shrink-0 border-b border-neutral-200 px-6 py-3">
          <div className="inline-flex rounded-md bg-neutral-100 p-0.5 text-xs">
            {(["today", "7d", "30d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-[5px] px-3 py-1.5 font-medium transition ${
                  period === p ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {p === "today" ? "Today" : p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : "All time"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Category breakdown */}
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              — By category —
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {(["cleaning", "supplies", "cooking", "laundry"] as TaskCategory[]).map((cat) => (
                <div key={cat} className="rounded-md border border-neutral-200 px-3 py-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-lg text-neutral-700">{CATEGORY_SYMBOL[cat]}</span>
                    <span className="font-mono text-lg tabular-nums">{byCategory[cat]}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                    {cat}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Currently assigned */}
          {assigned.length > 0 && (
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                — Currently assigned ({assigned.length}) —
              </h3>
              <ul className="space-y-1.5">
                {assigned.map((i) => {
                  const t = templateById[i.template_id];
                  const r = roomById[i.room_id];
                  const done = t ? `${i.subtasks_done.length}/${t.subtasks.length}` : "";
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => { close(); selectInstance(i.id); }}
                        className="flex w-full items-start gap-3 rounded-md border border-orange-200 bg-orange-50/50 px-3 py-2 text-left transition hover:bg-orange-50"
                      >
                        <span className="font-serif text-base text-neutral-700">
                          {t ? CATEGORY_SYMBOL[t.category] : "○"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium leading-tight">{t?.name}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                            {r?.name} · {done && <span className="font-mono">{done} steps</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Completed */}
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              — Completed ({completed.length}) —
            </h3>
            {completed.length === 0 ? (
              <p className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500">
                No completed tasks in this period.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {completed
                  .slice()
                  .sort((a, b) =>
                    new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
                  )
                  .map((i) => {
                    const t = templateById[i.template_id];
                    const r = roomById[i.room_id];
                    return (
                      <li key={i.id}>
                        <button
                          onClick={() => { close(); selectInstance(i.id); }}
                          className="flex w-full items-start gap-3 rounded-md border border-neutral-200 px-3 py-2 text-left transition hover:bg-neutral-50"
                        >
                          <span className="font-serif text-base text-neutral-700">
                            {t ? CATEGORY_SYMBOL[t.category] : "○"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium leading-tight">{t?.name}</div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
                              <span>{r?.name}</span>
                              <span className="text-neutral-300">·</span>
                              <span className="font-mono">
                                {i.completed_at
                                  ? new Date(i.completed_at).toLocaleString([], {
                                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                    })
                                  : "—"}
                              </span>
                            </div>
                          </div>
                          {i.photo_url && (
                            <img src={i.photo_url} alt="" className="h-10 w-10 flex-shrink-0 rounded object-cover ring-1 ring-neutral-200" />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
