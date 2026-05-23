"use client";

import { useDraggable } from "@dnd-kit/core";

import type { Profile } from "@upkeep/shared";

function initials(name: string | null, email: string) {
  const s = (name?.trim() || email).trim();
  const parts = s.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonCard({ person }: { person: Profile }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: person.id });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm transition ${
        isDragging ? "cursor-grabbing scale-105 shadow-lg" : ""
      }`}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: person.color ?? "#0F7AEF" }}
      >
        {initials(person.full_name, person.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {person.full_name ?? person.email.split("@")[0]}
        </p>
        <p className="truncate text-xs text-neutral-500">{person.role}</p>
      </div>
    </div>
  );
}

export function PeopleList({ people }: { people: Profile[] }) {
  return (
    <aside className="flex flex-col gap-2 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50/50 p-3">
      <header className="px-1 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Team
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Drag onto a room to assign that room&apos;s pending tasks.
        </p>
      </header>
      {people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">
          No team members signed up yet.
        </p>
      ) : (
        people.map((p) => <PersonCard key={p.id} person={p} />)
      )}
    </aside>
  );
}
