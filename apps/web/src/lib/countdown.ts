"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  /** Whole milliseconds remaining (negative when overdue). */
  remainingMs: number;
  /** "MM:SS" while running, "+MM:SS" once overdue. */
  label: string;
  overdue: boolean;
  /** 0..1 progress through the budget; clamps to 1 once overdue. */
  fraction: number;
}

// Ticks once a second so the caller re-renders without each consumer
// wiring its own setInterval.
export function useCountdown(
  startedAt: string | null,
  durationMin: number,
): Countdown | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const total = durationMin * 60_000;
  const elapsed = now - start;
  const remainingMs = total - elapsed;
  const overdue = remainingMs < 0;
  const absMs = Math.abs(remainingMs);
  const mm = Math.floor(absMs / 60_000);
  const ss = Math.floor((absMs % 60_000) / 1000)
    .toString()
    .padStart(2, "0");
  const label = `${overdue ? "+" : ""}${mm}:${ss}`;
  const fraction = Math.min(1, Math.max(0, elapsed / total));
  return { remainingMs, label, overdue, fraction };
}
