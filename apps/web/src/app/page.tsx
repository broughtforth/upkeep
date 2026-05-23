import { redirect } from "next/navigation";

import type { TaskInstanceWithDetails } from "@upkeep/shared";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./(auth)/actions";
import { generateTodaysTasks } from "./actions";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: rooms },
    { data: people },
    { data: templates },
    { data: instances },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("rooms").select("*").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("task_templates").select("*").eq("active", true),
    supabase
      .from("task_instances")
      .select("*, template:task_templates(*), room:rooms(*), assignee:profiles(*)")
      .eq("scheduled_for", today)
      .order("created_at"),
  ]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-600">
            Upkeep Admin
          </h1>
          <p className="text-sm text-neutral-500">
            {todayLabel} · Signed in as {profile?.full_name ?? user.email} (
            {profile?.role ?? "?"})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (instances?.length ?? 0) === 0 && (
            <form action={generateTodaysTasks}>
              <button
                type="submit"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Generate today&apos;s tasks
              </button>
            </form>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {!isAdmin && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">
            You&apos;re signed in as a cleaner
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Promote yourself in Supabase → SQL Editor:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs text-neutral-700">{`update public.profiles set role = 'admin'
where id = '${user.id}';`}</pre>
        </section>
      )}

      {(instances?.length ?? 0) === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No tasks for today yet. Click <strong>Generate today&apos;s tasks</strong> in
          the header to materialise instances from the {templates?.length ?? 0}{" "}
          active template{templates?.length === 1 ? "" : "s"}.
        </section>
      ) : (
        <DashboardClient
          rooms={rooms ?? []}
          people={people ?? []}
          instances={(instances ?? []) as TaskInstanceWithDetails[]}
        />
      )}
    </main>
  );
}
