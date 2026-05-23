-- Re-run only the SEED parts of setup_clean.sql.
-- The schema is already in place; this just fills the empty tables.

-- 5. SEED — rooms
insert into public.rooms (id, name, type, position_x, position_z, width, depth, height, color) values
  ('kitchen',          'The Kitchen',   'kitchen',   3.7,  -5.5,   1.7,  5.1,  1.4, '#fafafa'),
  ('bathroom1',        'Bathroom I',    'bathroom',  3.75, -1.6,   1.7,  2.5,  1.4, '#fafafa'),
  ('hardwareLab',      'Hardware Lab',  'tech',      3.4,   0.8,   2.55, 2.2,  1.4, '#fafafa'),
  ('techRoom',         'The Tech Room', 'tech',      3.4,   3.6,   2.6,  3.5,  1.4, '#fafafa'),
  ('gallery',          'Gallery',       'living',    0,    -4.01,  5.7,  8.0,  1.4, '#fafafa'),
  ('hallway',          'Hallway',       'corridor',  1.4,   2.8,   1.3,  5.5,  1.4, '#efe7d4'),
  ('library',          'Library',       'living',   -1.1,   1.3,   3.5,  2.2,  1.4, '#fafafa'),
  ('closet',           'Closet',        'living',   -0.5,   3.55,  1.5,  1.95, 1.4, '#fafafa'),
  ('warroomServerHub', 'War Room',      'tech',     -0.55,  7,     2.75, 2.4,  1.4, '#fafafa'),
  ('bathroom2',        'Bathroom II',   'bathroom', -2.05,  3.7,   1.5,  2.4,  1.4, '#fafafa'),
  ('bathroom3',        'Bathroom III',  'bathroom', -2.5,   6.155, 0.7,  2.3,  1.4, '#fafafa');

-- 6. SEED — task templates
insert into public.task_templates (id, room_id, name, category, duration_min, schedule_time, instructions, subtasks, pin_x, pin_y, pin_z) values
  ('t-bath1',       'bathroom1',        'Clean Bathroom I',       'cleaning', 15, '09:00',
    E'Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),
  ('t-bath2',       'bathroom2',        'Clean Bathroom II',      'cleaning', 15, '09:00',
    E'Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),
  ('t-bath3',       'bathroom3',        'Clean Bathroom III',     'cleaning', 12, '09:00',
    E'Small bathroom — same routine, less surface area. Top-to-bottom.',
    array['Scrub toilet bowl','Wipe mirror','Clean sink','Clean shower floor / tub','Clean shower drain','Wipe down remaining surfaces','Empty the bins'],
    0, 0.95, 0),
  ('t-kitchen',     'kitchen',          'Clean the Kitchen',      'cleaning', 30, '08:00',
    E'Counters before the floor. Dishes before counters. Always finish with the sink empty.',
    array['Put away dishes','Wash dishes or load the dishwasher','Wipe down counters, stovetop, and sink','Sweep the kitchen floor','Wipe spills on appliances and cabinets','Put away leftovers · check fridge for expired food','Place eggs in the egg holder'],
    0, 0.95, 0),
  ('t-gallery',     'gallery',          'Tidy the Gallery',       'cleaning', 20, '10:00',
    E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
    array['Dust TV, electronics, and furniture','Vacuum or mop under furniture if possible','Clean windowsills and light fixtures','Wash throws or cushion covers if needed'],
    0, 0.95, 0),
  ('t-library',     'library',          'Tidy the Library',       'cleaning', 20, '10:00',
    E'Dust from high to low, then vacuum / mop last so anything that falls is picked up.',
    array['Dust TV, electronics, and furniture','Vacuum or mop under furniture if possible','Clean windowsills and light fixtures','Wash throws or cushion covers if needed'],
    0, 0.95, 0),
  ('t-warroom',     'warroomServerHub', 'Reset the War Room',     'cleaning', 25, '09:00',
    E'Dust before vacuuming. Surfaces declutter first — easier to wipe.',
    array['Change bed linens','Dust furniture, lamps, and picture frames','Vacuum or sweep the floors','Organise closets and wardrobes — fold, tidy, arrange','Declutter surfaces (nightstands, dressers)'],
    0, 0.95, 0),
  ('t-closet',      'closet',           'Tidy the Closet',        'supplies', 10, '10:00',
    E'Front of shelf is grabbable. Back of shelf is stock. Nothing on the floor.',
    array['Fold loose clothes','Group like with like on each shelf','Floor cleared — door closes flush'],
    0, 0.95, 0),
  ('t-hallway',     'hallway',          'Sweep & Mop the Hallway','cleaning', 10, '09:00',
    E'Sweep first, mop second. Get the corners — that''s where it builds up.',
    array['Sweep the full length','Mop with diluted floor cleaner','Wipe skirting boards if smudged','Doormat shaken out'],
    0, 0.95, 0),
  ('t-hardwareLab', 'hardwareLab',      'Reset the Hardware Lab', 'cleaning', 15, '22:00',
    E'Workspaces → pegboard → repair depot. Tools home before anything else.',
    array['All laptops docked · pens in holders · cables coiled · desks cleared','Every tool returned to its labelled pegboard silhouette','Repair items tagged Green / Orange / Red, bin closed'],
    0, 0.95, 0),
  ('t-techRoom',    'techRoom',         'Reset the Tech Room',    'supplies', 15, '21:00',
    E'Three surfaces. Match peripherals to colour-coded labels. Lock the cabinet.',
    array['Peripherals match the colour-coded labels · drones on outlines','Lenses capped · inventory list ticked · cabinet locked','Issues logged · Canon front-panel off · cables coiled · door locked'],
    0, 0.95, 0);

-- 7. SEED — today's task instances
insert into public.task_instances (template_id, room_id, scheduled_for, status)
select
  t.id,
  t.room_id,
  (current_date::timestamp + t.schedule_time) at time zone 'UTC',
  'pending'
from public.task_templates t;

-- Quick check — should return three counts > 0
select 'rooms'          as table_name, count(*) from public.rooms          union all
select 'task_templates' as table_name, count(*) from public.task_templates union all
select 'task_instances' as table_name, count(*) from public.task_instances;
