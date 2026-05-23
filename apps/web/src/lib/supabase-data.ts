// Glue between Supabase and the local Zustand store.
//
// The web app's store originally read from SEED_* arrays. This module replaces
// those reads with live Supabase queries, and turns the store's mutations into
// remote UPDATEs / INSERTs while keeping the optimistic local-state behaviour.
//
// All of this assumes the schema in supabase/setup_v2_anon_login.sql.

import { createClient } from "@supabase/supabase-js";
import type { Profile, Room, TaskInstance, TaskTemplate } from "@/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
