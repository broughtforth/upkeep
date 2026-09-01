-- =========================================================================
-- 0006 — link profiles to Supabase Auth accounts
--
-- Adds profiles.user_id pointing at auth.users so the unified app can log a
-- person in with email/password and route by their role. Existing profile
-- UUIDs (and all FKs to them — task_instances.assignee_id, room_inventory
-- .updated_by) are left untouched; we just add the link column.
--
-- After running this, auth accounts are created and linked via the admin API.
--
-- Paste into Supabase Dashboard -> SQL Editor -> New query and Run. Idempotent.
-- =========================================================================

alter table public.profiles
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

create index if not exists profiles_user_id_idx on public.profiles(user_id);
