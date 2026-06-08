"use client";

import { useEffect, useState } from "react";
import {
  viewModeFor,
  type ViewMode,
  type ViewModeState,
} from "@/lib/view-mode";

// Re-derive the view mode every 30 seconds so the dashboard switches when
// the morning / evening window opens or closes. Admin override beats the
// clock; when override is null we go back to automatic.
export function useViewMode(override: ViewMode | null): ViewModeState {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // SSR fallback — render morning to avoid hydration mismatch. Once the
  // effect runs (immediately on mount) we have the real time.
  const auto = viewModeFor(now ?? new Date(2026, 0, 1, 9, 0, 0));

  if (override) {
    // Admin forced this mode. Treat it as inside the window so reassignment
    // is enabled even outside the natural time slot.
    return { ...auto, mode: override, isWindowActive: true };
  }
  return auto;
}
