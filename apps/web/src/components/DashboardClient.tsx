"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { House } from "@/components/house/House";
import { RoomInventoryPanel } from "@/components/house/RoomInventoryPanel";
import { PeopleList } from "@/components/sidebar/PeopleList";
import { PersonFigure } from "@/components/sidebar/PersonFigure";
import { CompleteDialog } from "@/components/task/CompleteDialog";
import { ProfileHistoryDialog } from "@/components/profile/ProfileHistoryDialog";
import {
  ViewModeProvider,
  useViewModeContext,
} from "@/components/ViewModeProvider";
import { useAppStore, colorFromString } from "@/lib/store";
import { supabase } from "@/lib/supabase-data";
import { modeLabel, type ViewMode } from "@/lib/view-mode";
import type { Profile, TaskInstance } from "@/lib/types";
import Link from "next/link";

function useSupabaseSync() {
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const upsertInstanceFromRemote = useAppStore((s) => s.upsertInstanceFromRemote);
  const upsertProfileFromRemote = useAppStore((s) => s.upsertProfileFromRemote);

  useEffect(() => {
    // Initial load.
    void loadFromSupabase();

    // Subscribe to task_instances — assignments + completions sync live.
    const instancesChannel = supabase
      .channel("task_instances_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_instances" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const next = payload.new as TaskInstance;
          upsertInstanceFromRemote(next);
        },
      )
      .subscribe();

    // Subscribe to profiles — a resident added from another browser /
    // mobile shows up here without a manual refresh.
    const profilesChannel = supabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const next = payload.new as Profile;
          upsertProfileFromRemote(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(instancesChannel);
      void supabase.removeChannel(profilesChannel);
    };
  }, [loadFromSupabase, upsertInstanceFromRemote, upsertProfileFromRemote]);
}


export function DashboardClient({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <ViewModeProvider>
      <DashboardClientInner onSignOut={onSignOut} />
    </ViewModeProvider>
  );
}

function DashboardClientInner({ onSignOut }: { onSignOut?: () => void }) {
  useSupabaseSync();
  const [helpOpen, setHelpOpen] = useState(false);
  const profiles = useAppStore((s) => s.profiles);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const setDraggingProfile = useAppStore((s) => s.setDraggingProfile);
  const assignAllPendingInRoom = useAppStore((s) => s.assignAllPendingInRoom);
  const assignTaskToProfile = useAppStore((s) => s.assignTaskToProfile);
  const editMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const view = useViewModeContext();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const profileId = e.active.data.current?.profileId as string | undefined;
    const { hoveredRoomId, hoveredInstanceId, instances, profiles } =
      useAppStore.getState();
    setDraggingProfile(null);

    if (!profileId) return;

    // Belt-and-braces: PersonCard disables drag when present_today === false,
    // but if the flag flips mid-drag we still reject here.
    const dragged = profiles.find((p) => p.id === profileId);
    if (dragged?.present_today === false) return;

    // Dual view mode: outside the morning / evening windows the dashboard
    // is read-only. Admin can force a window via the toggle.
    if (!view.isWindowActive) return;

    // House-task drop — sidebar laundry card. dnd-kit puts the drop target
    // info on e.over, distinct from the 3D-scene's raycast-based
    // hoveredRoomId / hoveredInstanceId.
    const overData = e.over?.data?.current as
      | { houseTaskInstanceId?: string }
      | undefined;
    if (overData?.houseTaskInstanceId) {
      const inst = instances.find((i) => i.id === overData.houseTaskInstanceId);
      if (inst && inst.status !== "completed") {
        assignTaskToProfile(inst.id, profileId);
      }
      return;
    }

    // Pin drop wins over room drop — only assign that one task. The dialog
    // stays closed; the user clicks the pin themselves when ready to read.
    // Allow re-assignment over an already-assigned/queued pin, but leave
    // completed pins alone (they stay locked until the daily reset).
    if (hoveredInstanceId) {
      const inst = instances.find((i) => i.id === hoveredInstanceId);
      if (inst && inst.status !== "completed") {
        assignTaskToProfile(hoveredInstanceId, profileId);
      }
      return;
    }

    // Room drop — reassign every non-completed task in that room.
    if (hoveredRoomId) {
      assignAllPendingInRoom(hoveredRoomId, profileId);
    }
  };

  const activeProfile = profiles.find((p) => p.id === draggingProfileId);

  return (
    <DndContext
      id="dashboard-dnd"
      sensors={sensors}
      onDragStart={(e) => setDraggingProfile(e.active.data.current?.profileId ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingProfile(null)}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        {/* Main 3D viewport — left, full bleed */}
        <main className="relative flex-1">
          <House />

          {/* Floating brand wordmark — top-left of the 3D view. Uses --primary
              (same blue as the "active" status dot on resident cards) for
              consistency. Slightly larger than the ? / Edit pills next to it. */}
          <div className="pointer-events-none absolute left-5 top-5 px-5 py-2.5 text-[18px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
            Upkeep
          </div>

          {/* Centre-top: dual-view mode banner. Click to override. */}
          <ModeBanner />

          {/* Top-right control cluster: help (?) + tracking + edit. All
              three share the pill style so they read as one toolbar. */}
          <div className="absolute right-5 top-5 flex items-center gap-2">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              aria-label={helpOpen ? "Close help" : "Open help"}
              className={`rounded-full px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.16em] transition ${
                helpOpen
                  ? "border-2 border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]"
                  : "btn-pill-ghost"
              }`}
            >
              ?
            </button>
            <Link
              href="/supplies"
              className="btn-pill-ghost"
            >
              Supplies
            </Link>
            <Link
              href="/admin"
              className="btn-pill-ghost"
            >
              Tracking
            </Link>
            <button
              onClick={toggleEditMode}
              className={`rounded-full px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.16em] transition ${
                editMode
                  ? "border-2 border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]"
                  : "btn-pill-ghost"
              }`}
            >
              {editMode ? "Done" : "Edit"}
            </button>
            {onSignOut && (
              <button onClick={onSignOut} className="btn-pill-ghost">
                Sign out
              </button>
            )}
          </div>

          {/* Help popover — opens below the ? button */}
          {helpOpen && (
            <div className="soft-card absolute right-5 top-20 z-30 max-w-xs px-4 py-3.5 text-[14px] font-medium leading-relaxed text-[var(--foreground-soft)]">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--foreground)]">
                  How to use
                </span>
                <button
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close help"
                  className="text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ×
                </button>
              </div>
              Drop a resident on a <span className="font-bold text-[var(--foreground)]">room</span> to make them
              responsible for every pending task in it, or on a single <span className="font-bold text-[var(--foreground)]">pin</span> to
              assign just that one. Click a pin to read instructions and tick off subtasks. Click a resident&apos;s card to see their history.
            </div>
          )}

          {editMode && (
            <div className="soft-card pointer-events-none absolute right-5 top-20 max-w-xs px-4 py-3 text-[13px] font-medium leading-relaxed text-[var(--foreground-soft)]">
              Click any room label to rename it. Press Enter or Esc to commit.
            </div>
          )}

          {draggingProfileId && (
            <div className="pointer-events-none absolute right-5 bottom-16 rounded-full bg-[var(--foreground)] px-5 py-2.5 text-[13px] font-bold text-white shadow-lg">
              Drop on a room (whole room) or a pin (one task)
            </div>
          )}

          {/* Read-only inventory for the room currently clicked/zoomed. */}
          <RoomInventoryPanel />

        </main>

        {/* Right sidebar — residents. Cream surface, blocky cards. */}
        <aside className="flex w-72 flex-col border-l border-[var(--line)] bg-[var(--background)]">
          <PeopleList />
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProfile && (
          <div
            className="blocky-card flex items-center gap-3 px-3 py-3 shadow-2xl"
            style={{ width: 240 }}
          >
            <PersonFigure color={colorFromString(activeProfile.id)} size={36} />
            <div>
              <div className="text-base font-bold leading-tight text-[var(--foreground)]">
                {activeProfile.full_name}
              </div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
                Assigning…
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      <CompleteDialog />
      <ProfileHistoryDialog />
    </DndContext>
  );
}

