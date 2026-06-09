-- Seed one 'room-reset' task per room. Every room gets the same universal
-- 5-step checklist. Materialises today's instances so the tasks are
-- assignable straight away. Idempotent — re-run-safe.
--
-- The web app's RoomNodes filter on view.visibleCategories, so these only
-- show up when the dual-view is in EVENING mode (or admin Force-Evening).

-- 1. Templates — one per existing room, scheduled at 22:00 (the evening
--    window). Template id pattern: 'rr-<roomId>'.
insert into public.task_templates (
  id, room_id, name, category, duration_min, schedule_time,
  instructions, subtasks, pin_x, pin_y, pin_z, active
)
select
  'rr-' || r.id,
  r.id,
  'Reset ' || r.name,
  'room-reset',
  10,
  '22:00'::time,
  E'End-of-day reset. Walk the room and leave it the way you''d want to find it tomorrow.',
  array[
    'Clear surfaces',
    'Reset cushions / linens',
    'Lights off',
    'Dispose of any rubbish',
    'Door closed'
  ],
  0, 0.95, 0,
  true
from public.rooms r
on conflict (id) do nothing;

-- 2. Today's instances — one per template that doesn't already have a row
--    today.
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select
  t.id,
  t.room_id,
  (current_date::timestamp + t.schedule_time) at time zone 'UTC',
  'pending'
from public.task_templates t
where t.category = 'room-reset'
  and not exists (
    select 1 from public.task_instances ti
     where ti.template_id = t.id
       and ti.scheduled_for >= current_date::timestamp at time zone 'UTC'
       and ti.scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC'
  );

-- 3. Verify
select 'room-reset templates' as item, count(*) from public.task_templates where category = 'room-reset'
union all
select 'room-reset instances today',  count(*) from public.task_instances
  where template_id like 'rr-%'
    and scheduled_for >= current_date::timestamp at time zone 'UTC'
    and scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC';
