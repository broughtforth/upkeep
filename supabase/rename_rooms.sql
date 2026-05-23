-- Rename four rooms + their task templates. The other seven rooms (kitchen,
-- bathroom1-3, closet, hallway, techRoom) keep their existing names.
--
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.

-- 1. Room names
update public.rooms set name = 'Symposium'    where id = 'gallery';
update public.rooms set name = 'Zen Room'     where id = 'library';
update public.rooms set name = 'Girls rooms'  where id = 'warroomServerHub';
update public.rooms set name = 'Forge'        where id = 'hardwareLab';

-- 2. Task template names (these show up as the screen title in the mobile
-- CleaningFlow). Keep them aligned with the new room names.
update public.task_templates set name = 'Tidy the Symposium'   where id = 't-gallery';
update public.task_templates set name = 'Tidy the Zen Room'    where id = 't-library';
update public.task_templates set name = 'Reset the Girls rooms' where id = 't-warroom';
update public.task_templates set name = 'Reset the Forge'      where id = 't-hardwareLab';

-- Verify
select r.id as room_id, r.name as room_name, t.name as task_name
  from public.rooms r
  left join public.task_templates t on t.room_id = r.id
  order by r.name;
