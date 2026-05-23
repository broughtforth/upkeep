"use client";

import { useAppStore } from "@/lib/store";
import type { TaskCategory, TaskInstance } from "@/lib/types";

const CATEGORY_SYMBOL: Record<TaskCategory, string> = {
  cleaning: "◐",
  supplies: "⚡",
  cooking: "⌂",
  laundry: "≋",
};

export function TaskList() {
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const rooms = useAppStore((s) => s.rooms);
  const profiles = useAppStore((s) => s.profiles);
  const selectInstance = useAppStore((s) => s.selectInstance);

  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const pending = instances.filter((i) => i.status === "pending");
  const assigned = instances.filter((i) => i.status === "assigned");
  const done = instances.filter((i) => i.status === "completed");

  const completedCount = done.length;
  const total = instances.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-base font-semibold tracking-tight">
            Today's Rituals
          </h2>
          <span className="font-mono text-[11px] text-neutral-500">
            {completedCount}/{total}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(completedCount / Math.max(total, 1)) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Use with intent · Reset completely
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {pending.length > 0 && (
          <Section title="Pending" count={pending.length} dotClass="bg-red-500">
            {pending.map((i) => (
              <TaskRow
                key={i.id}
                instance={i}
                templateName={templateById[i.template_id]?.name ?? "Task"}
                templateSymbol={CATEGORY_SYMBOL[templateById[i.template_id]?.category ?? "cleaning"]}
                roomName={roomById[i.room_id]?.name ?? "Room"}
                assigneeName={null}
                onClick={() => selectInstance(i.id)}
              />
            ))}
          </Section>
        )}

        {assigned.length > 0 && (
          <Section title="In Progress" count={assigned.length} dotClass="bg-orange-500">
            {assigned.map((i) => (
              <TaskRow
                key={i.id}
                instance={i}
                templateName={templateById[i.template_id]?.name ?? "Task"}
                templateSymbol={CATEGORY_SYMBOL[templateById[i.template_id]?.category ?? "cleaning"]}
                roomName={roomById[i.room_id]?.name ?? "Room"}
                assigneeName={i.assignee_id ? profileById[i.assignee_id]?.full_name ?? null : null}
                onClick={() => selectInstance(i.id)}
              />
            ))}
          </Section>
        )}

        {done.length > 0 && (
          <Section title="Complete" count={done.length} dotClass="bg-green-500">
            {done.map((i) => (
              <TaskRow
                key={i.id}
                instance={i}
                templateName={templateById[i.template_id]?.name ?? "Task"}
                templateSymbol={CATEGORY_SYMBOL[templateById[i.template_id]?.category ?? "cleaning"]}
                roomName={roomById[i.room_id]?.name ?? "Room"}
                assigneeName={i.assignee_id ? profileById[i.assignee_id]?.full_name ?? null : null}
                onClick={() => selectInstance(i.id)}
                muted
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  dotClass,
  children,
}: {
  title: string;
  count: number;
  dotClass: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {title}
        </h3>
        <span className="text-[10px] text-neutral-400">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function TaskRow({
  instance,
  templateName,
  templateSymbol,
  roomName,
  assigneeName,
  onClick,
  muted = false,
}: {
  instance: TaskInstance;
  templateName: string;
  templateSymbol: string;
  roomName: string;
  assigneeName: string | null;
  onClick: () => void;
  muted?: boolean;
}) {
  const time = new Date(instance.scheduled_for).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-left transition hover:border-neutral-300 hover:bg-neutral-50 ${
        muted ? "opacity-70" : ""
      }`}
    >
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-neutral-100 font-serif text-base text-neutral-700">
        {templateSymbol}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-tight text-neutral-900">
          {templateName}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
          <span>{roomName}</span>
          <span className="text-neutral-300">·</span>
          <span className="font-mono">{time}</span>
        </div>
        {assigneeName && (
          <div className="mt-1 text-[11px] italic text-neutral-600">→ {assigneeName}</div>
        )}
      </div>
    </button>
  );
}
