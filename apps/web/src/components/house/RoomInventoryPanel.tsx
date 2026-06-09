"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore, colorFromString } from "@/lib/store";
import { supabase } from "@/lib/supabase-data";
import type { TaskInstance, TaskStatus } from "@/lib/types";

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  purchase_frequency: string | null;
  special_requests: string | null;
};

const SELECT =
  "id, name, quantity, unit, category, source, purchase_frequency, special_requests";

// Status pill styling for the per-room task list, matching the colour
// language used on the room card and resident cards.
const STATUS_CHIP: Record<TaskStatus, { label: string; className: string }> = {
  completed: {
    label: "Done",
    className: "bg-[var(--complete-bg)] text-[var(--complete-fg)]",
  },
  assigned: { label: "Active", className: "bg-[#FFE7CF] text-[#C25500]" },
  queued: { label: "Queued", className: "bg-[#FFE7CF] text-[#9A5A00]" },
  pending: { label: "Open", className: "bg-[#FDE2E2] text-[#B23A3A]" },
};

// Read-only inventory for the room currently zoomed into. Appears when a room
// is clicked in the 3D view (zoomedRoomId set) and shows that room's current
// stock amounts, kept live via a realtime subscription. Closing zoom (clicking
// empty space or the × here) hides it.
export function RoomInventoryPanel() {
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);
  const roomLabels = useAppStore((s) => s.roomLabels);
  const zoomToRoom = useAppStore((s) => s.zoomToRoom);
  const instances = useAppStore((s) => s.instances);
  const templates = useAppStore((s) => s.templates);
  const profiles = useAppStore((s) => s.profiles);
  const selectInstance = useAppStore((s) => s.selectInstance);

  // Every task anchored to the zoomed room, regardless of view mode — the
  // panel is meant to be a full picture of the room, so we show morning,
  // evening, deep-clean and room-reset tasks together rather than just the
  // current window's slice.
  const roomTasks = useMemo(() => {
    if (!zoomedRoomId) return [];
    const templateById = new Map(templates.map((t) => [t.id, t]));
    return instances
      .filter((i) => i.room_id === zoomedRoomId)
      .map((i) => ({ instance: i, template: templateById.get(i.template_id) }))
      .filter(
        (x): x is { instance: TaskInstance; template: NonNullable<typeof x.template> } =>
          !!x.template,
      )
      .sort((a, b) => {
        // Open work first (pending/assigned), completed sinks to the bottom.
        const rank = (s: TaskStatus) => (s === "completed" ? 1 : 0);
        return rank(a.instance.status) - rank(b.instance.status);
      });
  }, [zoomedRoomId, instances, templates]);

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // The room panel now opens in every view mode. The room-reset task (and any
  // other anchored task) shows up in the Tasks list below; clicking it opens
  // its dialog, so night mode no longer needs to special-case the click.
  useEffect(() => {
    if (!zoomedRoomId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const { data, error } = await supabase
        .from("room_inventory")
        .select(SELECT)
        .eq("room_id", zoomedRoomId)
        .order("name");
      if (cancelled) return;
      setRows(error ? [] : ((data ?? []) as InventoryRow[]));
      setLoading(false);
    };
    void load();

    const channel = supabase
      .channel(`house_inventory_${zoomedRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_inventory",
          filter: `room_id=eq.${zoomedRoomId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [zoomedRoomId]);

  if (!zoomedRoomId) return null;

  const roomName =
    roomLabels.find((r) => r.id === zoomedRoomId)?.name ?? zoomedRoomId;

  return (
    <div className="pointer-events-auto absolute left-5 top-24 z-50 flex max-h-[calc(100vh-7.5rem)] w-[17rem] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl ring-1 ring-black/5"
      style={{
        // Height shrinks to content (header + at most ~6 rows or empty state)
        // so the panel doesn't dominate the viewport when there's nothing
        // logged. Tailwind h-fit is overridden by max-h above when full.
        height: "fit-content",
        minHeight: rows.length > 0 ? "180px" : "auto",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Room
          </div>
          <div className="truncate text-[15px] font-bold leading-tight text-[var(--foreground)]">
            {roomName}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {rows.length > 0 && (
            <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary)]">
              {rows.length}
            </span>
          )}
          <button
            onClick={() => zoomToRoom(null)}
            aria-label="Close inventory"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[16px] leading-none text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tasks for this room — listed above the inventory so a click on a
          room surfaces both the work to do and the stock on hand. Each row
          opens that task's dialog. */}
      <div className="border-t border-[var(--line)]">
        <div className="px-4 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
          Tasks
        </div>
        {roomTasks.length === 0 ? (
          <div className="px-4 pb-3 text-[12.5px] text-[var(--muted)]">
            No tasks for this room right now.
          </div>
        ) : (
          <div className="pb-1.5">
            {roomTasks.map(({ instance, template }) => {
              const assignee = instance.assignee_id
                ? profiles.find((p) => p.id === instance.assignee_id)
                : null;
              const chip = STATUS_CHIP[instance.status];
              return (
                <button
                  key={instance.id}
                  onClick={() => selectInstance(instance.id)}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition hover:bg-[var(--background)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold leading-snug text-[var(--foreground)]">
                      {template.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] leading-tight text-[var(--muted)]">
                      <span className="font-mono">~{template.duration_min}m</span>
                      {assignee && (
                        <>
                          <span>·</span>
                          <span
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ backgroundColor: colorFromString(assignee.id) }}
                          >
                            {assignee.full_name[0]}
                          </span>
                          <span className="truncate">{assignee.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Inventory label so the two sections read distinctly. */}
      <div className="border-t border-[var(--line)] px-4 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        Inventory
      </div>

      {/* Body — height tracks contents; loading / empty states get their
          own padding instead of stretching to the fixed parent. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-6 text-center text-[13px] text-[var(--muted)]">
            No inventory logged for this room.
          </div>
        ) : (
          rows.map((it) => {
            const meta = [it.category, it.source, it.purchase_frequency]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={it.id}
                className="flex items-baseline justify-between gap-3 px-4 py-2 odd:bg-[var(--background)]/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold leading-snug text-[var(--foreground)]">
                    {it.name}
                  </div>
                  {meta && (
                    <div className="truncate text-[11px] leading-tight text-[var(--muted)]">
                      {meta}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 whitespace-nowrap tabular-nums">
                  <span className="text-[14px] font-bold text-[var(--primary)]">
                    {it.quantity}
                  </span>
                  {it.unit && (
                    <span className="ml-0.5 text-[11px] text-[var(--muted)]">
                      {it.unit}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
