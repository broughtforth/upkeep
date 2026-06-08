"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useAppStore, colorFromString } from "@/lib/store";
import { PersonFigure } from "./PersonFigure";

/**
 * House-wide tasks — things that aren't tied to a room you click in the
 * 3D view. Today: just the daily Laundry round. Drop a resident onto the
 * card to assign them; or pick from the dropdown if dragging is awkward.
 *
 * Re-uses the existing assignTaskToProfile / unassignTask flow so all the
 * status updates flow through Supabase + Realtime like any room task.
 */

const HOUSE_TASK_CATEGORIES = ["laundry"] as const;

export function HouseTasksPanel() {
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const profiles = useAppStore((s) => s.profiles);

  // Find this list of "house-wide" instances. A house task is any active
  // instance whose template category is in HOUSE_TASK_CATEGORIES (currently
  // just laundry). Filtering on instances keeps the data flow identical to
  // the rest of the app.
  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const houseTasks = instances
    .map((i) => {
      const t = templateById[i.template_id];
      if (!t) return null;
      if (
        !HOUSE_TASK_CATEGORIES.includes(
          t.category as (typeof HOUSE_TASK_CATEGORIES)[number],
        )
      ) {
        return null;
      }
      return { instance: i, template: t };
    })
    .filter(Boolean) as Array<{
    instance: (typeof instances)[number];
    template: (typeof templates)[number];
  }>;

  if (houseTasks.length === 0) return null;

  return (
    <div className="border-b border-[var(--line)] px-5 py-4">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        Today&apos;s house tasks
      </h3>
      <div className="space-y-2">
        {houseTasks.map(({ instance, template }) => (
          <HouseTaskCard
            key={instance.id}
            instanceId={instance.id}
            status={instance.status}
            assigneeId={instance.assignee_id}
            templateName={template.name}
            durationMin={template.duration_min}
            profiles={profiles}
          />
        ))}
      </div>
    </div>
  );
}

interface HouseTaskCardProps {
  instanceId: string;
  status: "pending" | "queued" | "assigned" | "completed";
  assigneeId: string | null;
  templateName: string;
  durationMin: number;
  profiles: ReturnType<typeof useAppStore.getState>["profiles"];
}

function HouseTaskCard({
  instanceId,
  status,
  assigneeId,
  templateName,
  durationMin,
  profiles,
}: HouseTaskCardProps) {
  const assignTaskToProfile = useAppStore((s) => s.assignTaskToProfile);
  const unassignTask = useAppStore((s) => s.unassignTask);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Droppable target for dnd-kit. We use a special id prefix so the
  // DashboardClient.onDragEnd handler can pick this up alongside its
  // existing room-drop / pin-drop logic.
  const { setNodeRef, isOver } = useDroppable({
    id: `house-task-${instanceId}`,
    data: { houseTaskInstanceId: instanceId },
    disabled: status === "completed",
  });

  const assignee = assigneeId
    ? profiles.find((p) => p.id === assigneeId)
    : null;
  const assigneeColor = assignee ? colorFromString(assignee.id) : null;

  const isComplete = status === "completed";
  const isAssigned = status === "assigned";
  const isDragHover = isOver && draggingProfileId && !isComplete;

  const cardStyle: React.CSSProperties = isComplete
    ? { background: "var(--complete-bg)", borderColor: "var(--complete-fg)" }
    : isDragHover
      ? {
          background: "var(--primary-container)",
          borderColor: "var(--primary)",
        }
      : {};

  const stateChip = isComplete
    ? { label: "Done", className: "bg-[var(--complete-bg)] text-[var(--complete-fg)]" }
    : isAssigned
      ? { label: "Active", className: "bg-[#FFE7CF] text-[#C25500]" }
      : { label: "Open", className: "bg-[#FDE2E2] text-[#B23A3A]" };

  // Filter to *present* residents only — same rule as room assignments.
  const eligibleProfiles = profiles.filter(
    (p) => p.present_today !== false,
  );

  return (
    <div className="relative">
      <div
        ref={setNodeRef}
        style={cardStyle}
        className="blocky-card flex w-full flex-col gap-2 px-3 py-3 transition"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => selectInstance(instanceId)}
            className="truncate text-left text-[14px] font-bold leading-tight text-[var(--foreground)] hover:text-[var(--primary)]"
            title="Open task"
          >
            {templateName}
          </button>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${stateChip.className}`}
          >
            {stateChip.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-soft)]">
          <span className="font-mono normal-case tracking-normal">
            ~{durationMin} min
          </span>
          <span className="text-[var(--muted)]">
            Drop person or pick →
          </span>
        </div>

        {/* Assignee row — either the assigned person, or a "pick" button. */}
        {assignee ? (
          <div
            className="-mx-3 -mb-3 mt-1 flex items-center gap-2 rounded-b-[21px] px-3 py-2 text-[12px] font-bold text-white"
            style={{ backgroundColor: assigneeColor ?? "#525252" }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-[9px] font-bold">
              {assignee.full_name[0]}
            </span>
            <span className="truncate">{assignee.full_name}</span>
            {!isComplete && (
              <button
                onClick={() => unassignTask(instanceId)}
                className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-white/30"
                aria-label="Unassign"
              >
                Unassign
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="-mx-3 -mb-3 mt-1 rounded-b-[21px] border-t-2 border-dashed border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[12px] font-bold text-[var(--foreground-soft)] hover:bg-[var(--primary-container)] hover:text-[var(--primary)]"
          >
            + Assign someone
          </button>
        )}
      </div>

      {/* Dropdown picker — anchored under the card. */}
      {pickerOpen && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-2xl border-2 border-[var(--foreground)] bg-[var(--surface)] py-1 shadow-lg"
          onMouseLeave={() => setPickerOpen(false)}
        >
          {eligibleProfiles.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-[var(--muted)]">
              No one is present today.
            </div>
          ) : (
            eligibleProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  assignTaskToProfile(instanceId, p.id);
                  setPickerOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-bold hover:bg-[var(--background)]"
              >
                <PersonFigure color={colorFromString(p.id)} size={22} />
                <span className="truncate">{p.full_name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
