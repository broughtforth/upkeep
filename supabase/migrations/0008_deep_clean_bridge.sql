-- =========================================================================
-- 0008 — bridge deep_clean_schedule into the task_instances flow
--
-- Goal: when a deep-clean rotation is due (cadence_days have elapsed since
-- last_done_at, or never done), materialise a regular task_instance for it
-- so it shows up alongside the daily room tasks in every UI (web, mobile,
-- supplies tab won't care). When that instance gets completed, propagate
-- last_done_at + last_done_by back to deep_clean_schedule so the cycle resets.
--
-- Implementation:
--   * Each row in deep_clean_schedule needs a matching task_template (one-time
--     materialisation). We synthesise template ids prefixed 'dc-'.
--   * A helper function `materialise_due_deep_cleans()` creates today's
--     task_instances for any DC that's due and doesn't already have a
--     pending/assigned instance for today.
--   * The daily 8am reset cron calls this after wiping yesterday.
--   * A trigger on task_instances writes back to deep_clean_schedule when a
--     dc-* instance is marked complete.
--
-- Paste into Supabase Dashboard -> SQL Editor -> New query and Run. Idempotent.
-- =========================================================================

-- 1. Templates --------------------------------------------------------------
-- One template per deep_clean_schedule row. Re-uses the existing task_template
-- shape so the web/mobile clients don't need any new code paths to display it.
-- Template ids are derived from the deep_clean id so the link is stable.
create or replace function public.sync_deep_clean_templates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_templates (
    id, room_id, name, category, duration_min, schedule_time,
    instructions, subtasks, pin_x, pin_y, pin_z, active
  )
  select
    'dc-' || s.id::text,
    -- Fall back to 'hallway' for house-wide deep cleans (no room_id). The
    -- column is NOT NULL on task_templates so we need a placeholder.
    coalesce(s.room_id, 'hallway'),
    s.name,
    'deep-clean',
    60,
    '10:00'::time,
    s.instructions,
    s.subtasks,
    0, 0.95, 0,
    s.active
  from public.deep_clean_schedule s
  on conflict (id) do update
     set name         = excluded.name,
         instructions = excluded.instructions,
         subtasks     = excluded.subtasks,
         active       = excluded.active;
end;
$$;

-- Keep the templates in sync whenever a deep_clean row is added/updated.
create or replace function public.sync_one_deep_clean_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_templates (
    id, room_id, name, category, duration_min, schedule_time,
    instructions, subtasks, pin_x, pin_y, pin_z, active
  )
  values (
    'dc-' || new.id::text,
    coalesce(new.room_id, 'hallway'),
    new.name,
    'deep-clean',
    60,
    '10:00'::time,
    new.instructions,
    new.subtasks,
    0, 0.95, 0,
    new.active
  )
  on conflict (id) do update
     set name         = excluded.name,
         instructions = excluded.instructions,
         subtasks     = excluded.subtasks,
         active       = excluded.active;
  return new;
end;
$$;

drop trigger if exists deep_clean_template_sync on public.deep_clean_schedule;
create trigger deep_clean_template_sync
  after insert or update on public.deep_clean_schedule
  for each row execute function public.sync_one_deep_clean_template();

-- One-shot sync for the rows that were seeded in migration 0007.
select public.sync_deep_clean_templates();

-- 2. Materialise due instances ----------------------------------------------
-- Called every morning by reset_daily_tasks (extended below) and safe to
-- call any time. Inserts a single pending instance per due rotation, scoped
-- to today, only if one doesn't already exist.
create or replace function public.materialise_due_deep_cleans()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_instances (
    template_id, room_id, scheduled_for, status
  )
  select
    'dc-' || s.id::text,
    coalesce(s.room_id, 'hallway'),
    (current_date::timestamp + time '10:00') at time zone 'UTC',
    'pending'
  from public.deep_clean_due s
  where s.is_due
    and not exists (
      select 1 from public.task_instances ti
       where ti.template_id = 'dc-' || s.id::text
         and ti.scheduled_for >= current_date::timestamp at time zone 'UTC'
         and ti.scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC'
    );
end;
$$;

grant execute on function public.materialise_due_deep_cleans() to public;

-- 3. Extend reset_daily_tasks to also materialise deep cleans ---------------
create or replace function public.reset_daily_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Wipe yesterday's task assignments.
  update public.task_instances ti
     set status         = 'pending',
         assignee_id    = null,
         assigned_at    = null,
         completed_at   = null,
         photo_url      = null,
         subtasks_done  = '{}',
         scheduled_for  = (current_date::timestamp + t.schedule_time) at time zone 'UTC'
  from public.task_templates t
  where ti.template_id = t.id;

  -- Mark everyone present by default; admin un-checks anyone who's away.
  update public.profiles set present_today = true;

  -- Surface any deep-clean rotations that have come due overnight.
  perform public.materialise_due_deep_cleans();
end;
$$;

-- 4. Reverse trigger — completion propagates back to deep_clean_schedule ----
create or replace function public.handle_deep_clean_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dc_id uuid;
begin
  -- Only act on dc-* instances flipping to completed.
  if new.template_id is null or new.template_id not like 'dc-%' then
    return new;
  end if;
  if new.status <> 'completed' then
    return new;
  end if;
  if old.status = 'completed' then
    return new;  -- already handled
  end if;

  -- Recover the deep_clean_schedule id from the template_id.
  begin
    dc_id := substring(new.template_id from 4)::uuid;
  exception when others then
    return new;
  end;

  update public.deep_clean_schedule
     set last_done_at = coalesce(new.completed_at, now()),
         last_done_by = new.assignee_id
   where id = dc_id;

  return new;
end;
$$;

drop trigger if exists deep_clean_complete_writeback on public.task_instances;
create trigger deep_clean_complete_writeback
  after update on public.task_instances
  for each row execute function public.handle_deep_clean_complete();

-- 5. Run once now so today's due deep cleans show up immediately ------------
select public.materialise_due_deep_cleans();

-- 6. Verify -----------------------------------------------------------------
select 'dc templates'        as item, count(*) from public.task_templates where category = 'deep-clean'
union all
select 'dc instances today',         count(*) from public.task_instances
  where template_id like 'dc-%'
    and scheduled_for >= current_date::timestamp at time zone 'UTC'
    and scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC';
