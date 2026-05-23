"use client";

import { Html } from "@react-three/drei";
import { useAppStore, colorFromString } from "@/lib/store";
import { useCountdown } from "@/lib/countdown";
import type { Profile, TaskCategory, TaskInstance, TaskStatus, TaskTemplate } from "@/lib/types";

interface Props {
  roomId: string;
}

const CATEGORY_SYMBOL: Record<TaskCategory, string> = {
  cleaning: "◐",
  supplies: "⚡",
  cooking: "⌂",
  laundry: "≋",
};

// Status fallback — used when no assignee colour applies.
const STATUS_STYLE: Record<TaskStatus, string> = {
  pending: "border-red-500 bg-red-50 text-red-700",
  queued: "border-amber-400 bg-amber-50 text-amber-700",
  assigned: "border-orange-500 bg-orange-50 text-orange-700",
  completed: "border-green-500 bg-green-50 text-green-700",
};

export function TaskPins({ roomId }: Props) {
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const profiles = useAppStore((s) => s.profiles);
  const selectedInstanceId = useAppStore((s) => s.selectedInstanceId);

  // Hide every pin while the read-instructions dialog is open — otherwise
  // the Html portal's z-index can poke through the modal backdrop.
  if (selectedInstanceId) return null;

  const roomInstances = instances.filter((i) => i.room_id === roomId);
  if (roomInstances.length === 0) return null;

  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  // Queue positions: per-assignee, walk templates in declaration order and
  // assign 1, 2, 3, … to each queued task. Position 1 = up next.
  const queuePositions = new Map<string, number>();
  const seenByAssignee = new Map<string, number>();
  for (const t of templates) {
    if (t.room_id !== roomId) continue;
    const inst = roomInstances.find((i) => i.template_id === t.id);
    if (!inst || inst.status !== "queued" || !inst.assignee_id) continue;
    const seen = (seenByAssignee.get(inst.assignee_id) ?? 0) + 1;
    queuePositions.set(inst.id, seen);
    seenByAssignee.set(inst.assignee_id, seen);
  }

  // If two pins fall on the same spot, fan them out slightly.
  const grouped = new Map<string, number>();

  return (
    <group>
      {roomInstances.map((inst) => {
        const t = templateById[inst.template_id];
        if (!t) return null;

        const key = `${t.pin.x},${t.pin.y},${t.pin.z}`;
        const idx = grouped.get(key) ?? 0;
        grouped.set(key, idx + 1);
        // Fan out same-pin tasks horizontally by 0.35 m increments.
        const offsetX = idx * 0.35;
        const pos: [number, number, number] = [t.pin.x + offsetX, t.pin.y, t.pin.z];
        const a = inst.assignee_id ? profileById[inst.assignee_id] : null;

        return (
          <Pin
            key={inst.id}
            roomId={roomId}
            instance={inst}
            template={t}
            assignee={a}
            position={pos}
            queuePosition={queuePositions.get(inst.id) ?? null}
          />
        );
      })}
    </group>
  );
}

interface PinProps {
  roomId: string;
  instance: TaskInstance;
  template: TaskTemplate;
  assignee: Profile | null;
  position: [number, number, number];
  queuePosition: number | null;
}

function Pin({ roomId, instance, template, assignee, position, queuePosition }: PinProps) {
  const selectInstance = useAppStore((s) => s.selectInstance);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const isDropHover = useAppStore(
    (s) =>
      s.draggingProfileId !== null &&
      s.hoveredInstanceId === instance.id &&
      instance.status === "pending",
  );

  // Live timer once actively assigned; null otherwise.
  const countdown = useCountdown(
    instance.status === "assigned" ? instance.assigned_at : null,
    template.duration_min,
  );

  const symbol = CATEGORY_SYMBOL[template.category];
  const subtaskProgress = template.subtasks.length
    ? `${instance.subtasks_done.length}/${template.subtasks.length}`
    : "";

  const assigneeColor = assignee ? colorFromString(assignee.id) : null;
  const useAssigneeColor = instance.status === "assigned" && assigneeColor;
  const isQueued = instance.status === "queued";

  // Active pin = solid in person's colour. Queued pin = same colour but
  // dialled back so the active task reads as "the one happening now".
  const inlineStyle: React.CSSProperties = useAssigneeColor
    ? {
        borderColor: assigneeColor!,
        backgroundColor: assigneeColor!,
        color: "#fff",
      }
    : isQueued && assigneeColor
      ? {
          borderColor: assigneeColor!,
          borderStyle: "dashed",
          color: assigneeColor!,
          backgroundColor: "#fff",
        }
      : {};

  return (
    <group position={position}>
      {/* Invisible raycast target so the document-level DragHover raycaster
          can resolve "the cursor is over this pin" while a drag is in flight. */}
      <mesh userData={{ instanceId: instance.id, roomId }}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={isDropHover ? 0.35 : 0}
          color={isDropHover ? "#3b82f6" : "#000000"}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[0, 0, 0]}
        center
        distanceFactor={9}
        zIndexRange={[20, 0]}
        wrapperClass="task-pin-wrapper"
      >
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (draggingProfileId) return;
              selectInstance(instance.id);
            }}
            style={inlineStyle}
            className={`group/pin relative flex items-center justify-center rounded-full border-[1.5px] bg-white text-[12px] font-semibold leading-none shadow-md transition ${
              isDropHover ? "h-8 w-8 ring-2 ring-blue-400 ring-offset-1" : "h-6 w-6 hover:h-7 hover:w-7"
            } ${useAssigneeColor || (isQueued && assigneeColor) ? "" : STATUS_STYLE[instance.status]}`}
            title={template.name}
          >
            <span className="-mt-px">{symbol}</span>

            {instance.status === "pending" && (
              <span className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full bg-red-400/60" />
            )}

            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover/pin:opacity-100">
              {template.name}
              {instance.status === "assigned" && subtaskProgress && (
                <span className="ml-1.5 font-mono text-neutral-400">({subtaskProgress})</span>
              )}
              {isQueued && queuePosition && (
                <span className="ml-1.5 font-mono text-neutral-400">(#{queuePosition} in queue)</span>
              )}
            </span>
          </button>

          {/* Always-visible chip below the pin */}
          {assignee && (
            <div
              className="pointer-events-none mt-1 flex items-center gap-1 whitespace-nowrap rounded-full border border-white bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow"
              style={{ color: assigneeColor! }}
            >
              <span>{assignee.full_name}</span>
              {countdown && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span
                    className={`font-mono tabular-nums ${
                      countdown.overdue
                        ? "text-red-600"
                        : countdown.fraction > 0.75
                          ? "text-orange-600"
                          : "text-neutral-700"
                    }`}
                  >
                    {countdown.label}
                  </span>
                </>
              )}
              {isQueued && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="font-mono uppercase tracking-wider text-neutral-500">
                    {queuePosition === 1 ? "next" : `#${queuePosition}`}
                  </span>
                </>
              )}
              {instance.status === "completed" && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
