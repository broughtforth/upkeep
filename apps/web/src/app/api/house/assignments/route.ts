// Integration endpoint for the house app.
//
// GET  /api/house/assignments?window=morning|evening|all&date=YYYY-MM-DD
//   Returns today's task assignments grouped by person so the house app
//   can display each resident's role for the morning (or evening) round.
//
// POST /api/house/assignments
//   Accepts the house duty board and maps it onto today's task instances:
//   { assignments: [{ person_name, cleaning: string[], restock: string[] }] }
//   `cleaning` targets are room names → today's cleaning tasks in those rooms;
//   `restock` (any non-empty) → today's supplies tasks, round-robin across
//   restockers. Completed instances are never touched. Follows the per-room
//   sequential convention: first open task per room `assigned`, rest `queued`.
//
// Authenticated with a shared secret: send `Authorization: Bearer <HOUSE_API_KEY>`
// (or `x-api-key: <HOUSE_API_KEY>`). Uses the Supabase service-role key
// server-side, so RLS does not apply — the auth guard is mandatory.

import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile, Room, TaskCategory, TaskInstance, TaskTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

// Mirrors the dashboard's dual view (src/lib/view-mode.ts). Deep-clean
// rotations surface in both windows.
const WINDOW_CATEGORIES: Record<string, ReadonlySet<TaskCategory>> = {
  morning: new Set<TaskCategory>(["cleaning", "supplies", "laundry", "deep-clean"]),
  evening: new Set<TaskCategory>(["laundry", "room-reset", "zen-setup", "deep-clean"]),
};

interface InstanceRow extends TaskInstance {
  template: Pick<TaskTemplate, "id" | "name" | "category" | "duration_min" | "schedule_time" | "instructions" | "subtasks"> | null;
  room: Pick<Room, "id" | "name" | "type"> | null;
  assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "role" | "present_today"> | null;
}

function taskPayload(row: InstanceRow) {
  return {
    id: row.id,
    name: row.template?.name ?? null,
    category: row.template?.category ?? null,
    room: row.room ? { id: row.room.id, name: row.room.name, type: row.room.type } : null,
    status: row.status,
    scheduled_for: row.scheduled_for,
    duration_min: row.template?.duration_min ?? null,
    instructions: row.template?.instructions ?? null,
    subtasks: row.template?.subtasks ?? [],
    subtasks_done: row.subtasks_done ?? [],
    assigned_at: row.assigned_at,
    completed_at: row.completed_at,
  };
}

// Returns an error Response, or null when the request may proceed.
function guard(request: NextRequest): Response | null {
  const apiKey = process.env.HOUSE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "HOUSE_API_KEY is not configured on the server" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length)
    : request.headers.get("x-api-key");
  if (provided !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: "Supabase server credentials are not configured" },
      { status: 503 },
    );
  }
  return null;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get("window") ?? "morning";
  if (!["morning", "evening", "all"].includes(window)) {
    return Response.json(
      { error: 'window must be "morning", "evening" or "all"' },
      { status: 400 },
    );
  }

  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("task_instances")
    .select(
      `*,
       template:task_templates(id, name, category, duration_min, schedule_time, instructions, subtasks),
       room:rooms(id, name, type),
       assignee:profiles(id, full_name, avatar_url, role, present_today)`,
    )
    .gte("scheduled_for", `${date}T00:00:00Z`)
    .lt("scheduled_for", `${date}T23:59:59Z`)
    .order("scheduled_for", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  const categories = WINDOW_CATEGORIES[window];
  const rows = (data as unknown as InstanceRow[]).filter(
    (row) => !categories || (row.template && categories.has(row.template.category)),
  );

  // Group by assignee — each person's tasks are their "role" for the round.
  const people = new Map<
    string,
    { person: NonNullable<InstanceRow["assignee"]>; tasks: ReturnType<typeof taskPayload>[] }
  >();
  const unassigned: ReturnType<typeof taskPayload>[] = [];

  for (const row of rows) {
    if (row.assignee) {
      const entry = people.get(row.assignee.id) ?? { person: row.assignee, tasks: [] };
      entry.tasks.push(taskPayload(row));
      people.set(row.assignee.id, entry);
    } else {
      unassigned.push(taskPayload(row));
    }
  }

  return Response.json({
    date,
    window,
    generated_at: new Date().toISOString(),
    assignments: Array.from(people.values()).map(({ person, tasks }) => ({
      person: {
        id: person.id,
        full_name: person.full_name,
        avatar_url: person.avatar_url,
        role: person.role,
        present_today: person.present_today ?? true,
      },
      tasks,
      total_duration_min: tasks.reduce((sum, t) => sum + (t.duration_min ?? 0), 0),
    })),
    unassigned,
  });
}

// ---------------------------------------------------------------------------
// POST — the house duty board dictates today's Upkeep assignments.
// ---------------------------------------------------------------------------

