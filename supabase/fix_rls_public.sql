-- Fix: replace the anon/authenticated RLS policies with policies that allow
-- the PUBLIC role (which always matches, regardless of how the publishable
-- key is being interpreted).
--
-- Background: Supabase recently rolled out "publishable" keys with the
-- `sb_publishable_…` prefix. They no longer map cleanly to the older
-- `anon` JWT role in some projects, so policies targeting `to anon` can
-- silently block all rows. `to public` always matches.
--
-- Same security model as before: "anyone holding the device is that user".

-- profiles
drop policy if exists "profiles readable by anyone" on public.profiles;
drop policy if exists "profiles writable by anyone" on public.profiles;
create policy "profiles readable by public"
  on public.profiles for select to public using (true);
create policy "profiles writable by public"
  on public.profiles for update to public using (true) with check (true);

-- rooms
drop policy if exists "rooms readable by anyone" on public.rooms;
create policy "rooms readable by public"
  on public.rooms for select to public using (true);

-- task_templates
drop policy if exists "task_templates readable by anyone" on public.task_templates;
create policy "task_templates readable by public"
  on public.task_templates for select to public using (true);

-- task_instances
drop policy if exists "task_instances readable by anyone"  on public.task_instances;
drop policy if exists "task_instances writable by anyone"  on public.task_instances;
drop policy if exists "task_instances insertable by anyone" on public.task_instances;
create policy "task_instances readable by public"
  on public.task_instances for select to public using (true);
create policy "task_instances writable by public"
  on public.task_instances for update to public using (true) with check (true);
create policy "task_instances insertable by public"
  on public.task_instances for insert to public with check (true);

-- Confirm by selecting some data
select 'profiles' as table_name, count(*) from public.profiles union all
select 'rooms'    as table_name, count(*) from public.rooms;
