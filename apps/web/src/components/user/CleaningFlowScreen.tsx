"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase-data";

type Props = {
  instanceId: string;
  currentUserId: string;
  onBack: () => void;
  onComplete: () => void;
};

type InstanceRow = {
  id: string;
  status: "pending" | "queued" | "assigned" | "completed";
  subtasks_done: string[];
  completed_at: string | null;
  room: { id: string; name: string } | null;
  template: {
    id: string;
    name: string;
    instructions: string;
    subtasks: string[];
    duration_min: number;
  } | null;
};

const COMPLETE_FG = "#1F8F4E";
const COMPLETE_BG = "#E8F5EC";

export function CleaningFlowScreen({
  instanceId,
  currentUserId,
  onBack,
  onComplete,
}: Props) {
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const fetchInstance = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_instances")
      .select(
        "id, status, subtasks_done, completed_at, room:rooms(id, name), template:task_templates(id, name, instructions, subtasks, duration_min)",
      )
      .eq("id", instanceId)
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setInstance(data as unknown as InstanceRow);
    setError(null);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    void fetchInstance();
  }, [fetchInstance]);

  // Realtime subscription on this specific row.
  useEffect(() => {
    const channel = supabase
      .channel(`web_user_instance_${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_instances",
          filter: `id=eq.${instanceId}`,
        },
        () => void fetchInstance(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [instanceId, fetchInstance]);

  const isComplete = instance?.status === "completed";
  const subtasks = instance?.template?.subtasks ?? [];
  const subtasksDone = instance?.subtasks_done ?? [];
  const doneCount = subtasksDone.length;
  const totalCount = subtasks.length;

  const toggleSubtask = async (label: string) => {
    if (!instance || isComplete) return;
    const isDone = subtasksDone.includes(label);
    const nextDone = isDone
      ? subtasksDone.filter((s) => s !== label)
      : [...subtasksDone, label];
    setInstance({ ...instance, subtasks_done: nextDone });
    const { error } = await supabase
      .from("task_instances")
      .update({ subtasks_done: nextDone })
      .eq("id", instance.id);
    if (error) {
      setInstance({ ...instance, subtasks_done: subtasksDone });
      alert(`Could not save: ${error.message}`);
    }
  };

  const markRoomComplete = async () => {
    if (!instance) return;
    setFinishing(true);
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("task_instances")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", instance.id);
    setFinishing(false);
    if (error) {
      alert(`Could not finish: ${error.message}`);
      return;
    }
    onComplete();
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Header onBack={onBack} title="" />
        <div className="flex flex-1 items-center justify-center text-[14px] text-[var(--muted)]">
          Loading…
        </div>
      </main>
    );
  }

  if (error || !instance || !instance.room || !instance.template) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Header onBack={onBack} title="" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-2xl font-bold tracking-tight">
            Couldn&apos;t load this room
          </p>
          <p className="text-[14px] text-[var(--muted)]">
            {error ?? "The task may have been unassigned. Try going back."}
          </p>
        </div>
      </main>
    );
  }

  const room = instance.room;
  const template = instance.template;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <Header onBack={onBack} title={room.name} />

      <div className="flex flex-1 flex-col gap-6">
        {/* Meta row: status + duration */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-3 py-1.5 text-[13px] font-bold"
            style={
              isComplete
                ? { background: COMPLETE_BG, color: COMPLETE_FG }
                : {
                    background: "var(--primary-container)",
                    color: "var(--primary)",
                  }
            }
          >
            {isComplete
              ? "Clean"
              : totalCount > 0
                ? `${doneCount}/${totalCount} done`
                : "Ready to start"}
          </span>
          <span className="text-[14px] font-bold text-[var(--muted)]">
            ~{template.duration_min} min
          </span>
        </div>

        {/* Instructions (collapsible) */}
        {template.instructions && (
          <button
            onClick={() => setInstructionsOpen((v) => !v)}
            className="soft-card text-left transition hover:bg-[var(--background)]"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Read first
              </span>
              <span className="text-[var(--muted)]">
                {instructionsOpen ? "−" : "+"}
              </span>
            </div>
            {instructionsOpen && (
              <p className="whitespace-pre-line border-t border-[var(--line)] px-4 py-3 text-[15px] leading-relaxed text-[var(--foreground-soft)]">
                {template.instructions}
              </p>
            )}
          </button>
        )}

        {/* Checklist */}
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Checklist
          </h2>
          <div className="soft-card overflow-hidden">
            {subtasks.length === 0 && (
              <p className="px-4 py-4 text-center text-[14px] text-[var(--muted)]">
                No checklist for this room.
              </p>
            )}
            {subtasks.map((label) => {
              const checked = subtasksDone.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleSubtask(label)}
                  disabled={isComplete}
                  className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 text-left last:border-b-0 disabled:cursor-default"
                  style={checked ? { background: "#F5F8F6" } : undefined}
                >
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-white"
                    style={{
                      background: checked ? COMPLETE_FG : "var(--surface)",
                      borderColor: checked ? COMPLETE_FG : "var(--muted-soft)",
                    }}
                  >
                    {checked && (
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8 l3 3 l7 -7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-[15px] font-medium ${
                      checked ? "text-[var(--muted)] line-through" : ""
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Room inventory */}
        <RoomInventory roomId={room.id} currentUserId={currentUserId} />
      </div>

      <div className="mt-8 pt-4">
        {isComplete ? (
          <div
            className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[16px] font-bold text-white"
            style={{ background: COMPLETE_FG }}
          >
            ✓ Room marked clean
          </div>
        ) : (
          <button
            onClick={markRoomComplete}
            disabled={finishing}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-6 py-3.5 text-[16px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {finishing ? "Saving…" : "Mark room complete"}
          </button>
        )}
      </div>
    </main>
  );
}

// ---------------- Room inventory ----------------

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  low_threshold: number;
  unit: string | null;
  category: string | null;
  source: string | null;
  purchase_frequency: string | null;
  special_requests: string | null;
};

const INV_COLUMNS =
  "id, name, quantity, low_threshold, unit, category, source, purchase_frequency, special_requests";

type InvStatus = "in" | "low" | "out";

function invStatus(item: InventoryItem): InvStatus {
  if (item.quantity <= 0) return "out";
  if (item.quantity <= item.low_threshold) return "low";
  return "in";
}

const INV_STATUS_COLOR: Record<InvStatus, string> = {
  in: "#1F8F4E",
  low: "#F2A93B",
  out: "#D9534F",
};

// Per-room inventory, logged from inside the room's task flow.
function RoomInventory({
  roomId,
  currentUserId,
}: {
  roomId: string;
  currentUserId: string;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("room_inventory")
      .select(INV_COLUMNS)
      .eq("room_id", roomId)
      .order("name");
    if (error) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setUnavailable(false);
    setItems((data ?? []) as InventoryItem[]);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`web_user_inventory_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_inventory",
          filter: `room_id=eq.${roomId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  // Set an item's stock to an absolute count (typed entry or +/- stepper).
  const setQuantity = async (item: InventoryItem, raw: number) => {
    const nextQty = Math.max(0, raw);
    if (nextQty === item.quantity) return;
    const prev = items;
    setItems((cur) =>
      cur.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i)),
    );
    const { error } = await supabase
      .from("room_inventory")
      .update({
        quantity: nextQty,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId,
      })
      .eq("id", item.id);
    if (error) {
      setItems(prev);
      alert(`Could not save: ${error.message}`);
    }
  };

  const adjust = (item: InventoryItem, delta: number) =>
    void setQuantity(item, item.quantity + delta);

  const addItem = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("room_inventory")
      .insert({
        room_id: roomId,
        name,
        quantity: 1,
        updated_by: currentUserId,
      })
      .select(INV_COLUMNS)
      .single();
    setSaving(false);
    if (error) {
      alert(`Could not add: ${error.message}`);
      return;
    }
    setItems((cur) =>
      [...cur, data as InventoryItem].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setNewName("");
    setAdding(false);
  };

  if (unavailable) {
    return (
      <div>
        <SectionLabel>Room inventory</SectionLabel>
        <div className="soft-card px-4 py-4 text-center text-[14px] text-[var(--muted)]">
          Inventory isn&apos;t set up for this room.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Room inventory</SectionLabel>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            aria-label="Add inventory item"
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--foreground-soft)] transition hover:bg-[var(--background)]"
          >
            + Add item
          </button>
        )}
      </div>

      <div className="soft-card overflow-hidden">
        {loading && (
          <p className="px-4 py-4 text-center text-[14px] text-[var(--muted)]">
            Loading…
          </p>
        )}

        {!loading && items.length === 0 && !adding && (
          <p className="px-4 py-4 text-center text-[14px] text-[var(--muted)]">
            No items logged for this room yet.
          </p>
        )}

        {items.map((item) => {
          const status = invStatus(item);
          const meta = [item.category, item.source, item.purchase_frequency]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0"
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: INV_STATUS_COLOR[status] }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">
                  {item.name}
                </p>
                {meta && (
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">{meta}</p>
                )}
                {item.special_requests && (
                  <p className="mt-0.5 text-[12px] italic text-[var(--foreground-soft)]">
                    “{item.special_requests}”
                  </p>
                )}
              </div>
              <QtyControl
                name={item.name}
                value={item.quantity}
                unit={item.unit}
                onSet={(v) => void setQuantity(item, v)}
                onDelta={(d) => adjust(item, d)}
              />
            </div>
          );
        })}

        {adding && (
          <div className="flex items-center gap-2 border-t border-[var(--line)] px-3 py-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addItem();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              placeholder="Item name…"
              className="min-w-0 flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[15px] outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={() => void addItem()}
              disabled={!newName.trim() || saving}
              className="rounded-full bg-[var(--foreground)] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-40"
            >
              {saving ? "…" : "Add"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              aria-label="Cancel"
              className="px-1 text-[18px] text-[var(--muted)]"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
      {children}
    </h2>
  );
}

function QtyControl({
  name,
  value,
  unit,
  onSet,
  onDelta,
}: {
  name: string;
  value: number;
  unit: string | null;
  onSet: (v: number) => void;
  onDelta: (d: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const n = parseFloat(text);
    if (!Number.isNaN(n) && n >= 0) onSet(n);
    else setText(String(value));
  };

  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <QtyButton label={`Decrease ${name}`} onClick={() => onDelta(-1)}>
          −
        </QtyButton>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          aria-label={`${name} quantity`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-12 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] py-1 text-center text-[17px] font-bold text-[var(--primary)] outline-none focus:border-[var(--primary)]"
        />
        <QtyButton label={`Increase ${name}`} onClick={() => onDelta(1)}>
          +
        </QtyButton>
      </div>
      {unit && (
        <span className="text-[11px] font-medium text-[var(--muted)]">{unit}</span>
      )}
    </div>
  );
}

function QtyButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-container)] text-[18px] font-bold leading-none text-[var(--primary)] transition hover:opacity-80"
    >
      {children}
    </button>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--foreground)] bg-[var(--surface)] text-xl font-bold leading-none transition hover:bg-[var(--background)]"
      >
        ‹
      </button>
      <h1 className="flex-1 truncate text-center text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <div className="h-11 w-11" />
    </div>
  );
}
