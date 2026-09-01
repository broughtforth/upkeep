// Dual view mode — the dashboard switches between Morning and Evening
// delegations based on the current time of day. The admin can override.
//
// Morning window:  09:00 – 10:00 local time   → cleaning + supplies + laundry
// Evening window:  22:00 – 22:30 local time   → laundry + room-reset + zen-setup
// Between windows: the most recent window's categories stay visible but
//                  reassignment is locked.

import type { TaskCategory } from "@/lib/types";

export type ViewMode = "morning" | "evening";

export interface ViewModeState {
  mode: ViewMode;
  // True only when the current time falls inside the active window for the
  // selected mode. Drives whether reassignment is enabled.
  isWindowActive: boolean;
  // Which categories the mode surfaces. Deep-clean is always allowed since
  // those rotate independently of the daily window.
  visibleCategories: ReadonlySet<TaskCategory>;
}

const MORNING_CATEGORIES: ReadonlySet<TaskCategory> = new Set<TaskCategory>([
  "cleaning",
  "supplies",
  "laundry",
  "deep-clean",
]);

const EVENING_CATEGORIES: ReadonlySet<TaskCategory> = new Set<TaskCategory>([
  "laundry",
  "room-reset",
  "zen-setup",
  "deep-clean",
]);

const MORNING_START_H = 9;
const MORNING_END_H = 10; // exclusive
const EVENING_START_MIN = 22 * 60; // 22:00
const EVENING_END_MIN = 22 * 60 + 30; // 22:30

/**
 * Compute the auto-derived mode + active-window flag for a given moment.
 * Exported for testability; in the app we usually want `useViewMode` which
 * binds it to a ticking clock and the admin override.
 */
export function viewModeFor(now: Date): ViewModeState {
  const minutesIntoDay = now.getHours() * 60 + now.getMinutes();
  const inMorning =
    now.getHours() >= MORNING_START_H && now.getHours() < MORNING_END_H;
  const inEvening =
    minutesIntoDay >= EVENING_START_MIN && minutesIntoDay < EVENING_END_MIN;

  // "Most recent window's mode" between windows. Evening is the latest
  // window of the day; before 10 AM (and not in morning window) we look at
  // *yesterday* evening, so still evening mode. From 10:00 to 22:00 we're
  // in morning's read-only afterglow.
  let mode: ViewMode;
  if (inMorning) mode = "morning";
  else if (inEvening) mode = "evening";
  else if (now.getHours() >= MORNING_END_H && minutesIntoDay < EVENING_START_MIN)
    mode = "morning";
  else mode = "evening";

  const visibleCategories =
    mode === "morning" ? MORNING_CATEGORIES : EVENING_CATEGORIES;

  return {
    mode,
    isWindowActive: inMorning || inEvening,
    visibleCategories,
  };
}

export function modeLabel(mode: ViewMode): string {
  return mode === "morning" ? "Morning" : "Night";
}
