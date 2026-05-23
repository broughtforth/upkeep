"use client";

import { useDraggable } from "@dnd-kit/core";
import { useAppStore, colorFromString } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { PersonFigure } from "./PersonFigure";

interface Props {
  profile: Profile;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  currentTaskName: string | null;
}

export function PersonCard({
  profile,
  activeCount,
  queuedCount,
  completedCount,
  currentTaskName,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `person-${profile.id}`,
    data: { profileId: profile.id },
  });
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const selectProfile = useAppStore((s) => s.selectProfile);
  const isSelf = draggingProfileId === profile.id;

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};

  const color = colorFromString(profile.id);
  const busy = activeCount > 0;

  // Click without drag (dnd-kit only activates after 6px of movement) opens
  // the resident's task history.
  const onClick = () => {
    if (isDragging) return;
    selectProfile(profile.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`glassmorphism group relative flex cursor-grab items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--parchment-silver)] transition active:cursor-grabbing ${
        isDragging || isSelf
          ? "opacity-30"
          : "hover:-translate-y-px hover:bg-white/10 hover:border-white/20"
      }`}
    >
      <PersonFigure color={color} size={38} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight text-white">
            {profile.full_name}
          </span>
          {profile.role === "admin" && (
            <span className="rounded bg-[var(--mint)]/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--mint)]">
              Admin
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              busy ? "bg-[var(--mint)]" : "border border-white/40"
            }`}
          />
          <span>{busy ? `${activeCount} active` : "Free"}</span>
          {queuedCount > 0 && (
            <span className="text-white/45">· {queuedCount} queued</span>
          )}
          {completedCount > 0 && (
            <span className="text-white/30">· {completedCount} done</span>
          )}
        </div>
        {currentTaskName && (
          <div className="mt-1 truncate text-[11px] italic text-white/55">
            → {currentTaskName}
          </div>
        )}
      </div>
    </div>
  );
}
