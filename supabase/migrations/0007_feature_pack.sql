-- =========================================================================
-- 0007 — feature pack: dual view, presence, deep clean, supplies links
--
-- 1. task_templates.category: extend the CHECK constraint to allow the new
--    categories: room-reset, zen-setup, deep-clean.
-- 2. profiles.present_today: boolean for the presence selector. Reset to
--    true at the daily 8am cron (separate migration of the cron is below).
-- 3. room_inventory.purchase_url: where to reorder this item.
-- 4. deep_clean_schedule: per-task rotation cadence. The dashboard picks
--    overdue items each morning to surface alongside daily cleaning.
--
-- Paste into Supabase Dashboard -> SQL Editor -> New query and Run.
-- Idempotent — safe to re-run.
-- =========================================================================

-- 1. CATEGORIES ---------------------------------------------------------------
alter table public.task_templates
  drop constraint if exists task_templates_category_check;

alter table public.task_templates
  add constraint task_templates_category_check
  check (category in (
    'cleaning',
    'supplies',
    'cooking',
    'laundry',
    'room-reset',
    'zen-setup',
    'deep-clean'
  ));

-- 2. PRESENCE -----------------------------------------------------------------
alter table public.profiles
  add column if not exists present_today boolean not null default true;

-- Extend the reset_daily_tasks function to also reset presence each morning.
-- (The 8am London cron from setup_realtime_and_cron.sql already calls this.)
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
end;
$$;

-- 3. SUPPLIES LINKS -----------------------------------------------------------
alter table public.room_inventory
  add column if not exists purchase_url text;

-- 4. DEEP CLEAN SCHEDULE ------------------------------------------------------
-- One row per recurring deep-clean job. Surfaced into the daily mix when
-- last_done_at is more than `cadence_days` old (or never done).
create table if not exists public.deep_clean_schedule (
  id              uuid primary key default gen_random_uuid(),
  room_id         text references public.rooms(id) on delete set null,
  -- Human-readable label, e.g. "Wash duvets at laundromat".
  name            text not null,
  -- Optional richer notes shown when the user opens the task.
  instructions    text not null default '',
  -- Sub-tasks the user ticks off, same model as task_templates.
  subtasks        text[] not null default '{}',
  -- How often this is supposed to happen, in days. 14 = fortnightly.
  cadence_days    int  not null default 14,
  last_done_at    timestamptz,
  last_done_by    uuid references public.profiles(id) on delete set null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists deep_clean_schedule_room_idx
  on public.deep_clean_schedule(room_id);

-- A view that picks out which deep-clean tasks are due *today*.
-- Anything where last_done_at is null OR older than cadence_days.
create or replace view public.deep_clean_due as
  select s.*,
         (s.last_done_at is null
          or s.last_done_at < (now() - (s.cadence_days || ' days')::interval)
         ) as is_due
    from public.deep_clean_schedule s
   where s.active;

-- RLS — same open model as the rest of the schema.
alter table public.deep_clean_schedule enable row level security;

drop policy if exists "deep_clean readable by public"  on public.deep_clean_schedule;
drop policy if exists "deep_clean writable by public"  on public.deep_clean_schedule;
drop policy if exists "deep_clean insertable by public" on public.deep_clean_schedule;
drop policy if exists "deep_clean deletable by public"  on public.deep_clean_schedule;

create policy "deep_clean readable by public"
  on public.deep_clean_schedule for select to public using (true);
create policy "deep_clean writable by public"
  on public.deep_clean_schedule for update to public using (true) with check (true);
create policy "deep_clean insertable by public"
  on public.deep_clean_schedule for insert to public with check (true);
create policy "deep_clean deletable by public"
  on public.deep_clean_schedule for delete to public using (true);

do $$
begin
  alter publication supabase_realtime add table public.deep_clean_schedule;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Seed a few starter rotations so the feature isn't empty on day one.
-- All marked active; cadence_days picked from your "fortnightly duvets" spec
-- and reasonable defaults for common deep-clean items.
insert into public.deep_clean_schedule (room_id, name, instructions, subtasks, cadence_days)
select v.room_id, v.name, v.instructions, v.subtasks, v.cadence_days
from (values
  ('kitchen',    'Wipe kitchen lights and above hob', 'High surfaces. Use a step ladder.',
                 array['Wipe under-cabinet lights','Wipe above-hob extractor surface','Clean the splashback'], 14),
  ('kitchen',    'Deep clean the oven',               'Use the spray cleaner from the supplies shelf.',
                 array['Remove racks','Spray and let sit 30 min','Scrub and rinse','Replace racks'], 30),
  ('kitchen',    'Defrost / wipe fridge interior',    'Empty enough to access shelves.',
                 array['Remove food to cooler bag','Wipe shelves and drawers','Bin anything expired','Restock'], 21),
  (null,         'Wash duvets at laundromat',         'Fortnightly. Drop off / pick up same day.',
                 array['Strip beds','Drop at laundromat','Pick up','Re-make beds'], 14),
  (null,         'Wipe baseboards and skirting',      'House-wide.',
                 array['Damp wipe each room edge','Spot-clean scuff marks'], 30),
  ('bathroom1',  'Descale shower head + taps',        'Citric or vinegar soak.',
                 array['Soak shower head','Wipe taps','Rinse and dry'], 30),
  ('bathroom2',  'Descale shower head + taps',        'Citric or vinegar soak.',
                 array['Soak shower head','Wipe taps','Rinse and dry'], 30),
  ('bathroom3',  'Descale shower head + taps',        'Citric or vinegar soak.',
                 array['Soak shower head','Wipe taps','Rinse and dry'], 30)
) as v(room_id, name, instructions, subtasks, cadence_days)
where not exists (
  select 1 from public.deep_clean_schedule s
   where s.name = v.name and s.room_id is not distinct from v.room_id
);

-- 5. VERIFY -------------------------------------------------------------------
select 'task_templates.category constraint' as item,
       (select count(*) from pg_constraint
         where conname = 'task_templates_category_check') as exists
union all
select 'profiles.present_today col',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'present_today')
union all
select 'room_inventory.purchase_url col',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'room_inventory'
           and column_name = 'purchase_url')
union all
select 'deep_clean_schedule rows',
       (select count(*) from public.deep_clean_schedule);
