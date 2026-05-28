-- =========================================================================
-- 0004 — room_inventory
--
-- Per-room inventory the user view logs from inside a room's task flow.
-- One row per item in a room; users adjust `quantity` as they restock / use up.
--
-- Follows the project's "anyone holding the phone is that user" model: RLS is
-- enabled but every policy is granted `to public` (see fix_rls_public.sql),
-- because the user view talks to Supabase with the publishable/anon key and
-- has no real auth session.
--
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query,
-- then click Run. Safe to re-run.
-- =========================================================================

create table if not exists public.room_inventory (
  id            uuid primary key default gen_random_uuid(),
  room_id       text not null references public.rooms(id) on delete cascade,
  name          text not null,
  quantity      int  not null default 0 check (quantity >= 0),
  -- At or below this count the item reads as "low" (UI derives in/low/out).
  low_threshold int  not null default 2 check (low_threshold >= 0),
  updated_at    timestamptz not null default now(),
  -- Who last touched the count. Null-safe: keep the row if the profile is gone.
  updated_by    uuid references public.profiles(id) on delete set null
);

create index if not exists room_inventory_room_idx on public.room_inventory(room_id);

-- RLS — same open model as the rest of the schema.
alter table public.room_inventory enable row level security;

drop policy if exists "room_inventory readable by public"  on public.room_inventory;
drop policy if exists "room_inventory writable by public"   on public.room_inventory;
drop policy if exists "room_inventory insertable by public" on public.room_inventory;
drop policy if exists "room_inventory deletable by public"  on public.room_inventory;

create policy "room_inventory readable by public"
  on public.room_inventory for select to public using (true);
create policy "room_inventory writable by public"
  on public.room_inventory for update to public using (true) with check (true);
create policy "room_inventory insertable by public"
  on public.room_inventory for insert to public with check (true);
create policy "room_inventory deletable by public"
  on public.room_inventory for delete to public using (true);

-- Add to the realtime publication so the user view picks up changes live
-- (mirrors how task_instances is handled). Ignore if already added.
do $$
begin
  alter publication supabase_realtime add table public.room_inventory;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- =========================================================================
-- Seed — a few starter items per room so the section isn't empty.
-- Re-run safe: only inserts when the room has no inventory yet.
-- =========================================================================
insert into public.room_inventory (room_id, name, quantity, low_threshold)
select v.room_id, v.name, v.quantity, v.low_threshold
from (values
  ('kitchen',   'Dish soap',        3, 1),
  ('kitchen',   'Paper towels',     4, 2),
  ('kitchen',   'Trash bags',       2, 2),
  ('bathroom1', 'Toilet paper',     6, 3),
  ('bathroom1', 'Hand soap',        2, 1),
  ('bathroom1', 'Surface spray',    1, 1),
  ('bathroom2', 'Toilet paper',     5, 3),
  ('bathroom2', 'Hand soap',        2, 1),
  ('bathroom3', 'Toilet paper',     4, 3),
  ('hardwareLab', 'Microfibre cloths', 5, 2),
  ('techRoom',  'Screen wipes',     3, 1)
) as v(room_id, name, quantity, low_threshold)
where exists (select 1 from public.rooms r where r.id = v.room_id)
  and not exists (
    select 1 from public.room_inventory ri where ri.room_id = v.room_id
  );

select 'room_inventory' as table_name, count(*) as rows from public.room_inventory;
