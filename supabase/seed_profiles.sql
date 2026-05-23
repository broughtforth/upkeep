-- Fix: profiles.id still has a foreign key to auth.users from an earlier
-- schema version, which is blocking inserts of our 3 fixed-UUID residents.
-- This drops the FK constraint, then seeds Faizan, Ali, Daniel.
--
-- Safe to re-run.

-- 1. Drop the FK if it's there.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Make sure the column has a UUID default for any future signups.
alter table public.profiles alter column id set default gen_random_uuid();

-- 3. Insert the three residents. Skip if they already exist.
insert into public.profiles (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Faizan', 'resident'),
  ('22222222-2222-2222-2222-222222222222', 'Ali',    'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Daniel', 'resident')
on conflict (id) do nothing;

-- 4. Verify.
select id, full_name, role from public.profiles order by full_name;
