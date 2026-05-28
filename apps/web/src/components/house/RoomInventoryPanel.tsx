"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase-data";

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

// Read-only inventory for the room currently zoomed into. Appears when a room
// is clicked in the 3D view (zoomedRoomId set) and shows that room's current
// stock amounts, kept live via a realtime subscription. Closing zoom (clicking
// empty space or the × here) hides it.
export function RoomInventoryPanel() {
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);
  const roomLabels = useAppStore((s) => s.roomLabels);
  const zoomToRoom = useAppStore((s) => s.zoomToRoom);

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);

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
    <div className="pointer-events-auto absolute left-5 top-24 z-50 flex h-[440px] max-h-[calc(100vh-7.5rem)] w-[17rem] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Inventory
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

      {/* Body — fixed-height region; the list scrolls when there are many
          items, while loading / empty states sit centred. */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--line)]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[var(--muted)]">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[var(--muted)]">
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