/**
 * Mode banner — sits at the top-centre of the 3D viewport. Shows the
 * active mode (Morning / Evening), whether the window is currently open
 * for reassignment, and a dropdown to let the admin force either mode or
 * release back to auto.
 */
function ModeBanner() {
  const view = useViewModeContext();
  const [open, setOpen] = useState(false);

  const tone =
    view.mode === "morning"
      ? {
          bg: "bg-[#FFF6E0]",
          border: "border-[#E6B954]",
          fg: "text-[#7A5300]",
        }
      : {
          bg: "bg-[#1F1E37]",
          border: "border-[#3F3D72]",
          fg: "text-white",
        };

  const lockChip = view.isWindowActive
    ? { label: "Open · Drag to assign", className: "bg-[var(--complete-bg)] text-[var(--complete-fg)]" }
    : { label: "Locked · Next window", className: "bg-[var(--muted-soft)] text-[var(--foreground-soft)]" };

  const setMode = (m: ViewMode | null) => {
    view.setOverride(m);
    setOpen(false);
  };

  return (
    <div className="absolute left-1/2 top-5 z-30 -translate-x-1/2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 shadow-md ${tone.bg} ${tone.border}`}
      >
        <span
          className={`text-[12px] font-bold uppercase tracking-[0.16em] ${tone.fg}`}
        >
          {modeLabel(view.mode)}
        </span>
        {view.override && (
          <span
            className={`rounded-full bg-white/30 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${tone.fg}`}
          >
            Forced
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${lockChip.className}`}
        >
          {lockChip.label}
        </span>
        <span className={`text-sm ${tone.fg}`}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="absolute left-1/2 mt-2 w-64 -translate-x-1/2 overflow-hidden rounded-2xl border-2 border-[var(--foreground)] bg-[var(--surface)] shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <ModeOption
            label="Auto (time-of-day)"
            sub="Morning 9-10am · Evening 10-10:30pm"
            active={view.override === null}
            onClick={() => setMode(null)}
          />
          <ModeOption
            label="Force Morning"
            sub="Cleaning · Supplies · Laundry"
            active={view.override === "morning"}
            onClick={() => setMode("morning")}
          />
          <ModeOption
            label="Force Evening"
            sub="Laundry · Room reset · Zen setup"
            active={view.override === "evening"}
            onClick={() => setMode("evening")}
          />
        </div>
      )}
    </div>
  );
}

function ModeOption({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-4 py-2.5 text-left last:border-b-0 hover:bg-[var(--background)] ${
        active ? "bg-[var(--primary-container)]" : ""
      }`}
    >
      <span
        className={`text-[13px] font-bold ${
          active ? "text-[var(--primary)]" : "text-[var(--foreground)]"
        }`}
      >
        {label}
      </span>
      <span className="text-[11px] font-medium text-[var(--muted)]">{sub}</span>
    </button>
  );
}
