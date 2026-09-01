-- Fix: profiles.id still has a foreign key to auth.users from an earlier
-- schema version, which blocks inserting profiles that aren't auth users.
-- This drops the FK constraint. Residents are added through the app, not
-- seeded here.
--
-- Safe to re-run.

-- 1. Drop the FK if it's there.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Make sure the column has a UUID default for any future signups.
alter table public.profiles alter column id set default gen_random_uuid();

-- 3. Verify.
select id, full_name, role from public.profiles order by full_name;
