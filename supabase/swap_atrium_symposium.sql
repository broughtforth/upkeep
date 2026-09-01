-- Swap the Atrium and Symposium rooms — the previous SQL named the wrong
-- chunk Symposium.
--
-- Result: Symposium = the big northern chunk (kept in row id='gallery' so
-- task history is preserved). Atrium = the east-west strip next to
-- Bathroom I (row id='atrium').
--
-- Safe to re-run.

-- 1. The 'gallery' row becomes Symposium, occupying the NORTH chunk.
update public.rooms
   set name       = 'Symposium',
       position_x = 0,
       position_z = -5.43,
       width      = 5.7,
       depth      = 5.16
 where id = 'gallery';

-- 2. The 'atrium' row stays Atrium but moves to the SOUTH chunk.
update public.rooms
   set name       = 'Atrium',
       position_x = 0,
       position_z = -1.43,
       width      = 5.7,
       depth      = 2.84
 where id = 'atrium';

-- 3. Re-point the task template names so the screen titles read right.
update public.task_templates
   set name = 'Tidy the Symposium'
 where id = 't-gallery';

update public.task_templates
   set name = 'Tidy the Atrium'
 where id = 't-atrium';

-- 4. Verify
select id, name, position_x, position_z, width, depth from public.rooms
 where id in ('gallery','atrium') order by id;
