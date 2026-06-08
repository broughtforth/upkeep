"use client";

import { useState } from "react";
import { useAppStore, colorFromString } from "@/lib/store";
import { PersonFigure } from "./PersonFigure";

/**
 * Presence selector. Sits between the sidebar header and the resident list.
 *
 * Collapsed: shows a single line ("Everyone present" or "N away") with a
 * chevron. Expanded: lists every resident with a toggle next to each. The
 * toggle writes `profiles.present_today` to Supabase via the store action.
 *
 * Residents who are not present_today are filtered out of:
 *   - the drag-drop assignment pool (DashboardClient onDragEnd guard),
 *   - the dual-view mode's auto-assign logic (when we add it later).
 * They still show up in the residents list, just dimmed.
 */
export function PresencePanel() {
  const profiles = useAppStore((s) => s.profiles);
  const setProfilePresence = useAppStore((s) => s.setProfilePresence);
  const [open, setOpen] = useState(false);

  const awayCount = profiles.filter((p) => p.present_today === false).length;
  const allPresent = awayCount === 0;

  return (
    <div className="border-b border-[var(--line)] px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Today&apos;s presence
          </div>
          <div className="mt-1 text-[14px] font-bold text-[var(--foreground)]">
            {allPresent
              ? "Everyone present"
              : `${awayCount} away · ${profiles.length - awayCount} present`}
          </div>
        </div>
        <span
          className={`text-lg leading-none text-[var(--muted)] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-1.5">
          {profiles.map((p) => {
            const present = p.present_today !== false;
            const color = colorFromString(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void setProfilePresence(p.id, !present)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--background)] ${
                    present ? "" : "opacity-50"
                  }`}
                  aria-pressed={present}
                  aria-label={`${p.full_name} is ${present ? "present" : "away"} — tap to toggle`}
                >
                  <PersonFigure color={color} size={26} />
                  <span className="flex-1 truncate text-[14px] font-bold text-[var(--foreground)]">
                    {p.full_name}
                  </span>
                  <span
                    className={`flex h-5 w-9 items-center rounded-full border-2 transition ${
                      present
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--muted-soft)] bg-[var(--surface)]"
                    }`}
                  >
                    <span
                      className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                        present ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