interface HouseAssignment {
  person_name: string;
  cleaning: string[];
  restock: string[];
}

// "The Kitchen" / "Kitchen" / "kitchen " all compare equal.
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roomsMatching(target: string, rooms: Pick<Room, "id" | "name" | "type">[]): string[] {
  const t = normName(target);
  // the house's "Bathrooms" duty covers every bathroom-type room.
  if (t === "bathrooms") return rooms.filter((r) => r.type === "bathroom").map((r) => r.id);
  return rooms
    .filter((r) => {
      const n = normName(r.name);
      return n === t || n.includes(t) || t.includes(n);
    })
    .map((r) => r.id);
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { assignments?: HouseAssignment[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const assignments = Array.isArray(body.assignments) ? body.assignments : null;
  if (!assignments) {
    return Response.json({ error: "assignments must be an array" }, { status: 422 });
  }

  const supabase = serviceClient();
  const date = new Date().toISOString().slice(0, 10);

  const [profilesRes, roomsRes, instancesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("rooms").select("id, name, type"),
    supabase
      .from("task_instances")
      .select("id, room_id, status, scheduled_for, template:task_templates(category)")
      .gte("scheduled_for", `${date}T00:00:00Z`)
      .lt("scheduled_for", `${date}T23:59:59Z`)
      .order("scheduled_for", { ascending: true }),
  ]);
  const failed = profilesRes.error ?? roomsRes.error ?? instancesRes.error;
  if (failed) {
    return Response.json({ error: failed.message }, { status: 502 });
  }

  const profiles = profilesRes.data as Pick<Profile, "id" | "full_name">[];
  const rooms = roomsRes.data as Pick<Room, "id" | "name" | "type">[];
  const instances = instancesRes.data as unknown as (Pick<
    TaskInstance,
    "id" | "room_id" | "status" | "scheduled_for"
  > & { template: { category: TaskCategory } | null })[];

  // Match house names onto profiles: exact full name, then unique first name.
  const findProfile = (name: string): string | null => {
    const n = normName(name);
    const exact = profiles.find((p) => normName(p.full_name) === n);
    if (exact) return exact.id;
    const first = profiles.filter(
      (p) => normName(p.full_name).split(" ")[0] === n.split(" ")[0],
    );
    return first.length === 1 ? first[0].id : null;
  };

  const unmatchedPeople: string[] = [];
  const unmatchedRooms: string[] = [];
  // instance id → assignee profile id
  const desired = new Map<string, string>();
  const restockers: string[] = [];

  for (const a of assignments) {
    if (typeof a?.person_name !== "string") continue;
    const profileId = findProfile(a.person_name);
    if (!profileId) {
      unmatchedPeople.push(a.person_name);
      continue;
    }

    for (const target of Array.isArray(a.cleaning) ? a.cleaning : []) {
      const roomIds = roomsMatching(String(target), rooms);
      if (roomIds.length === 0) {
        unmatchedRooms.push(String(target));
        continue;
      }
      for (const inst of instances) {
        if (
          inst.status !== "completed" &&
          inst.template?.category === "cleaning" &&
          roomIds.includes(inst.room_id)
        ) {
          desired.set(inst.id, profileId);
        }
      }
    }

    if (Array.isArray(a.restock) && a.restock.length > 0) {
      restockers.push(profileId);
    }
  }

  // Supplies tasks are round-robined across everyone holding a restock duty
  // (house restock targets are supply categories, which don't map to rooms).
  if (restockers.length > 0) {
    const supplies = instances.filter(
      (i) => i.status !== "completed" && i.template?.category === "supplies",
    );
    supplies.forEach((inst, idx) => {
      desired.set(inst.id, restockers[idx % restockers.length]);
    });
  }

  // Per-room sequential convention: earliest open task in a room `assigned`,
  // the rest `queued`.
  const firstOpenInRoom = new Set<string>();
  const updates: { id: string; assignee_id: string; status: "assigned" | "queued" }[] = [];
  for (const inst of instances) {
    const assignee = desired.get(inst.id);
    if (!assignee) continue;
    const isFirst = !firstOpenInRoom.has(inst.room_id);
    firstOpenInRoom.add(inst.room_id);
    updates.push({ id: inst.id, assignee_id: assignee, status: isFirst ? "assigned" : "queued" });
  }

  const now = new Date().toISOString();
  for (const u of updates) {
    const { error } = await supabase
      .from("task_instances")
      .update({ assignee_id: u.assignee_id, status: u.status, assigned_at: now })
      .eq("id", u.id);
    if (error) {
      return Response.json({ error: error.message, updated: updates.indexOf(u) }, { status: 502 });
    }
  }

  return Response.json({
    date,
    updated: updates.length,
    unmatched_people: [...new Set(unmatchedPeople)],
    unmatched_rooms: [...new Set(unmatchedRooms)],
  });
}
