-- Allow the public role to INSERT into profiles. The current policies cover
-- select + update but not insert, so the web app's "+ resident" button
-- gets blocked by RLS.
--
-- Safe to re-run.

drop policy if exists "profiles insertable by public" on public.profiles;

create policy "profiles insertable by public"
  on public.profiles for insert to public with check (true);

-- Confirm
select policyname, cmd from pg_policies
  where schemaname = 'public' and tablename = 'profiles'
  order by policyname;
