// Integration endpoint for the house app.
//
// GET /api/house/assignments?window=morning|evening|all&date=YYYY-MM-DD
//
// Returns today's task assignments grouped by person so the house app
// can display each resident's role for the morning (or evening) round.
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

export async function GET(request: NextRequest) {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Supabase server credentials are not configured" },
      { status: 503 },
    );
  }

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

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
