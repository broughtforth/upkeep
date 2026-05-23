-- =========================================================================
-- Upkeep — clean Supabase bootstrap
--
-- Paste this entire file into Supabase Dashboard → SQL Editor → New query,
-- then click Run. Safe to re-run: drops the public tables and rebuilds them.
--
-- This script:
--   1. Drops the old tables (and any policies / triggers on them).
--   2. Creates the schema the web app + new mobile app both expect.
--   3. Enables Row-Level Security (RLS) with sensible defaults.
--   4. Sets up an auth-user → profile trigger.
--   5. Seeds the 11 rooms of the Telos House so the 3D view has geometry.
--   6. Seeds one task template per room with the user's checklists.
--   7. Materialises today's task instances so the app has something to show.
--   8. Creates a storage bucket for completion photos.
-- =========================================================================

-- =========================================================================
-- 1. DROP — everything in public is recreated below.
-- auth.users is owned by Supabase Auth and is left alone.
-- =========================================================================
drop table if exists public.task_instances cascade;
drop table if exists public.task_templates cascade;
drop table if exists public.rooms          cascade;
drop table if exists public.profiles       cascade;

drop function if exists public.handle_new_user() cascade;

-- =========================================================================
-- 2. SCHEMA
-- =========================================================================

-- profiles: one row per auth user. Mirrored from auth.users via trigger.
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  avatar_url      text,
  role            text not null default 'resident' check (role in ('resident', 'admin')),
  -- Expo push token, set per-device by the mobile app so the web app can
  -- notify a resident when they're assigned a task or room.
  expo_push_token text,
  created_at      timestamptz not null default now()
);

-- rooms: spatial layout of the house in metres.
create table public.rooms (
  id          text primary key,                          -- e.g. "kitchen"
  name        text not null,
  type        text not null check (type in ('bathroom','kitchen','tech','living','bedroom','corridor')),
  position_x  real not null,
  position_z  real not null,
  width       real not null,
  depth       real not null,
  height      real not null default 1.4,
  color       text not null default '#fafafa'
);

-- task_templates: recurring task definitions, one per room (for now).
create table public.task_templates (
  id            text primary key,                        -- e.g. "t-kitchen"
  room_id       text not null references public.rooms(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('cleaning','supplies','cooking','laundry')),
  duration_min  int  not null,
  schedule_time time not null,
  active        boolean not null default true,
  instructions  text not null default '',
  subtasks      text[] not null default '{}',
  pin_x         real not null default 0,
  pin_y         real not null default 0.95,
  pin_z         real not null default 0
);

-- task_instances: a specific occurrence of a task on a specific day.
create table public.task_instances (
  id              uuid primary key default gen_random_uuid(),
  template_id     text not null references public.task_templates(id) on delete cascade,
  room_id         text not null references public.rooms(id) on delete cascade,
  scheduled_for   timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending','queued','assigned','completed')),
  assignee_id     uuid references public.profiles(id) on delete set null,
  assigned_at     timestamptz,
  completed_at    timestamptz,
  photo_url       text,
  subtasks_done   text[] not null default '{}'
);

create index task_instances_room_idx     on public.task_instances(room_id);
create index task_instances_assignee_idx on public.task_instances(assignee_id);
create index task_instances_status_idx   on public.task_instances(status);

-- =========================================================================
-- 3. AUTH TRIGGER — auto-mirror new auth users into profiles
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 4. ROW-LEVEL SECURITY
-- Anyone authenticated can read everything; assignment / completion is
-- restricted by role + assignee.
-- =========================================================================
alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

-- profiles
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "profiles updatable by self"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- rooms: read by everyone signed in, admin-only writes.
create policy "rooms readable by authenticated"
  on public.rooms for select to authenticated using (true);
create policy "rooms writable by admin"
  on public.rooms for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- task templates: read by all, write by admin.
create policy "task_templates readable by authenticated"
  on public.task_templates for select to authenticated using (true);
create policy "task_templates writable by admin"
  on public.task_templates for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- task_instances:
--   everyone reads
--   anyone authenticated can claim (assign themselves) when pending
--   assignee can update their own; admin can update any
create policy "task_instances readable by authenticated"
  on public.task_instances for select to authenticated using (true);
