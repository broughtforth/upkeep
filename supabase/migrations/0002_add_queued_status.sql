-- Adds the 'queued' task status used for sequential per-room execution:
-- when a person owns a whole room, only the first task is 'assigned' and
-- starts the timer; the rest sit as 'queued' until promoted.

alter table public.task_instances
  drop constraint if exists task_instances_status_check;

alter table public.task_instances
  add constraint task_instances_status_check
  check (status in ('pending', 'queued', 'assigned', 'completed'));
