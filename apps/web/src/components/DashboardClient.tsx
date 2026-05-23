"use client";

import { useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { House } from "@/components/house/House";
import { PeopleList } from "@/components/sidebar/PeopleList";
import { PersonFigure } from "@/components/sidebar/PersonFigure";
import { CompleteDialog } from "@/components/task/CompleteDialog";
import { ProfileHistoryDialog } from "@/components/profile/ProfileHistoryDialog";
import { useAppStore, colorFromString } from "@/lib/store";
import { supabase } from "@/lib/supabase-data";
import type { TaskInstance } from "@/lib/types";
import Link from "next/link";

function useSupabaseSync() {
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const upsertInstanceFromRemote = useAppStore((s) => s.upsertInstanceFromRemote);

  useEffect(() => {
    // Initial load.
    void loadFromSupabase();

    // Subscribe to changes on task_instances — when the mobile app marks
    // something complete, the 3D house turns green without a refresh.
    const channel = supabase
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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadFromSupabase, upsertInstanceFromRemote]);
}

function CoordReadout() {
  const cursorPos = useAppStore((s) => s.cursorPos);
  // Bottom-right of the 3D viewport, just left of the Admin link.
  return (
    <div className="pointer-events-none absolute bottom-5 right-44 rounded-md border border-neutral-200 bg-white/95 px-3 py-2 font-mono text-[11px] leading-tight text-neutral-700 shadow-sm backdrop-blur">
      <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
        Cursor position
      </div>
      {cursorPos ? (
        <>
          X = {cursorPos[0].toFixed(2)} &nbsp; Z = {cursorPos[2].toFixed(2)}
          <div className="text-[10px] text-neutral-400">
            Y = {cursorPos[1].toFixed(2)}
          </div>
        </>
      ) : (
        <span className="text-neutral-400">hover the house…</span>
      )}
    </div>
  );
}

export function DashboardClient() {
  useSupabaseSync();
  const profiles = useAppStore((s) => s.profiles);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const setDraggingProfile = useAppStore((s) => s.setDraggingProfile);
  const assignAllPendingInRoom = useAppStore((s) => s.assignAllPendingInRoom);
  const assignTaskToProfile = useAppStore((s) => s.assignTaskToProfile);
  const editMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const profileId = e.active.data.current?.profileId as string | undefined;
    const { hoveredRoomId, hoveredInstanceId, instances } = useAppStore.getState();
    setDraggingProfile(null);

    if (!profileId) return;

    // Pin drop wins — only assign that one task. The dialog stays closed;
    // the user clicks the pin themselves when they're ready to read.
    if (hoveredInstanceId) {
      const inst = instances.find((i) => i.id === hoveredInstanceId);
      if (inst && inst.status === "pending") {
        assignTaskToProfile(hoveredInstanceId, profileId);
      }
      return;
    }

    // Room drop — assign every pending task in that room.
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
      <div className="flex h-screen w-screen overflow-hidden bg-stone-100 text-neutral-900">
        {/* Main 3D viewport — left, full bleed */}
        <main className="relative flex-1">
          <House />

          {/* Floating brand chip — top-left of the 3D view */}
          <div className="pointer-events-none absolute left-5 top-5 rounded-md border border-neutral-200 bg-white/95 px-3.5 py-2 shadow-sm backdrop-blur">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
              Telos · House
            </div>
            <div className="font-serif text-base font-semibold leading-tight">
              The Natural Order
            </div>
          </div>

          {/* Help hint */}
          <div className="pointer-events-none absolute bottom-5 left-5 max-w-xs rounded-md border border-neutral-200 bg-white/95 px-3.5 py-2.5 text-xs leading-relaxed text-neutral-700 shadow-sm backdrop-blur">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              How to use
            </div>
            Drop a resident on a <span className="font-medium text-neutral-900">room</span> to make them
            responsible for every pending task in it, or on a single <span className="font-medium text-neutral-900">pin</span> to
            assign just that one. Click a pin to read instructions and tick off subtasks. Click a resident's card to see their history.
          </div>

          {/* Edit-mode toggle — top-right of the 3D viewport. Click to enter
              edit mode, then click on the house to drop a room label. */}
          <button
            onClick={toggleEditMode}
            className={`absolute right-5 top-5 rounded-md px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] shadow-sm backdrop-blur transition ${
              editMode
                ? "bg-[var(--mint)] text-[var(--phthalo)] hover:brightness-95"
                : "border border-neutral-200 bg-white/95 text-neutral-700 hover:bg-white"
            }`}
          >
            {editMode ? "Done" : "Edit"}
          </button>

          {editMode && (
            <div className="pointer-events-none absolute right-5 top-16 max-w-xs rounded-md border border-neutral-200 bg-white/95 px-3.5 py-2 text-[11px] leading-relaxed text-neutral-700 shadow-sm backdrop-blur">
              Click any room label to rename it. Press Enter or Esc to commit.
            </div>
          )}

          {/* Live cursor coords — hover the house, read the numbers off
              the bottom-left chip, tell me which positions to use when
              reshaping rooms. */}
          <CoordReadout />

          {draggingProfileId && (
            <div className="pointer-events-none absolute right-5 bottom-16 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
              Drop on a room (whole room) or a pin (one task)
            </div>
          )}

          {/* Admin link — bottom-right corner of the 3D view */}
          <Link
            href="/admin"
            className="absolute bottom-5 right-5 rounded-md border border-neutral-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-neutral-900"
          >
            Admin tracking →
          </Link>
        </main>

        {/* Right sidebar — people. Dark surface to match the friend's 3D
            model UI (glassmorphism cards over an obsidian backdrop). */}
        <aside className="flex w-64 flex-col border-l border-white/10 bg-[var(--obsidian)]">
          <PeopleList />
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProfile && (
          <div
            className="glassmorphism flex items-center gap-2.5 rounded-lg px-3 py-2 text-[var(--parchment-silver)] shadow-2xl ring-1 ring-[var(--mint)]/60"
            style={{ width: 240 }}
          >
            <PersonFigure color={colorFromString(activeProfile.id)} size={32} />
            <div>
              <div className="text-sm font-semibold leading-tight text-white">{activeProfile.full_name}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mint)]">
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