create policy "task_instances claim or complete"
  on public.task_instances for update to authenticated
  using (
    assignee_id = auth.uid()
    or assignee_id is null
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "task_instances admin insert/delete"
  on public.task_instances for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- =========================================================================
-- 5. SEED — rooms
-- =========================================================================
insert into public.rooms (id, name, type, position_x, position_z, width, depth, height, color) values
  ('kitchen',          'The Kitchen',   'kitchen',   3.7,  -5.5,   1.7,  5.1,  1.4, '#fafafa'),
  ('bathroom1',        'Bathroom I',    'bathroom',  3.75, -1.6,   1.7,  2.5,  1.4, '#fafafa'),
  ('hardwareLab',      'Hardware Lab',  'tech',      3.4,   0.8,   2.55, 2.2,  1.4, '#fafafa'),
  ('techRoom',         'The Tech Room', 'tech',      3.4,   3.6,   2.6,  3.5,  1.4, '#fafafa'),
  ('gallery',          'Gallery',       'living',    0,    -4.01,  5.7,  8.0,  1.4, '#fafafa'),
  ('hallway',          'Hallway',       'corridor',  1.4,   2.8,   1.3,  5.5,  1.4, '#efe7d4'),
  ('library',          'Library',       'living',   -1.1,   1.3,   3.5,  2.2,  1.4, '#fafafa'),
  ('closet',           'Closet',        'living',   -0.5,   3.55,  1.5,  1.95, 1.4, '#fafafa'),
  ('warroomServerHub', 'War Room',      'tech',     -0.55,  7,     2.75, 2.4,  1.4, '#fafafa'),
  ('bathroom2',        'Bathroom II',   'bathroom', -2.05,  3.7,   1.5,  2.4,  1.4, '#fafafa'),
  ('bathroom3',        'Bathroom III',  'bathroom', -2.5,   6.155, 0.7,  2.3,  1.4, '#fafafa');

-- =========================================================================
-- 6. SEED — task templates (one per room, checklist per the user's spec)
-- =========================================================================
insert into public.task_templates (id, room_id, name, category, duration_min, schedule_time, instructions, subtasks, pin_x, pin_y, pin_z) values
  ('t-bath1',       'bathroom1',        'Clean Bathroom I',       'cleaning', 15, '09:00',
    E'Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),

  ('t-bath2',       'bathroom2',        'Clean Bathroom II',      'cleaning', 15, '09:00',
    E'Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),

  ('t-bath3',       'bathroom3',        'Clean Bathroom III',     'cleaning', 12, '09:00',
    E'Small bathroom — same routine, less surface area. Top-to-bottom.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),

  ('t-kitchen',     'kitchen',          'Clean the Kitchen',      'cleaning', 30, '08:00',
    E'Counters before the floor. Dishes before counters. Always finish with the sink empty.',
    array['Put away dishes','Wash dishes or load the dishwasher','Wipe down counters, stovetop, and sink','Sweep the kitchen floor','Wipe spills on appliances and cabinets','Put away leftovers · check fridge for expired food','Place eggs in the egg holder'],
    0, 0.95, 0),

  ('t-gallery',     'gallery',          'Tidy the Gallery',       'cleaning', 20, '10:00',
    E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
    array['Dust TV, electronics, and furniture','Vacuum or mop under furniture if possible','Clean windowsills and light fixtures','Wash throws or cushion covers if needed'],
    0, 0.95, 0),

  ('t-library',     'library',          'Tidy the Library',       'cleaning', 20, '10:00',
    E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
    array['Dust TV, electronics, and furniture','Vacuum or mop under furniture if possible','Clean windowsills and light fixtures','Wash throws or cushion covers if needed'],
    0, 0.95, 0),

  ('t-warroom',     'warroomServerHub', 'Reset the War Room',     'cleaning', 25, '09:00',
    E'Dust before vacuuming. Surfaces declutter first — easier to wipe.',
    array['Change bed linens','Dust furniture, lamps, and picture frames','Vacuum or sweep the floors','Organise closets and wardrobes — fold, tidy, arrange','Declutter surfaces (nightstands, dressers)'],
    0, 0.95, 0),

  ('t-closet',      'closet',           'Tidy the Closet',        'supplies', 10, '10:00',
    E'Front of shelf is grabbable. Back of shelf is stock. Nothing on the floor.',
    array['Fold loose clothes','Group like with like on each shelf','Floor cleared — door closes flush'],
    0, 0.95, 0),

  ('t-hallway',     'hallway',          'Sweep & Mop the Hallway','cleaning', 10, '09:00',
    E'Sweep first, mop second. Get the corners — that''s where it builds up.',
    array['Sweep the full length','Mop with diluted floor cleaner','Wipe skirting boards if smudged','Doormat shaken out'],
    0, 0.95, 0),

  ('t-hardwareLab', 'hardwareLab',      'Reset the Hardware Lab', 'cleaning', 15, '22:00',
    E'Workspaces → pegboard → repair depot. Tools home before anything else.',
    array['All laptops docked · pens in holders · cables coiled · desks cleared','Every tool returned to its labelled pegboard silhouette','Repair items tagged Green / Orange / Red, bin closed'],
    0, 0.95, 0),

  ('t-techRoom',    'techRoom',         'Reset the Tech Room',    'supplies', 15, '21:00',
    E'Three surfaces. Match peripherals to colour-coded labels. Lock the cabinet.',
    array['Peripherals match the colour-coded labels · drones on outlines','Lenses capped · inventory list ticked · cabinet locked','Issues logged · Canon front-panel off · cables coiled · door locked'],
    0, 0.95, 0);

-- =========================================================================
-- 7. SEED — today's task instances (one per template, all pending)
-- =========================================================================
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select
  t.id,
  t.room_id,
  (current_date::timestamp + t.schedule_time) at time zone 'UTC',
  'pending'
from public.task_templates t;

-- =========================================================================
-- 8. STORAGE — bucket for completion photos
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

drop policy if exists "task-photos readable by all"   on storage.objects;
drop policy if exists "task-photos uploadable by owner" on storage.objects;

create policy "task-photos readable by all"
  on storage.objects for select using (bucket_id = 'task-photos');

create policy "task-photos uploadable by owner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos');
