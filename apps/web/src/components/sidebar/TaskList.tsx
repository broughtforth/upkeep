"use client";

import type { TaskInstanceWithDetails } from "@upkeep/shared";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-neutral-300",
  in_progress: "bg-amber-500",
  complete: "bg-green-500",
};

export function TaskList({
  instances,
}: {
  instances: TaskInstanceWithDetails[];
}) {
  const groups = {
    in_progress: instances.filter((i) => i.status === "in_progress"),
    pending: instances.filter((i) => i.status === "pending"),
    complete: instances.filter((i) => i.status === "complete"),
  };

  return (
    <aside className="flex flex-col gap-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50/50 p-3">
      <header className="px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Today
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          {instances.length} task{instances.length === 1 ? "" : "s"} · drop on
          a room to assign.
        </p>
      </header>

      <Group label="In progress" items={groups.in_progress} />
      <Group label="Pending" items={groups.pending} />
      <Group label="Done" items={groups.complete} />
    </aside>
  );
}

function Group({
  label,
  items,
}: {
  label: string;
  items: TaskInstanceWithDetails[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <span
              className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                STATUS_DOT[i.status] ?? "bg-neutral-300"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {i.template?.title}
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                {i.room?.name ?? "Whole house"}
                {i.assignee
                  ? ` · ${i.assignee.full_name ?? i.assignee.email.split("@")[0]}`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
