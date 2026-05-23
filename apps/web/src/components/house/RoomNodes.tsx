"use client";

import { Html } from "@react-three/drei";
import { useAppStore, colorFromString, type RoomLabel } from "@/lib/store";
import { useCountdown } from "@/lib/countdown";
import type { TaskInstance, TaskTemplate, Profile } from "@/lib/types";

// One interactive node per room, sitting at the room's centroid. Shows the
// task title, total estimated time (sum of every task's duration_min in that
// room — currently one per room but the sum is future-proof), checklist
// progress, and who's working on it. Click → opens CompleteDialog.

export function RoomNodes() {
  const roomLabels = useAppStore((s) => s.roomLabels);
  const selectedInstanceId = useAppStore((s) => s.selectedInstanceId);

  // Hide nodes while the dialog is open so the modal isn't fighting them
  // for z-index. Mirrors the pattern used by the old TaskPins.
  if (selectedInstanceId) return null;

  return (
    <group>
      {roomLabels.map((label) => (
        <RoomNode key={label.id} label={label} />
      ))}
    </group>
  );
}

function RoomNode({ label }: { label: RoomLabel }) {
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const profiles = useAppStore((s) => s.profiles);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);

  // Find tasks for this room. The roomLabels and the seed-task room_ids both
  // use the same id strings (e.g. "bathroom1") so a direct compare works.
  const roomTemplates = templates.filter((t) => t.room_id === label.id);
  const roomInstances = instances.filter((i) => i.room_id === label.id);

  if (roomTemplates.length === 0) return null;

  // Total estimated minutes — sum across every task in this room.
  const totalMinutes = roomTemplates.reduce((sum, t) => sum + t.duration_min, 0);

  // Aggregate room state: pick the "most urgent" instance to drive the look.
  // Priority: assigned (active timer) > pending > queued > completed.
  const active = roomInstances.find((i) => i.status === "assigned");
  const pending = roomInstances.find((i) => i.status === "pending");
  const completed = roomInstances.every((i) => i.status === "completed");
  const primary: TaskInstance | undefined = active ?? pending ?? roomInstances[0];

  if (!primary) return null;

  const primaryTemplate: TaskTemplate | undefined = templates.find(
    (t) => t.id === primary.template_id,
  );
  if (!primaryTemplate) return null;

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
      <RoomNodeButton
        instanceId={primary.id}
        template={primaryTemplate}
        instance={primary}
        roomName={label.name}
        totalMinutes={totalMinutes}
        assignee={assignee}
        assigneeColor={assigneeColor}
        allCompleted={completed}
        dragging={draggingProfileId !== null}
        onClick={() => selectInstance(primary.id)}
      />
    </Html>
  );
}

function RoomNodeButton({
  template,
  instance,
  roomName,
  totalMinutes,
  assignee,
  assigneeColor,
  allCompleted,
  dragging,
  onClick,
}: {
  instanceId: string;
  template: TaskTemplate;
  instance: TaskInstance;
  roomName: string;
  totalMinutes: number;
  assignee: Profile | null;
  assigneeColor: string | null;
  allCompleted: boolean;
  dragging: boolean;
  onClick: () => void;
}) {
  const countdown = useCountdown(
    instance.status === "assigned" ? instance.assigned_at : null,
    template.duration_min,
  );

  const doneCount = instance.subtasks_done.length;
  const totalSubtasks = template.subtasks.length;
  const isAssigned = instance.status === "assigned";
  const isPending = instance.status === "pending";

  // Colour styling — assigned: the assignee's colour fills the chip;
  // pending: red ring with a faint pulse; completed: green; otherwise neutral.
  const ringStyle: React.CSSProperties = isAssigned && assigneeColor
    ? { borderColor: assigneeColor, boxShadow: `0 0 0 2px ${assigneeColor}33` }
    : {};

  const stateChip = allCompleted
    ? { label: "Done", className: "bg-green-100 text-green-700" }
    : isAssigned
      ? { label: "Active", className: "bg-orange-100 text-orange-700" }
      : isPending
        ? { label: "Pending", className: "bg-red-100 text-red-700" }
        : { label: "Queued", className: "bg-amber-100 text-amber-700" };

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (dragging) return;
        onClick();
      }}
      style={ringStyle}
      className={`group/node relative flex min-w-[140px] flex-col items-stretch gap-1 rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-left shadow-md transition hover:-translate-y-px hover:shadow-lg ${
        isAssigned ? "" : isPending ? "border-red-400" : "border-neutral-200"
      }`}
      title={template.name}
    >
      {/* pulse halo on pending */}
      {isPending && (
        <span className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-lg bg-red-400/30" />
      )}

      {/* Header row: room name + state chip */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-700">
          {roomName}
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${stateChip.className}`}
        >
          {stateChip.label}
        </span>
      </div>

      {/* Time / countdown + subtask progress */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="font-mono text-[11px] tabular-nums text-neutral-600">
          {countdown ? (
            <span
              className={
                countdown.overdue
                  ? "text-red-600"
                  : countdown.fraction > 0.75
                    ? "text-orange-600"
                    : "text-neutral-700"
              }
            >
              {countdown.label}
            </span>
          ) : (
            <>~{totalMinutes} min</>
          )}
        </span>
        {totalSubtasks > 0 && (
          <span className="font-mono text-[10px] text-neutral-400">
            {doneCount}/{totalSubtasks}
          </span>
        )}
      </div>

      {/* Assignee chip — only when someone is working on it */}
      {assignee && (
        <div
          className="-mx-2.5 -mb-1.5 mt-0.5 flex items-center gap-1.5 rounded-b-md px-2.5 py-1 text-[10px] font-semibold text-white"
          style={{ backgroundColor: assigneeColor ?? "#525252" }}
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/30 text-[8px] font-bold">
            {assignee.full_name[0]}
          </span>
          <span className="truncate">{assignee.full_name}</span>
        </div>
      )}
    </button>
  );
}
