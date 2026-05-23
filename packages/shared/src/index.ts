// Shared TypeScript types for the Upkeep apps (mobile + web).
// These mirror the Supabase schema in supabase/migrations/.
//
// Both apps construct their own Supabase clients (the SDK setup differs
// between Next.js SSR and React Native), but the row types live here so
// the two clients agree on shape.

export type Role = 'admin' | 'cleaner';

export type TaskStatus = 'pending' | 'in_progress' | 'complete';

// Categories map to the top-level chores you'd see in the cleaning app:
// kitchen, bathroom, restock, bins, beds, robovac, surfaces, organising.
export type TaskCategory =
  | 'kitchen'
  | 'bathroom'
  | 'restock'
  | 'bins'
  | 'beds'
  | 'robovac'
  | 'surfaces'
  | 'organising';

export type Profile = {
  id: string; // matches auth.users.id
  email: string;
  full_name: string | null;
  role: Role;
  // Hex color for avatar background — admin can set or auto-assign.
  color: string | null;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  // Optional grouping for the 3D model / sidebar.
  floor: number | null;
  created_at: string;
};

// A reusable definition of a task. Materialised into task_instances
// daily by a scheduled job (or manually for now).
export type TaskTemplate = {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  // Which room this template applies to. NULL = whole-house (e.g. Robovac).
  room_id: string | null;
  // Default estimated duration in minutes.
  estimated_minutes: number;
  // Whether new instances should be auto-created daily.
  active: boolean;
  created_at: string;
};

// A concrete task for a specific day, optionally assigned to someone.
export type TaskInstance = {
  id: string;
  template_id: string;
  room_id: string | null;
  // Profile.id of the assigned cleaner. NULL = unassigned.
  assigned_to: string | null;
  status: TaskStatus;
  // ISO timestamp the cleaner started; updated when status -> in_progress.
  started_at: string | null;
  // ISO timestamp the cleaner completed; updated when status -> complete.
  completed_at: string | null;
  // Optional photo proof uploaded to the `task-photos` Supabase bucket.
  photo_url: string | null;
  // The date this instance is for (YYYY-MM-DD in the property's timezone).
  scheduled_for: string;
  created_at: string;
};

// Useful joined shapes consumed by both apps' lists.
export type TaskInstanceWithDetails = TaskInstance & {
  template: TaskTemplate;
  room: Room | null;
  assignee: Profile | null;
};

// ---------- Env / config helpers ----------

// Centralized env var names so both apps spell them the same way.
export const ENV_KEYS = {
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  supabaseAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // Mobile-only: Expo exposes env vars via EXPO_PUBLIC_*.
  expoSupabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
  expoSupabaseAnonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
} as const;
