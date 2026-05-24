-- Final naming for the split living room:
--   * Big northern chunk  → Atrium    (kept in row id='gallery')
--   * Small southern strip → Symposium (row id='atrium')
--
-- Positions are unchanged from the swap migration; this only renames.
-- Safe to re-run.

update public.rooms set name = 'Atrium'    where id = 'gallery';
update public.rooms set name = 'Symposium' where id = 'atrium';

update public.task_templates set name = 'Tidy the Atrium'    where id = 't-gallery';
update public.task_templates set name = 'Tidy the Symposium' where id = 't-atrium';

select id, name, position_x, position_z, width, depth from public.rooms
 where id in ('gallery','atrium') order by id;
