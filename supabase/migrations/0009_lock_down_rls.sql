-- =========================================================================
-- 0009 — lock down Row Level Security
--
-- Earlier scripts (fix_rls_public.sql, setup_v2_anon_login.sql,
-- allow_profile_insert.sql, 0004, 0007) opened every table to the anon /
-- public role with `using (true)`, so anyone holding the publishable key
-- could read resident names and presence and rewrite tasks without signing
-- in. The web app signs everyone in with Google, so access is now limited
-- to signed-in org members.
--
-- Org membership: set the allowed email domain once per project with
--
--   alter database postgres set app.org_domain = 'example.com';
--
-- (the same value as NEXT_PUBLIC_ORG_DOMAIN). If it is unset, any signed-in
-- user counts as a member.
--
-- The mobile apps do not sign in, so they lose database access until they
-- get an auth flow.
--
-- Paste into Supabase Dashboard -> SQL Editor -> New query and Run. Idempotent.
-- =========================================================================

create or replace function public.is_org_member()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated'
    and (
      coalesce(current_setting('app.org_domain', true), '') = ''
      or lower(coalesce(auth.jwt() ->> 'email', ''))
         like '%@' || lower(current_setting('app.org_domain', true))
    );
$$;

-- 1. Drop every policy defined by earlier scripts (permissive ones and the
--    superseded authenticated-only ones; policies OR together, so all go).
drop policy if exists "profiles readable by public"              on public.profiles;
drop policy if exists "profiles writable by public"              on public.profiles;
drop policy if exists "profiles insertable by public"            on public.profiles;
drop policy if exists "profiles readable by anyone"              on public.profiles;
drop policy if exists "profiles writable by anyone"              on public.profiles;
drop policy if exists "profiles readable by authenticated"       on public.profiles;
drop policy if exists "profiles updatable by self"               on public.profiles;

drop policy if exists "rooms readable by public"                 on public.rooms;
drop policy if exists "rooms readable by anyone"                 on public.rooms;
drop policy if exists "rooms readable by authenticated"          on public.rooms;
drop policy if exists "rooms writable by admin"                  on public.rooms;

drop policy if exists "task_templates readable by public"        on public.task_templates;
drop policy if exists "task_templates readable by anyone"        on public.task_templates;
drop policy if exists "task_templates readable by authenticated" on public.task_templates;
drop policy if exists "task_templates writable by admin"         on public.task_templates;

drop policy if exists "task_instances readable by public"        on public.task_instances;
drop policy if exists "task_instances writable by public"        on public.task_instances;
drop policy if exists "task_instances insertable by public"      on public.task_instances;
drop policy if exists "task_instances readable by anyone"        on public.task_instances;
drop policy if exists "task_instances writable by anyone"        on public.task_instances;
drop policy if exists "task_instances insertable by anyone"      on public.task_instances;
drop policy if exists "task_instances readable by authenticated" on public.task_instances;
drop policy if exists "task_instances claim or complete"         on public.task_instances;
drop policy if exists "task_instances admin insert/delete"       on public.task_instances;

drop policy if exists "room_inventory readable by public"        on public.room_inventory;
drop policy if exists "room_inventory writable by public"        on public.room_inventory;
drop policy if exists "room_inventory insertable by public"      on public.room_inventory;
drop policy if exists "room_inventory deletable by public"       on public.room_inventory;

drop policy if exists "deep_clean readable by public"            on public.deep_clean_schedule;
drop policy if exists "deep_clean writable by public"            on public.deep_clean_schedule;
drop policy if exists "deep_clean insertable by public"          on public.deep_clean_schedule;
drop policy if exists "deep_clean deletable by public"           on public.deep_clean_schedule;

-- 2. Recreate, restricted to signed-in org members.
alter table public.profiles            enable row level security;
alter table public.rooms               enable row level security;
alter table public.task_templates      enable row level security;
alter table public.task_instances      enable row level security;
alter table public.room_inventory      enable row level security;
alter table public.deep_clean_schedule enable row level security;

drop policy if exists "profiles readable by org"   on public.profiles;
drop policy if exists "profiles writable by org"   on public.profiles;
drop policy if exists "profiles insertable by org" on public.profiles;
create policy "profiles readable by org"
  on public.profiles for select to authenticated using (public.is_org_member());
create policy "profiles writable by org"
  on public.profiles for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());
create policy "profiles insertable by org"
  on public.profiles for insert to authenticated with check (public.is_org_member());

drop policy if exists "rooms readable by org" on public.rooms;
create policy "rooms readable by org"
  on public.rooms for select to authenticated using (public.is_org_member());

drop policy if exists "task_templates readable by org" on public.task_templates;
create policy "task_templates readable by org"
  on public.task_templates for select to authenticated using (public.is_org_member());

drop policy if exists "task_instances readable by org"   on public.task_instances;
drop policy if exists "task_instances writable by org"   on public.task_instances;
drop policy if exists "task_instances insertable by org" on public.task_instances;
create policy "task_instances readable by org"
  on public.task_instances for select to authenticated using (public.is_org_member());
create policy "task_instances writable by org"
  on public.task_instances for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());
create policy "task_instances insertable by org"
  on public.task_instances for insert to authenticated with check (public.is_org_member());

drop policy if exists "room_inventory readable by org"   on public.room_inventory;
drop policy if exists "room_inventory writable by org"   on public.room_inventory;
drop policy if exists "room_inventory insertable by org" on public.room_inventory;
drop policy if exists "room_inventory deletable by org"  on public.room_inventory;
create policy "room_inventory readable by org"
  on public.room_inventory for select to authenticated using (public.is_org_member());
create policy "room_inventory writable by org"
  on public.room_inventory for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());
create policy "room_inventory insertable by org"
  on public.room_inventory for insert to authenticated with check (public.is_org_member());
create policy "room_inventory deletable by org"
  on public.room_inventory for delete to authenticated using (public.is_org_member());

drop policy if exists "deep_clean readable by org"   on public.deep_clean_schedule;
drop policy if exists "deep_clean writable by org"   on public.deep_clean_schedule;
drop policy if exists "deep_clean insertable by org" on public.deep_clean_schedule;
drop policy if exists "deep_clean deletable by org"  on public.deep_clean_schedule;
create policy "deep_clean readable by org"
  on public.deep_clean_schedule for select to authenticated using (public.is_org_member());
create policy "deep_clean writable by org"
  on public.deep_clean_schedule for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());
create policy "deep_clean insertable by org"
  on public.deep_clean_schedule for insert to authenticated with check (public.is_org_member());
create policy "deep_clean deletable by org"
  on public.deep_clean_schedule for delete to authenticated using (public.is_org_member());

-- 3. Storage: completion photos are no longer public. Read them through
--    signed URLs (storage.from('task-photos').createSignedUrl) from now on.
update storage.buckets set public = false where id = 'task-photos';

drop policy if exists "task-photos readable by all"      on storage.objects;
drop policy if exists "task-photos uploadable by anyone" on storage.objects;
drop policy if exists "task-photos uploadable by owner"  on storage.objects;
drop policy if exists "task-photos readable by org"      on storage.objects;
drop policy if exists "task-photos uploadable by org"    on storage.objects;
create policy "task-photos readable by org"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and public.is_org_member());
create policy "task-photos uploadable by org"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and public.is_org_member());
