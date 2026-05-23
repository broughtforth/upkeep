# House Ops

Visual task management for a 20-person shared residence. A procedural 3D model of the house shows every room and flashes red when a task is pending, orange while in progress, and green once complete. Drag a person from the sidebar onto a flashing room to claim its next pending task; mark complete with a photo.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind v4**
- **react-three-fiber** + **drei** for the 3D house (procedural — boxes per room)
- **dnd-kit** for drag-drop of people onto rooms
- **zustand** for client-side state (MVP — swap for Supabase reads when ready)
- **Supabase** for DB / auth / storage / realtime

## Running locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 — the app runs against in-memory seed data out of the box, so you can play with drag-drop and task completion immediately. No Supabase needed for the demo.

## Wiring up Supabase

The MVP runs entirely from `src/lib/data/seed.ts`. To swap to a real database:

### 1 · Create the project

1. Go to https://supabase.com → New Project. Save the project URL and the `anon` / `service_role` keys (Project Settings → API).
2. Copy the env template:
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (server-only) `SUPABASE_SERVICE_ROLE_KEY`.

### 2 · Apply the schema

Open the Supabase SQL editor and paste the contents of `supabase/migrations/0001_initial_schema.sql`. It creates:

- `profiles`, `rooms`, `task_templates`, `task_instances` tables
- A trigger that creates a `profiles` row whenever a user signs up
- Row-level-security policies (admins write, residents read + claim/complete their own)
- A public `task-photos` storage bucket with an upload policy
- Seed rows for all 7 rooms

> If you prefer the Supabase CLI: `supabase link` to your project, then `supabase db push`.

### 3 · Promote an admin

In the SQL editor, after the first user signs up:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

### 4 · Replace the seed store with Supabase reads

In `src/lib/store.ts`, swap the seed arrays for live queries — e.g. inside a `useEffect`:

```ts
const supabase = createClient();
const { data: rooms }     = await supabase.from("rooms").select("*");
const { data: profiles }  = await supabase.from("profiles").select("*");
const { data: templates } = await supabase.from("task_templates").select("*");
const { data: instances } = await supabase.from("task_instances").select("*");
```

Then wire mutations (`assignTaskToProfile`, `completeTask`) to `supabase.from(...).update(...)`. Subscribe to realtime so the 3D house re-colors when anyone updates a task:

```ts
supabase
  .channel("task_instances")
  .on("postgres_changes", { event: "*", schema: "public", table: "task_instances" }, refresh)
  .subscribe();
```

### 5 · Upload photos to Supabase Storage

In `src/components/task/CompleteDialog.tsx` `onFile`, replace the FileReader stub with:

```ts
const path = `${userId}/${instance.id}.jpg`;
await supabase.storage.from("task-photos").upload(path, file, { upsert: true });
const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
setPhotoUrl(data.publicUrl);
```

### 6 · Materialise daily task instances

`task_templates` are recurring definitions; `task_instances` are the concrete rows for a specific day. Create a Supabase Edge Function on a daily cron that inserts one `task_instance` per active template for the current date. Until that's wired up, you can manually run:

```sql
insert into public.task_instances (template_id, room_id, scheduled_for)
select id, room_id, (current_date + schedule_time)::timestamptz
from public.task_templates where active;
```

## Project layout

```
src/
  app/
    page.tsx              -- dashboard (3D house + sidebars)
    admin/page.tsx        -- per-person activity tracking
    layout.tsx
  components/
    DashboardClient.tsx   -- top-level DndContext + layout
    AdminClient.tsx
    house/
      House.tsx           -- r3f Canvas + lights + camera
      Room.tsx            -- one room mesh + droppable target
    sidebar/
      PeopleList.tsx      -- 20 draggable cards
      PersonCard.tsx
      TaskList.tsx
    task/
      CompleteDialog.tsx  -- complete with photo upload
  lib/
    supabase/
      client.ts           -- browser client
      server.ts           -- server client (cookies)
    data/seed.ts          -- in-memory MVP data
    store.ts              -- zustand store + status colour helper
    types.ts
supabase/
  migrations/0001_initial_schema.sql
```

## Upgrading the 3D model

The procedural boxes in `Room.tsx` are intentionally simple. To swap in a realistic model:

1. Build the house in Blender / SketchUp and export `house.glb` to `public/models/`.
2. Replace the `<mesh>` in `Room.tsx` with `useGLTF("/models/house.glb")` and raycast against named nodes (one per room).
3. Keep the dnd-kit droppable wrapper — it doesn't care what's inside.

Spline (spline.design) is a faster middle ground: design in the UI, export as a React component, and bind room-by-room state to its materials.
