"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchInventory,
  supabase,
  updateInventoryItem,
  type InventoryItem,
} from "@/lib/supabase-data";

// Tiny stock model: status is derived from quantity vs low_threshold.
//   quantity === 0          → "out"
//   quantity <= low_threshold → "low"
//   otherwise                → "ok"
type StockStatus = "ok" | "low" | "out";

function statusFor(item: InventoryItem): StockStatus {
  if (item.quantity <= 0) return "out";
  if (item.quantity <= item.low_threshold) return "low";
  return "ok";
}

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low",
  out: "Out",
};

const STATUS_CLASS: Record<StockStatus, string> = {
  ok: "bg-[var(--complete-bg)] text-[var(--complete-fg)]",
  low: "bg-[#FFE7CF] text-[#9A5A00]",
  out: "bg-[#FDE2E2] text-[#B23A3A]",
};

export function SuppliesClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchInventory();
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load supplies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live updates so two browsers / the mobile app stay in sync.
  useEffect(() => {
    const ch = supabase
      .channel("supplies_inventory_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_inventory" },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const s = statusFor(i);
      if (filter === "low" && s === "ok") return false;
      if (filter === "out" && s !== "out") return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.source ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q) ||
        i.room_id.toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  // Group by room for the per-room sections.
  const byRoom = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    for (const it of filtered) {
      (groups[it.room_id] ??= []).push(it);
    }
    return groups;
  }, [filtered]);

  const lowCount = items.filter((i) => statusFor(i) === "low").length;
  const outCount = items.filter((i) => statusFor(i) === "out").length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--background)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[13px] font-bold text-[var(--primary)] hover:underline"
            >
              ← Back to house
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Supplies</h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[13px] font-bold">
            <span className="text-[var(--complete-fg)]">
              {items.length - lowCount - outCount}
            </span>
            <span className="text-[var(--muted)]">ok</span>
            <span className="text-[var(--muted)]">·</span>
            <span className="text-[#9A5A00]">{lowCount}</span>
            <span className="text-[var(--muted)]">low</span>
            <span className="text-[var(--muted)]">·</span>
            <span className="text-[#B23A3A]">{outCount}</span>
            <span className="text-[var(--muted)]">out</span>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 pb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, source, room…"
            className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[14px] font-medium outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted)]"
          />
          <div className="flex gap-1">
            {(["all", "low", "out"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.16em] transition ${
                  filter === opt
                    ? "border-2 border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]"
                    : "btn-pill-ghost"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading && (
          <div className="py-12 text-center text-[14px] text-[var(--muted)]">
            Loading supplies…
          </div>
        )}

        {error && (
          <div className="soft-card mb-6 px-4 py-3 text-[14px] text-[var(--danger)]">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="soft-card px-4 py-8 text-center">
            <p className="text-base font-bold tracking-tight">
              No items match
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Try clearing the search or switching to &ldquo;All&rdquo;.
            </p>
          </div>
        )}

        {Object.keys(byRoom).map((roomId) => (
          <section key={roomId} className="mb-10">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {roomId}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <table className="w-full text-[14px]">
                <thead className="bg-[var(--background)] text-left text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Reorder at</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {byRoom[roomId].map((item) => (
                    <SupplyRow
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      onEdit={() => setEditingId(item.id)}
                      onClose={() => setEditingId(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function SupplyRow({
  item,
  editing,
  onEdit,
  onClose,
}: {
  item: InventoryItem;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(String(item.quantity));
  const [threshold, setThreshold] = useState(String(item.low_threshold));
  const [purchaseUrl, setPurchaseUrl] = useState(item.purchase_url ?? "");
  const [saving, setSaving] = useState(false);

  // When the row re-opens for editing (or another update comes in via realtime),
  // resync the local inputs.
  useEffect(() => {
    setQty(String(item.quantity));
    setThreshold(String(item.low_threshold));
    setPurchaseUrl(item.purchase_url ?? "");
  }, [item.quantity, item.low_threshold, item.purchase_url, editing]);

  const status = statusFor(item);

  const save = async () => {
    const nQty = Number(qty);
    const nThreshold = Number(threshold);
    if (Number.isNaN(nQty) || Number.isNaN(nThreshold)) {
      alert("Quantity and reorder threshold must be numbers");
      return;
    }
    setSaving(true);
    try {
      await updateInventoryItem(item.id, {
        quantity: nQty,
        low_threshold: nThreshold,
        purchase_url: purchaseUrl.trim() || null,
      });
      onClose();
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <tr className="border-t border-[var(--line)] bg-[var(--background)]">
        <td colSpan={6} className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Quantity
              </span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                className="rounded-md border-2 border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[14px] font-bold outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Reorder at
              </span>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="decimal"
                className="rounded-md border-2 border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[14px] font-bold outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Purchase URL
              </span>
              <input
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://…"
                className="rounded-md border-2 border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[14px] font-medium outline-none focus:border-[var(--primary)]"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-[12px] font-bold text-[var(--foreground-soft)] hover:bg-[var(--surface)]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-pill-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="cursor-pointer border-t border-[var(--line)] hover:bg-[var(--background)]"
      onClick={onEdit}
    >
      <td className="px-4 py-3">
        <div className="font-bold text-[var(--foreground)]">{item.name}</div>
        {item.category && (
          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
            {item.category}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        {item.quantity}
        {item.unit && (
          <span className="ml-1 text-[12px] font-medium text-[var(--muted)]">
            {item.unit}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--muted)]">
        {item.low_threshold}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--foreground-soft)]">
        {item.source ?? "—"}
        {item.purchase_frequency && (
          <span className="ml-1 text-[11px] text-[var(--muted)]">
            · {item.purchase_frequency}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {item.purchase_url ? (
          <a
            href={item.purchase_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--primary)] hover:underline"
          >
            Buy →
          </a>
        ) : (
          <span className="text-[var(--muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
