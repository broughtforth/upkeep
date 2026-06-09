"use client";

import { Html } from "@react-three/drei";
import { useAppStore, colorFromString, type RoomLabel } from "@/lib/store";
import { useCountdown } from "@/lib/countdown";
import { useViewModeContext } from "@/components/ViewModeProvider";
import { FEATURES } from "@/lib/feature-flags";
import type { TaskInstance, TaskTemplate, Profile, RoomType } from "@/lib/types";

// One interactive card shown only for the room currently zoomed into.
// Structure mirrors the sidebar resident card exactly:
//
//   [ figure 38px ]  [ Name           STATE PILL ]
//                    [ status line + meta        ]
//                    [ secondary line            ]
//
// so a clicked room reads as part of the same visual family as the people.

export function RoomNodes() {
  const roomLabels = useAppStore((s) => s.roomLabels);
  const selectedInstanceId = useAppStore((s) => s.selectedInstanceId);
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);

  // Hide nodes while the dialog is open so the modal isn't fighting them
  // for z-index. Mirrors the pattern used by the old TaskPins.
  if (selectedInstanceId) return null;

  // Only show the full card for the room currently zoomed into. Everything
  // else gets nothing (the small floating label in House.tsx is enough at
  // the dashboard's overview zoom). Click any label to zoom in and reveal
  // its card.
  if (!zoomedRoomId) return null;

  const zoomedLabel = roomLabels.find((l) => l.id === zoomedRoomId);
  if (!zoomedLabel) return null;

  return (
    <group>
      <RoomNode label={zoomedLabel} />
    </group>
  );
}

function RoomNode({ label }: { label: RoomLabel }) {
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const profiles = useAppStore((s) => s.profiles);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const view = useViewModeContext();

  // Filter the templates / instances pair to those whose category is visible
  // in the current view mode (morning vs evening). Deep-clean templates are
  // always visible (the visibleCategories set includes them) since they
  // rotate independently of the daily window.
  const allRoomTemplates = templates.filter((t) => t.room_id === label.id);
  const visibleTemplateIds = new Set(
    allRoomTemplates
      .filter((t) => view.visibleCategories.has(t.category))
      .map((t) => t.id),
  );
  const roomTemplates = allRoomTemplates.filter((t) =>
    visibleTemplateIds.has(t.id),
  );
  const roomInstances = instances.filter(
    (i) => i.room_id === label.id && visibleTemplateIds.has(i.template_id),
  );

  if (roomTemplates.length === 0) return null;

  // Templates split by daily vs deep-clean. Deep-clean is a separate
  // recurring rotation surfaced into the room when due (migration 0008).
  const dailyTemplateIds = new Set(
    roomTemplates.filter((t) => t.category !== "deep-clean").map((t) => t.id),
  );
  const deepCleanInstances = roomInstances.filter(
    (i) => !dailyTemplateIds.has(i.template_id),
  );
  const dailyInstances = roomInstances.filter((i) =>
    dailyTemplateIds.has(i.template_id),
  );

  // Total estimated minutes — sum across every task in this room.
  const totalMinutes = roomTemplates.reduce((sum, t) => sum + t.duration_min, 0);

  // The room card always reads as the daily task; deep-cleans are surfaced
  // separately. Falls back to whichever instance exists if there's no daily
  // task (e.g. a hallway-anchored, house-wide deep-clean).
  const candidateInstances =
    dailyInstances.length > 0 ? dailyInstances : roomInstances;
  const active = candidateInstances.find((i) => i.status === "assigned");
  const pending = candidateInstances.find((i) => i.status === "pending");
  const completed = candidateInstances.every((i) => i.status === "completed");
  const primary: TaskInstance | undefined =
    active ?? pending ?? candidateInstances[0];

  if (!primary) return null;

  const primaryTemplate: TaskTemplate | undefined = templates.find(
    (t) => t.id === primary.template_id,
  );
  if (!primaryTemplate) return null;

  // Has any deep-clean task that isn't already completed? Used for the +DC
  // badge on the card.
  const openDeepClean = deepCleanInstances.find(
    (i) => i.status !== "completed",
  );

  const assignee: Profile | null = primary.assignee_id
    ? profiles.find((p) => p.id === primary.assignee_id) ?? null
    : null;
  const assigneeColor = assignee ? colorFromString(assignee.id) : null;

  return (
    <Html
      position={label.position}
      center
      distanceFactor={9}
      zIndexRange={[20, 0]}
      wrapperClass="room-node-wrapper"
    >
      <RoomNodeCard
        template={primaryTemplate}
        instance={primary}
        roomName={label.name}
        roomType={label.type}
        totalMinutes={totalMinutes}
        assignee={assignee}
        assigneeColor={assigneeColor}
        allCompleted={completed}
        dragging={draggingProfileId !== null}
        deepCleanInstanceId={openDeepClean?.id}
        onClick={() => selectInstance(primary.id)}
      />
    </Html>
  );
}

