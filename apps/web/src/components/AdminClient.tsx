"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase-data";

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

        <RoomInventorySection />
      </main>
    </div>
  );
}

type InventoryRow = {
  id: string;
  room_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  purchase_frequency: string | null;
};

// Read-only view of each room's current inventory amounts. Fetches once and
// stays live via a realtime subscription so the admin always sees the latest
// counts reported from the user view.
function RoomInventorySection() {
  const storeRooms = useAppStore((s) => s.rooms);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [fetchedNames, setFetchedNames] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("room_inventory")
        .select("id, room_id, name, quantity, unit, category, source, purchase_frequency")
        .order("name");
      if (cancelled) return;
      if (error) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      setRows((data ?? []) as InventoryRow[]);
    };
    void load();

    // Fetch room names directly so the section works even on a direct /admin
    // load (the store is only populated when arriving from the dashboard).
    void (async () => {
      const { data } = await supabase.from("rooms").select("id, name");
      if (cancelled || !data) return;
      setFetchedNames(
        Object.fromEntries((data as { id: string; name: string }[]).map((r) => [r.id, r.name])),
      );
    })();

    const channel = supabase
      .channel("admin_room_inventory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_inventory" },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (unavailable) return null;

  // DB names (fetchedNames) are the source of truth and win; the store may
  // still hold stale seed names on a direct /admin load.
  const roomName = (id: string) =>
    fetchedNames[id] ?? storeRooms.find((r) => r.id === id)?.name ?? id;

  // Group rows by room, ordered by room name.
  const byRoom = new Map<string, InventoryRow[]>();
  for (const r of rows) {
    if (!byRoom.has(r.room_id)) byRoom.set(r.room_id, []);
    byRoom.get(r.room_id)!.push(r);
  }
  const roomIds = [...byRoom.keys()].sort((a, b) =>
    roomName(a).localeCompare(roomName(b)),
  );

  // Cross-room search: match item name, category, source, or room name.
  const q = query.trim().toLowerCase();
  const matches = q
    ? rows
        .filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.category ?? "").toLowerCase().includes(q) ||
            (r.source ?? "").toLowerCase().includes(q) ||
            roomName(r.room_id).toLowerCase().includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Room inventory · {rows.length} items
        </h2>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item or room…"
            className="w-64 rounded-full border border-neutral-300 bg-white py-1.5 pl-8 pr-8 text-sm outline-none focus:border-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {q ? (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {matches.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              No items match “{query}”.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2 text-right">In stock</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matches.map((it) => (
                  <tr key={it.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-neutral-800">{it.name}</div>
                      {it.category && (
                        <div className="text-xs text-neutral-400">{it.category}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {roomName(it.room_id)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-neutral-800">
                      {it.quantity}
                      {it.unit ? <span className="text-neutral-400"> {it.unit}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{it.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : roomIds.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
          No inventory logged yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {roomIds.map((roomId) => {
            const items = byRoom.get(roomId)!;
            return (
              <div
                key={roomId}
                className="overflow-hidden rounded-lg border bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b bg-neutral-50 px-4 py-2">
                  <span className="text-sm font-semibold text-neutral-700">
                    {roomName(roomId)}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 text-right font-medium">In stock</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Frequency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-neutral-800">{it.name}</div>
                          {it.category && (
                            <div className="text-xs text-neutral-400">{it.category}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-neutral-800">
                          {it.quantity}
                          {it.unit ? <span className="text-neutral-400"> {it.unit}</span> : null}
                        </td>
                        <td className="px-4 py-2 text-neutral-500">{it.source ?? "—"}</td>
                        <td className="px-4 py-2 text-neutral-500">
                          {it.purchase_frequency ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
