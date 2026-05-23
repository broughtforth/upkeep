-- House task management — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` if using the CLI.

-- =========================================================================
-- profiles: one row per person (mirrored from auth.users via trigger below)
-- =========================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  avatar_url   text,
  role         text not null default 'resident' check (role in ('resident', 'admin')),
  created_at   timestamptz not null default now()
);

-- =========================================================================
-- rooms: the spatial layout of the house. position/size in metres.
-- =========================================================================
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('bathroom','kitchen','tech','living','bedroom','corridor')),
  position_x   real not null,
  position_z   real not null,
  width        real not null,
  depth        real not null,
  height       real not null default 1.4,
  color        text not null default '#cbd5e1'
);

-- =========================================================================
-- task_templates: recurring task definitions (e.g. "Clean Bathroom 1 @ 09:00")
-- =========================================================================
create table public.task_templates (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('cleaning','supplies','cooking','laundry')),
  duration_min  int  not null,
  -- schedule_time: time-of-day this task should be generated. Combine with
  -- a daily cron Edge Function to materialise task_instances for the day.
  schedule_time time not null,
  active        boolean not null default true,
  -- Read-before-you-start context (compendium rules, "why" of the task).
  instructions  text not null default '',
  -- Step-by-step checklist; each entry is a subtask label.
  subtasks      text[] not null default '{}',
  -- Where to place the task pin in 3D (relative to its room's centre).
  pin_x         real not null default 0,
  pin_y         real not null default 0.9,
  pin_z         real not null default 0
);

-- =========================================================================
-- task_instances: a specific occurrence of a task on a specific day.
-- Drives the red / orange / green visual state in the 3D house.
-- =========================================================================
create table public.task_instances (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.task_templates(id) on delete cascade,
  room_id         uuid not null references public.rooms(id) on delete cascade,
  scheduled_for   timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending','assigned','completed')),
  assignee_id     uuid references public.profiles(id) on delete set null,
  assigned_at     timestamptz,
  completed_at    timestamptz,
  photo_url       text,
  -- Subtask labels that have been ticked off (subset of the template's subtasks).
  subtasks_done   text[] not null default '{}'
);

create index task_instances_room_idx     on public.task_instances(room_id);
create index task_instances_assignee_idx on public.task_instances(assignee_id);
create index task_instances_status_idx   on public.task_instances(status);

-- =========================================================================
-- Trigger: auto-create a profile row whenever a new auth user signs up
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================================
-- RLS — enable on every table
-- =========================================================================
alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

-- Profiles: anyone signed in can read; users can update their own row;
-- admins can update anyone.
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles updatable by self"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- Rooms: read by everyone signed in, admin-only writes.
create policy "rooms readable by authenticated"
  on public.rooms for select to authenticated using (true);

create policy "rooms writable by admin"
  on public.rooms for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

-- Task templates: read by all, write by admin.
create policy "task_templates readable by authenticated"
  on public.task_templates for select to authenticated using (true);

create policy "task_templates writable by admin"
  on public.task_templates for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

-- Task instances:
-- - everyone can read
-- - anyone can claim (assign themselves) when pending
-- - assignee or admin can update / complete
create policy "task_instances readable by authenticated"
  on public.task_instances for select to authenticated using (true);

create policy "task_instances claim or complete"
  on public.task_instances for update to authenticated
  using (
    assignee_id = auth.uid()
    or assignee_id is null
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role = 'admin')
  );

create policy "task_instances admin insert/delete"
  on public.task_instances for insert to authenticated
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

-- =========================================================================
-- Storage bucket for completion photos
-- (Run this section in the Supabase SQL editor — it relies on the
-- storage schema being present.)
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

create policy "task-photos readable by all"
  on storage.objects for select using (bucket_id = 'task-photos');

create policy "task-photos uploadable by owner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Seed data — 7 rooms matching the procedural 3D house
-- =========================================================================
-- Grid layout: 16m × 10m footprint, rooms share walls.
--   Top row    (z=-5..-1, depth 4):  Tech A | Kitchen | Tech B
--   Bottom row (z=-1.. 5, depth 6):  Bath1 | Living | Bedroom | Bath2
-- Layout: top row | corridor | bottom row, total 16w × 10.5d.
insert into public.rooms (name, type, position_x, position_z, width, depth, color) values
  ('The Forge',     'tech',     -5.5, -3,     5,  4,   '#fafafa'),
  ('The Kitchen',   'kitchen',   0,   -3,     6,  4,   '#fafafa'),
  ('The Tech Room', 'tech',      5.5, -3,     5,  4,   '#fafafa'),
  ('Corridor',      'corridor',  0,   -0.25, 16,  1.5, '#efe7d4'),
  ('Bathroom I',    'bathroom', -6.5,  3,     3,  5,   '#fafafa'),
  ('Media Room',    'living',   -2,    3,     6,  5,   '#fafafa'),
  ('Zen Room',      'bedroom',   3,    3,     4,  5,   '#fafafa'),
  ('Bathroom II',   'bathroom',  6.5,  3,     3,  5,   '#fafafa');
