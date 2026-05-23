"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Assign every pending task in a room to a user for today. No-op if the
// room has no pending tasks today.
export async function assignRoomTo(
  roomId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("task_instances")
    .update({ assigned_to: userId })
    .eq("scheduled_for", today)
    .eq("room_id", roomId)
    .eq("status", "pending");

  if (error) {
    console.error("[assignRoomTo] failed", error);
    return;
  }
  revalidatePath("/");
}

// Materialise one task_instance per active template for today's date.
// Idempotent: the unique (template_id, scheduled_for) constraint means
// re-running won't duplicate rows. Errors are logged server-side; on the
// next render the dashboard will reflect what actually got inserted.
export async function generateTodaysTasks(): Promise<void> {
  const supabase = await createClient();

  const { data: templates, error: tErr } = await supabase
    .from("task_templates")
    .select("id, room_id")
    .eq("active", true);

  if (tErr || !templates) {
    console.error("[generateTodaysTasks] load templates failed", tErr);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = templates.map((t) => ({
    template_id: t.id,
    room_id: t.room_id,
    scheduled_for: today,
  }));

  const { error: iErr } = await supabase
    .from("task_instances")
    .upsert(rows, { onConflict: "template_id,scheduled_for", ignoreDuplicates: true });

  if (iErr) {
    console.error("[generateTodaysTasks] upsert failed", iErr);
    return;
  }

  revalidatePath("/");
}
