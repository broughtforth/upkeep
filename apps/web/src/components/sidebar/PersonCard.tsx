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
      className={`blocky-card group relative flex cursor-grab items-center gap-3 px-3 py-3 transition active:cursor-grabbing ${
        isDragging || isSelf
          ? "opacity-30"
          : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <PersonFigure color={color} size={38} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-base font-bold leading-tight text-[var(--foreground)]">
            {profile.full_name}
          </span>
          {profile.role === "admin" && (
            <span className="rounded-md bg-[var(--primary-container)] px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
              Admin
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-soft)]">
          <span
            className={`h-2 w-2 rounded-full ${
              busy
                ? "bg-[var(--primary)]"
                : "border-2 border-[var(--muted)]"
            }`}
          />
          <span>{busy ? `${activeCount} active` : "Free"}</span>
          {queuedCount > 0 && (
            <span className="text-[var(--muted)]">
              · {queuedCount} queued
            </span>
          )}
          {completedCount > 0 && (
            <span className="text-[var(--complete-fg)]">
              · {completedCount} done
            </span>
          )}
        </div>
        {currentTaskName && (
          <div className="mt-1.5 truncate text-[13px] font-medium italic text-[var(--foreground-soft)]">
            → {currentTaskName}
          </div>
        )}
      </div>
    </div>
  );
}
