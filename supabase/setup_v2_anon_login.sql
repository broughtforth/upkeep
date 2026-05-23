-- =========================================================================
-- Upkeep — anon login bootstrap (v2)
--
-- Replaces setup_clean.sql. Differences from v1:
--   * profiles.id is now a plain UUID (no FK to auth.users) so we can have
--     "fake" users without making auth.users rows.
--   * RLS policies allow the anon (publishable key) role to read everything
--     and update task assignments / completion. "Anyone holding the phone is
--     that user" is the chosen security model.
--   * Drops the auth.users trigger that the v1 setup added.
--   * Seeds three residents: Faizan, Ali (admin), Daniel.
--
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query,
-- then click Run. Safe to re-run.
-- =========================================================================

-- 1. DROP everything in public + the auth trigger.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.task_instances cascade;
drop table if exists public.task_templates cascade;
drop table if exists public.rooms          cascade;
drop table if exists public.profiles       cascade;

-- 2. SCHEMA — same as v1 except profiles.id is independent of auth.users.
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  avatar_url      text,
  role            text not null default 'resident' check (role in ('resident', 'admin')),
  expo_push_token text,
  created_at      timestamptz not null default now()
);

create table public.rooms (
  id          text primary key,
  name        text not null,
  type        text not null check (type in ('bathroom','kitchen','tech','living','bedroom','corridor')),
  position_x  real not null,
  position_z  real not null,
  width       real not null,
  depth       real not null,
  height      real not null default 1.4,
  color       text not null default '#fafafa'
);

create table public.task_templates (
  id            text primary key,
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

-- 3. RLS — anon role gets read everywhere + update on task_instances and
-- profiles (so the mobile app can set its expo_push_token without auth).
alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

create policy "profiles readable by anyone"
  on public.profiles for select to anon, authenticated using (true);
create policy "profiles writable by anyone"
  on public.profiles for update to anon, authenticated using (true) with check (true);

create policy "rooms readable by anyone"
  on public.rooms for select to anon, authenticated using (true);

create policy "task_templates readable by anyone"
  on public.task_templates for select to anon, authenticated using (true);

create policy "task_instances readable by anyone"
  on public.task_instances for select to anon, authenticated using (true);
create policy "task_instances writable by anyone"
  on public.task_instances for update to anon, authenticated using (true) with check (true);
create policy "task_instances insertable by anyone"
  on public.task_instances for insert to anon, authenticated with check (true);

-- 4. SEED — rooms.
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

-- 5. SEED — task templates (one per room, with checklists).
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

-- 6. SEED — today's task instances.
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select
  t.id,
  t.room_id,
  (current_date::timestamp + t.schedule_time) at time zone 'UTC',
  'pending'
from public.task_templates t;

-- 7. SEED — three residents with stable UUIDs.
insert into public.profiles (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Faizan', 'resident'),
  ('22222222-2222-2222-2222-222222222222', 'Ali',    'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Daniel', 'resident');

-- 8. STORAGE — bucket for completion photos.
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

drop policy if exists "task-photos readable by all"     on storage.objects;
drop policy if exists "task-photos uploadable by anyone" on storage.objects;

create policy "task-photos readable by all"
  on storage.objects for select using (bucket_id = 'task-photos');
create policy "task-photos uploadable by anyone"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'task-photos');

-- Final check — should return 11 rooms, 11 templates, 11 instances, 3 profiles.
select 'rooms'          as table_name, count(*) from public.rooms          union all
select 'task_templates' as table_name, count(*) from public.task_templates union all
select 'task_instances' as table_name, count(*) from public.task_instances union all
select 'profiles'       as table_name, count(*) from public.profiles;
