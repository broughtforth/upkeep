"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useViewMode } from "@/lib/useViewMode";
import type { ViewMode, ViewModeState } from "@/lib/view-mode";

interface ViewModeContextValue extends ViewModeState {
  // null = automatic (time-driven); set = admin forced
  override: ViewMode | null;
  setOverride: (mode: ViewMode | null) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ViewMode | null>(null);
  const auto = useViewMode(override);

  const value = useMemo<ViewModeContextValue>(
    () => ({ ...auto, override, setOverride }),
    [auto, override],
  );

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewModeContext(): ViewModeContextValue {
  const v = useContext(ViewModeContext);
  if (!v) throw new Error("useViewModeContext must be used inside <ViewModeProvider>");
  return v;
}
