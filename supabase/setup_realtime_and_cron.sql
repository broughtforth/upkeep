-- =========================================================================
-- Realtime + daily reset
--
-- Run once in the Supabase SQL Editor.
--
-- This script:
--   1. Adds task_instances and profiles to the supabase_realtime publication
--      so the web + mobile clients receive live row changes.
--   2. Defines reset_daily_tasks() — sets every task_instance back to
--      pending (no assignee, no subtasks, no photo) and forwards
--      scheduled_for to today.
--   3. Enables the pg_cron extension and schedules reset_daily_tasks() to
--      run every day at 08:00 Europe/London (handles BST/GMT automatically).
-- =========================================================================

-- 1. REALTIME ----------------------------------------------------------------
-- Add tables to the realtime publication so clients can subscribe to changes.
-- Wrapped in DO blocks because `alter publication ... add table` errors if
-- the table is already in the publication, and Postgres has no `if not
-- exists` form for publication membership. We swallow the duplicate_object
-- exception so the script is safe to re-run.
do $$
begin
  alter publication supabase_realtime add table public.task_instances;
exception
  when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end$$;

-- 2. RESET FUNCTION ----------------------------------------------------------
create or replace function public.reset_daily_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_instances ti
     set status         = 'pending',
         assignee_id    = null,
         assigned_at    = null,
         completed_at   = null,
         photo_url      = null,
         subtasks_done  = '{}',
         -- Roll scheduled_for to today at the template's scheduled time so
         -- the "today" filter on the web/mobile keeps returning these rows.
         scheduled_for  = (current_date::timestamp + t.schedule_time) at time zone 'UTC'
  from public.task_templates t
  where ti.template_id = t.id;
end;
$$;

-- Allow anon to invoke it (the mobile app uses the publishable key). If you
-- want to restrict it later, swap `to public` for `to authenticated`.
grant execute on function public.reset_daily_tasks() to public;

-- 3. CRON --------------------------------------------------------------------
-- Enable pg_cron. Supabase ships with it but extensions need to be turned on.
create extension if not exists pg_cron with schema extensions;

-- Drop any existing schedule with this name, then create a fresh one.
-- cron.schedule takes (jobname, cron_expression, sql_to_run).
-- "0 8 * * *" = at minute 0 of hour 8, every day. The third arg sets the
-- session's timezone to Europe/London before running, so BST/GMT switches
-- handle themselves.
do $$
declare
  existing int;
begin
  select jobid into existing from cron.job where jobname = 'upkeep_daily_reset';
  if existing is not null then
    perform cron.unschedule(existing);
  end if;
end$$;

select cron.schedule(
  'upkeep_daily_reset',
  '0 8 * * *',
  $cmd$
    set local timezone = 'Europe/London';
    select public.reset_daily_tasks();
  $cmd$
);

-- Confirm
select jobid, jobname, schedule, command
  from cron.job
  where jobname = 'upkeep_daily_reset';
