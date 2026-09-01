-- One-shot: finalize the Atrium/Symposium split. Idempotent — safe even
-- if some of the earlier migrations partially landed.
--
-- Final state:
--   row id='gallery'  → name 'Atrium',    big north chunk    (5.7 × 5.16)
--   row id='atrium'   → name 'Symposium', strip next to BathI (5.7 × 2.84)

-- 1. The big row (originally Gallery) becomes Atrium and shrinks to the
--    northern chunk.
update public.rooms
   set name       = 'Atrium',
       position_x = 0,
       position_z = -5.43,
       width      = 5.7,
       depth      = 5.16
 where id = 'gallery';

update public.task_templates
   set name = 'Tidy the Atrium'
 where id = 't-gallery';

-- 2. Create / re-place the small row as Symposium next to Bathroom I.
insert into public.rooms (id, name, type, position_x, position_z, width, depth, height, color)
values ('atrium', 'Symposium', 'living', 0, -1.43, 5.7, 2.84, 1.4, '#fafafa')
on conflict (id) do update
   set name       = excluded.name,
       position_x = excluded.position_x,
       position_z = excluded.position_z,
       width      = excluded.width,
       depth      = excluded.depth;

-- 3. The Symposium room gets a task template + today's instance.
insert into public.task_templates (id, room_id, name, category, duration_min, schedule_time, instructions, subtasks, pin_x, pin_y, pin_z)
values (
  't-atrium', 'atrium', 'Tidy the Symposium', 'cleaning', 15, '10:00',
  E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
  array['Dust surfaces and shelves','Vacuum or mop the floor','Wipe down any high-touch areas','Reset cushions and throws'],
  0, 0.95, 0
)
on conflict (id) do update
   set name = excluded.name;

-- Materialise today's instance for the new Symposium so it flashes red.
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