// Same dimensions / structure as the sidebar PersonCard. Click anywhere on
// the card to open the CompleteDialog.
function RoomNodeCard({
  template,
  instance,
  roomName,
  roomType,
  totalMinutes,
  assignee,
  assigneeColor,
  allCompleted,
  dragging,
  deepCleanInstanceId,
  onClick,
}: {
  template: TaskTemplate;
  instance: TaskInstance;
  roomName: string;
  roomType: RoomType;
  totalMinutes: number;
  assignee: Profile | null;
  assigneeColor: string | null;
  allCompleted: boolean;
  dragging: boolean;
  // When the room has a still-open deep-clean rotation, the badge becomes
  // a clickable jump-link that opens that instance's dialog.
  deepCleanInstanceId?: string;
  onClick: () => void;
}) {
  const selectInstance = useAppStore((s) => s.selectInstance);
  const countdown = useCountdown(
    instance.status === "assigned" ? instance.assigned_at : null,
    template.duration_min,
  );

  const doneCount = instance.subtasks_done.length;
  const totalSubtasks = template.subtasks.length;
  const isAssigned = instance.status === "assigned";
  const isPending = instance.status === "pending";

  // Card variants — complete = sage tint. Pending and assigned keep the
  // chunky white card; the state pill carries the urgency colour.
  const cardStyle: React.CSSProperties = allCompleted
    ? { background: "var(--complete-bg)", borderColor: "var(--complete-fg)" }
    : {};

  const stateChip = allCompleted
    ? { label: "Clean",   className: "bg-[var(--complete-bg)] text-[var(--complete-fg)] border border-[var(--complete-fg)]" }
    : isAssigned
      ? { label: "Active",  className: "bg-[#FFE7CF] text-[#C25500]" }
      : isPending
        ? { label: "Pending", className: "bg-[#FDE2E2] text-[#B23A3A]" }
        : { label: "Queued",  className: "bg-[#FFE7CF] text-[#9A5A00]" };

  // Status line — mirrors the resident card's "● 1 active" pattern.
  const statusDotClass = allCompleted
    ? "bg-[var(--complete-fg)]"
    : isAssigned
      ? "bg-[var(--primary)]"
      : isPending
        ? "bg-[#B23A3A]"
        : "border-2 border-[var(--muted)]";

  const statusText = allCompleted
    ? "Clean"
    : isAssigned
      ? "In progress"
      : isPending
        ? "Pending"
        : "Queued";

  // The countdown / time text. Live countdown when assigned, otherwise the
  // sum of all task durations.
  const timeText = countdown ? countdown.label : `~${totalMinutes} min`;
  const timeClassName = countdown?.overdue
    ? "text-[var(--danger)]"
    : countdown && countdown.fraction > 0.75
      ? "text-[#C25500]"
      : "text-[var(--foreground-soft)]";

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (dragging) return;
        onClick();
      }}
      style={cardStyle}
      className="blocky-card group/node relative flex w-[320px] cursor-pointer flex-col gap-3 px-5 py-4 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
      title={template.name}
    >
      {/* Soft pulse halo on pending */}
      {isPending && (
        <span className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-[24px] bg-red-400/25" />
      )}

      {/* HEADER ROW — glyph + name/state on left, deep-clean chip on right.
          Each element gets its own column so nothing collides. */}
      <div className="flex items-start gap-3">
        <RoomGlyph type={roomType} complete={allCompleted} />

        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[19px] font-bold leading-tight text-[var(--foreground)]"
            style={allCompleted ? { color: "var(--complete-fg)" } : undefined}
          >
            {roomName}
          </div>
          <div className="mt-1.5">
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${stateChip.className}`}
            >
              {stateChip.label}
            </span>
          </div>
        </div>

        {/* Deep-clean chip — gated behind FEATURES.deepClean. */}
        {FEATURES.deepClean && deepCleanInstanceId && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              selectInstance(deepCleanInstanceId);
            }}
            title="Open the deep-clean task"
            className="flex-shrink-0 self-start whitespace-nowrap rounded-md bg-[#3F3D72] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#2E2D54]"
          >
            + Deep Clean
          </button>
        )}
      </div>

      {/* STATUS ROW — dot + text + meta, all on one horizontal line.
          Larger size + no-wrap so it can't break mid-pill. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-bold uppercase tracking-[0.1em] text-[var(--foreground-soft)]">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
          <span>{statusText}</span>
        </span>
        <span className="text-[var(--muted-soft)]">·</span>
        <span className={`whitespace-nowrap font-mono normal-case tracking-normal ${timeClassName}`}>
          {timeText}
        </span>
        {totalSubtasks > 0 && (
          <>
            <span className="text-[var(--muted-soft)]">·</span>
            <span className="whitespace-nowrap font-mono normal-case tracking-normal text-[var(--muted)]">
              {doneCount}/{totalSubtasks}
            </span>
          </>
        )}
      </div>

      {/* SECONDARY ROW — assignee or task name. Always one truncated line. */}
      {assignee ? (
        <div
          className="flex min-w-0 items-center gap-2 text-[14px] font-bold italic"
          style={{ color: assigneeColor ?? "var(--foreground)" }}
        >
          <span
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: assigneeColor ?? "#525252" }}
          >
            {assignee.full_name[0]}
          </span>
          <span className="min-w-0 flex-1 truncate">{assignee.full_name}</span>
        </div>
      ) : (
        <div className="min-w-0 truncate text-[14px] font-medium italic text-[var(--muted)]">
          → {template.name}
        </div>
      )}
    </button>
  );
}

// Round badge in the room-type colour with an emoji glyph — the room-card's
// visual hook on the left, matching the 38px PersonFigure footprint.
function RoomGlyph({ type, complete }: { type: RoomType; complete: boolean }) {
  const glyph: Record<RoomType, string> = {
    bathroom: "🛁",
    kitchen: "🍳",
    bedroom: "🛏",
    living: "◐",
    tech: "⚡",
    corridor: "↔",
  };
  return (
    <div
      className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full border-2 text-xl"
      style={{
        background: complete ? "var(--complete-bg)" : "var(--primary-container)",
        borderColor: complete ? "var(--complete-fg)" : "var(--primary)",
        color: complete ? "var(--complete-fg)" : "var(--primary)",
      }}
      aria-hidden
    >
      {glyph[type]}
    </div>
  );
}
