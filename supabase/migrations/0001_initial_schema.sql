-- Upkeep initial schema.
--
-- Apply by copy-pasting into Supabase SQL Editor (Dashboard → SQL).
-- Safe to re-run: all CREATE statements use IF NOT EXISTS where possible.
--
-- What you get:
--   * profiles  — one row per auth.users, holds role (admin/cleaner) + display info
--   * rooms     — physical rooms in the house
--   * task_templates  — reusable task definitions (per-room or whole-house)
--   * task_instances  — concrete tasks for a given day, with assignment + status
--   * RLS policies: admins can do everything; cleaners can read everything and
--     mutate only their own task_instances.
--   * Trigger: auto-creates a profile row when a new auth user signs up.
--   * Seed rows for the 7 chore categories as task_templates with no room_id.
--   * A storage bucket `task-photos` for completion proof uploads.

----------------------------------------------------------------
-- 1. Schema
----------------------------------------------------------------

-- Profiles. One row per auth user.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'cleaner' check (role in ('admin','cleaner')),
  color       text,
  created_at  timestamptz not null default now()
);

-- Rooms.
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  floor       smallint,
  created_at  timestamptz not null default now()
);

-- Task templates.
create table if not exists public.task_templates (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  category           text not null check (category in
                       ('kitchen','bathroom','restock','bins','beds','robovac','surfaces','organising')),
  room_id            uuid references public.rooms(id) on delete set null,
  estimated_minutes  integer not null default 15,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Task instances. One row per (template, day).
create table if not exists public.task_instances (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.task_templates(id) on delete cascade,
  room_id         uuid references public.rooms(id) on delete set null,
  assigned_to     uuid references public.profiles(id) on delete set null,
  status          text not null default 'pending' check (status in ('pending','in_progress','complete')),
  started_at      timestamptz,
  completed_at    timestamptz,
  photo_url       text,
  scheduled_for   date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (template_id, scheduled_for)
);

create index if not exists idx_task_instances_scheduled_for
  on public.task_instances (scheduled_for);
create index if not exists idx_task_instances_assigned_to
  on public.task_instances (assigned_to);
create index if not exists idx_task_instances_status
  on public.task_instances (status);

----------------------------------------------------------------
-- 2. Profile auto-create trigger
----------------------------------------------------------------
-- Whenever a new row appears in auth.users, mirror it into profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

----------------------------------------------------------------
-- 3. Row-Level Security
----------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

-- Helper: is the calling user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles policies.
drop policy if exists "profiles_select_all"       on public.profiles;
drop policy if exists "profiles_update_own"       on public.profiles;
drop policy if exists "profiles_admin_all"        on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_admin_all"  on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Rooms policies (everyone reads; admins write).
drop policy if exists "rooms_select_all"  on public.rooms;
drop policy if exists "rooms_admin_all"   on public.rooms;
create policy "rooms_select_all" on public.rooms
  for select using (auth.role() = 'authenticated');
create policy "rooms_admin_all"  on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

-- Task templates policies (everyone reads; admins write).
drop policy if exists "templates_select_all" on public.task_templates;
drop policy if exists "templates_admin_all"  on public.task_templates;
create policy "templates_select_all" on public.task_templates
  for select using (auth.role() = 'authenticated');
create policy "templates_admin_all"  on public.task_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Task instance policies.
-- * Anyone authenticated can read all instances (so cleaners see whose what).
-- * Admins can do anything.
-- * Cleaners can update an instance only if it's assigned to them (start/complete).
drop policy if exists "instances_select_all"    on public.task_instances;
drop policy if exists "instances_admin_all"     on public.task_instances;
drop policy if exists "instances_update_mine"   on public.task_instances;
create policy "instances_select_all" on public.task_instances
  for select using (auth.role() = 'authenticated');
create policy "instances_admin_all"  on public.task_instances
  for all using (public.is_admin()) with check (public.is_admin());
create policy "instances_update_mine" on public.task_instances
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

----------------------------------------------------------------
-- 4. Seed rooms
----------------------------------------------------------------
-- These match the names that were hardcoded in the mobile app's data.ts.

insert into public.rooms (name, floor) values
  ('Kitchen',              0),
  ('the Symposium',        0),
  ('the Atrium',           0),
  ('the Forge',            0),
  ('the Zen Room',         1),
  ('the Tech Room',        1),
  ('the Media Room',       0),
  ('Main Bathroom',        1),
  ('Walk-in Bathroom',     1),
  ('Media Room Bathroom',  0)
on conflict (name) do nothing;

----------------------------------------------------------------
-- 5. Seed task templates
----------------------------------------------------------------
-- The 8 task categories from the new chore list, set up as templates.
-- Whole-house tasks (no room_id) and bathroom-specific tasks (one per
-- bathroom) so admins have realistic things to assign on day 1.

-- Kitchen
insert into public.task_templates (title, description, category, room_id, estimated_minutes)
select
  'Kitchen',
  'Put away dishes · Wipe counters, stovetop, sink · Sweep floor · Wipe spills on appliances and cabinets · Put away leftovers · Check fridge for expired food · Place eggs in the egg holder',
  'kitchen',
  r.id,
  30
from public.rooms r where r.name = 'Kitchen'
on conflict do nothing;

-- Per-bathroom
insert into public.task_templates (title, description, category, room_id, estimated_minutes)
select
  'Clean ' || r.name,
  'Scrub toilet bowl · Wipe mirror · Clean sink · Clean shower floor or tub · Clean shower drain · Wipe remaining surfaces · Empty bins',
  'bathroom',
  r.id,
  25
from public.rooms r where r.name ilike '%Bathroom%'
on conflict do nothing;

-- Whole-house chores (room_id stays null).
insert into public.task_templates (title, description, category, estimated_minutes) values
  ('Restock supplies',
   'Toilet papers · Toothpaste · Shampoo · Conditioner · Liquid dish soap · Liquid hand soap · Dishwasher pods · Bin liners',
   'restock', 20),
  ('Throw out bins',
   'Gather all the bins and throw them out · Place new bin liners · Wash bins if needed',
   'bins', 15),
  ('Make the beds',
   'Make beds in all rooms with beds · Change sheets bi-weekly · Organise sofa · Put away sleeping bags',
   'beds', 20),
  ('Robovac',
   'De-clutter floor space · Empty dirty water container · Fill clean water container · Clean brush · Clean roller · Check floor map is correct',
   'robovac', 15),
  ('Wipe surfaces',
   'Counter tops · Bookshelves · Tables · Doors · Handles · Switches · Desks',
   'surfaces', 20),
  ('Organising / Tidying',
   'Papers · Pens · Books · Bags · Wires and chargers · Toiletries in bathrooms · Shoes and coats · Litter · Cups, glasses, plates',
   'organising', 25)
on conflict do nothing;

----------------------------------------------------------------
-- 6. Storage bucket for completion photos
----------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload; anyone can read.
drop policy if exists "task-photos read"   on storage.objects;
drop policy if exists "task-photos upload" on storage.objects;
create policy "task-photos read" on storage.objects
  for select using (bucket_id = 'task-photos');
create policy "task-photos upload" on storage.objects
  for insert with check (bucket_id = 'task-photos' and auth.role() = 'authenticated');
