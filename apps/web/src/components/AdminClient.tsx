"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";

export function AdminClient() {
  const profiles = useAppStore((s) => s.profiles);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const rooms = useAppStore((s) => s.rooms);

  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));

  const stats = profiles.map((p) => {
    const mine = instances.filter((i) => i.assignee_id === p.id);
    return {
      profile: p,
      assigned: mine.filter((i) => i.status === "assigned").length,
      completed: mine.filter((i) => i.status === "completed").length,
      total: mine.length,
    };
  });

  const totalTasks = instances.length;
  const completedTotal = instances.filter((i) => i.status === "completed").length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Admin · Activity Tracking</h1>
            <p className="text-xs text-neutral-500">
              {completedTotal} of {totalTasks} tasks completed today
            </p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to house
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Per-person activity
          </h2>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Person</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2 text-right">In progress</th>
                  <th className="px-4 py-2 text-right">Completed</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats
                  .sort((a, b) => b.completed - a.completed)
                  .map((s) => (
                    <tr key={s.profile.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2 font-medium">{s.profile.full_name}</td>
                      <td className="px-4 py-2 text-neutral-500">{s.profile.role}</td>
                      <td className="px-4 py-2 text-right">
                        {s.assigned > 0 ? (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                            {s.assigned}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {s.completed > 0 ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                            {s.completed}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-neutral-700">{s.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            All task instances today
          </h2>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Task</th>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2">Scheduled</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {instances.map((i) => {
                  const t = templateById[i.template_id];
                  const r = roomById[i.room_id];
                  const a = i.assignee_id ? profiles.find((p) => p.id === i.assignee_id) : null;
                  return (
                    <tr key={i.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2 font-medium">{t?.name}</td>
                      <td className="px-4 py-2 text-neutral-700">{r?.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                        {new Date(i.scheduled_for).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <StatusPill status={i.status} />
                      </td>
                      <td className="px-4 py-2 text-neutral-700">{a?.full_name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "queued" | "assigned" | "completed" }) {
  const cls = {
    pending: "bg-red-100 text-red-700",
    queued: "bg-amber-100 text-amber-700",
    assigned: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
