-- Split the old Gallery (now named Symposium, id 'gallery') into two rooms:
--   * Atrium    — northern chunk, size 5.7 × 5.16, centroid (0, -5.43).
--   * Symposium — southern chunk (the strip next to Bathroom I), size 5.7 × 2.84,
--                 centroid (0, -1.43). Stays in the existing 'gallery' row so
--                 task instances + completion history aren't lost.
--
-- The web app's roomLabels in src/lib/store.ts hold the actual 3D geometry;
-- this SQL just keeps the names + positions in sync so the mobile app and
-- any future room-aware queries get the right strings.
--
-- Safe to re-run.

-- 1. Resize the existing gallery row → southern Symposium chunk.
update public.rooms
   set name       = 'Symposium',
       position_x = 0,
       position_z = -1.43,
       width      = 5.7,
       depth      = 2.84
 where id = 'gallery';

-- 2. Insert the new northern Atrium room.
insert into public.rooms (id, name, type, position_x, position_z, width, depth, height, color)
values ('atrium', 'Atrium', 'living', 0, -5.43, 5.7, 5.16, 1.4, '#fafafa')
on conflict (id) do update
   set name       = excluded.name,
       position_x = excluded.position_x,
       position_z = excluded.position_z,
       width      = excluded.width,
       depth      = excluded.depth;

-- 3. Give Atrium its own task template + today's instance. Mirrors the
--    Symposium checklist for now — you can rewrite the subtasks later.
insert into public.task_templates (id, room_id, name, category, duration_min, schedule_time, instructions, subtasks, pin_x, pin_y, pin_z)
values (
  't-atrium', 'atrium', 'Tidy the Atrium', 'cleaning', 20, '10:00',
  E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
  array['Dust TV, electronics, and furniture','Vacuum or mop under furniture if possible','Clean windowsills and light fixtures','Wash throws or cushion covers if needed'],
  0, 0.95, 0
)
on conflict (id) do nothing;

-- Materialise today's instance so the room flashes red on first load.
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select 't-atrium', 'atrium', (current_date::timestamp + time '10:00') at time zone 'UTC', 'pending'
where not exists (
  select 1 from public.task_instances
   where template_id = 't-atrium'
     and scheduled_for >= current_date::timestamp at time zone 'UTC'
     and scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC'
);

-- 4. Verify
select id, name, position_x, position_z, width, depth from public.rooms
 where id in ('gallery','atrium') order by id;
