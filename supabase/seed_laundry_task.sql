-- Seed the daily Laundry task — a single house-wide task assigned to one
-- person each day. Anchored to the atrium/Symposium because that's where the
-- assigned resident should head for the laundry round.
--
-- Idempotent: ON CONFLICT DO NOTHING on both inserts.

insert into public.task_templates (
  id, room_id, name, category, duration_min, schedule_time,
  instructions, subtasks, pin_x, pin_y, pin_z, active
) values (
  't-laundry', 'atrium', 'Laundry round', 'laundry', 45, '11:00',
  E'House laundry. Sort, wash, dry, fold, return. One person handles the whole round for the day.',
  array[
    'Sort the baskets — towels, whites, wool, mixed, underwear',
    'Load and start the machine',
    'Hang or tumble dry',
    'Fold and store',
    'Return empty baskets to their labelled spots'
  ],
  0.92, 1.40, -1.04, true
)
on conflict (id) do nothing;

-- Materialise today's instance so the laundry task is assignable right now.
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select 't-laundry', 'atrium',
       (current_date::timestamp + time '11:00') at time zone 'UTC', 'pending'
where not exists (
  select 1 from public.task_instances
   where template_id = 't-laundry'
     and scheduled_for >= current_date::timestamp at time zone 'UTC'
     and scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC'
);

select 'laundry templates' as item, count(*) from public.task_templates where category = 'laundry'
union all
select 'laundry instances today', count(*) from public.task_instances
  where template_id = 't-laundry'
    and scheduled_for >= current_date::timestamp at time zone 'UTC'
    and scheduled_for <  (current_date + 1)::timestamp at time zone 'UTC';
