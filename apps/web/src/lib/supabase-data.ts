// Glue between Supabase and the local Zustand store.
//
// The web app's store originally read from SEED_* arrays. This module replaces
// those reads with live Supabase queries, and turns the store's mutations into
// remote UPDATEs / INSERTs while keeping the optimistic local-state behaviour.
//
// All of this assumes the schema in supabase/setup_v2_anon_login.sql.

import { createClient } from "@supabase/supabase-js";
import type { Profile, Room, TaskInstance, TaskTemplate } from "@/lib/types";

// Vercel doesn't expose NEXT_PUBLIC_ env vars at build-time for static
// generation of client pages (they're injected into the bundle but not into
// process.env on the build worker). Fall back to safe placeholders so the
// module loads at build time; the real values are baked into the JS bundle
// by Next, so the runtime client uses the right URL.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key";

// One shared browser client. We don't use @supabase/ssr here because the 3D
// view is fully client-side — server rendering it would be pointless.
export const supabase = createClient(url, key);

// ─── Loaders ────────────────────────────────────────────────────────────

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from("rooms").select("*").order("id");
  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// task_templates stores `pin_x / pin_y / pin_z` as flat columns. The web app
// uses a nested `pin: {x,y,z}` shape, so we reshape here.
type DBTemplate = Omit<TaskTemplate, "pin"> & {
  pin_x: number;
  pin_y: number;
  pin_z: number;
};

export async function fetchTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .eq("active", true);
  if (error) throw error;
  return (data ?? []).map((row: DBTemplate) => ({
    id: row.id,
    room_id: row.room_id,
    name: row.name,
    category: row.category,
    duration_min: row.duration_min,
    schedule_time: row.schedule_time,
    instructions: row.instructions,
    subtasks: row.subtasks,
    pin: { x: row.pin_x, y: row.pin_y, z: row.pin_z },
  }));
}

export async function fetchInstances(): Promise<TaskInstance[]> {
  // Today's instances only — there's one row per (template, day).
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("task_instances")
    .select("*")
    .gte("scheduled_for", `${today}T00:00:00Z`)
    .lt("scheduled_for", `${today}T23:59:59Z`);
  if (error) throw error;
  return (data ?? []) as TaskInstance[];
}

export async function loadAll() {
  const [rooms, profiles, templates, instances] = await Promise.all([
    fetchRooms(),
    fetchProfiles(),
    fetchTemplates(),
    fetchInstances(),
  ]);
  return { rooms, profiles, templates, instances };
}

// ─── Writers ────────────────────────────────────────────────────────────

export async function updateInstance(
  id: string,
  patch: Partial<TaskInstance>,
): Promise<void> {
  const { error } = await supabase
    .from("task_instances")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[supabase] updateInstance failed", error);
    throw error;
  }
}

// Bulk update — used by assignAllPendingInRoom which touches many rows in
// the same transaction. Sends one UPDATE per id (Supabase doesn't support
// row-by-row varied patches in a single call). We let errors bubble so the
// store can roll back the optimistic local change.
export async function updateInstancesBulk(
  patches: Array<{ id: string; patch: Partial<TaskInstance> }>,
): Promise<void> {
  await Promise.all(patches.map(({ id, patch }) => updateInstance(id, patch)));
}

// ─── Inventory (Supplies tab) ───────────────────────────────────────────
//
// Mirrors the room_inventory table schema after migrations 0004/0005/0007.
// `quantity` is numeric because some items are fractional (e.g. 1.5 kg).
export interface InventoryItem {
  id: string;
  room_id: string;
  name: string;
  quantity: number;
  low_threshold: number;
  category: string | null;
  unit: string | null;
  source: string | null;
  purchase_frequency: string | null;
  special_requests: string | null;
  purchase_url: string | null;
  updated_at: string;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("room_inventory")
    .select("*")
    .order("room_id")
    .order("name");
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function updateInventoryItem(
  id: string,
  patch: Partial<InventoryItem>,
): Promise<void> {
  const { error } = await supabase
    .from("room_inventory")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[supabase] updateInventoryItem failed", error);
    throw error;
  }
}

// Insert a brand-new resident. Supabase generates the UUID via the column's
// default; we get the row back so the caller can drop it into local state
// without waiting for Realtime to round-trip. role defaults to 'resident'.
export async function insertProfile(name: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ full_name: name, role: "resident" })
    .select("*")
    .single();
  if (error) {
    // Pull out the fields explicitly — Supabase errors serialise as `{}`
    // through the default console formatter, which hides the real cause.
    console.error(
      "[supabase] insertProfile failed:",
      error.message || error,
      "(code:",
      error.code,
      "details:",
      error.details,
      "hint:",
      error.hint,
      ")",
    );
    throw new Error(error.message || "Failed to add resident");
  }
  return data as Profile;
}
