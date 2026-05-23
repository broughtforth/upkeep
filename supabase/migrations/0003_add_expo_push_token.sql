-- Adds a place to store each resident's Expo push token so the web app
-- (running on the shared house display) can send a phone notification when
-- they're assigned a task or room.
--
-- The mobile app writes its own row's token on launch; the web app reads
-- the assignee's token when a drag-drop assignment happens and calls the
-- Expo push API.

alter table public.profiles
  add column if not exists expo_push_token text;
