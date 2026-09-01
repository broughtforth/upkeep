// Shared TypeScript types for the Upkeep apps (mobile + web).
// These mirror the Supabase schema in supabase/migrations/.
//
// Both apps construct their own Supabase clients (the SDK setup differs
// between Next.js SSR and React Native), but the row types live here so
// the two clients agree on shape.

export type RoomType =
  | 'bathroom'
  | 'kitchen'
  | 'tech'
  | 'living'
  | 'bedroom'
  | 'corridor';

export type TaskCategory = 'cleaning' | 'supplies' | 'cooking' | 'laundry';

export type TaskStatus = 'pending' | 'queued' | 'assigned' | 'completed';

export type Role = 'resident' | 'admin';

export interface Profile {
  id: string; // matches auth.users.id
  full_name: string;
  avatar_url: string | null;
  role: Role;
  // Expo push token, set per-device by the mobile app so the web app can
  // notify a resident when they're assigned a task.
  expo_push_token?: string | null;
  created_at?: string;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  position_x: number;
  position_z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}

export interface TaskTemplate {
  id: string;
  room_id: string;
  name: string;
  category: TaskCategory;
  duration_min: number;
  schedule_time: string;
  // The "why" + house rules — what residents read before they start.
  instructions: string;
  // The step-by-step checklist they tick off one at a time.
  subtasks: string[];
  // Where in the room the task pin sits (relative to room centre).
  // x / z in metres; y is the height above the floor.
  pin: { x: number; y: number; z: number };
}

export interface TaskInstance {
  id: string;
  template_id: string;
  room_id: string;
  scheduled_for: string;
  status: TaskStatus;
  assignee_id: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  photo_url: string | null;
  // Which subtasks have been ticked (by their label).
  subtasks_done: string[];
}

// Useful joined shapes consumed by both apps' lists.
export interface TaskInstanceWithDetails extends TaskInstance {
  template: TaskTemplate;
  room: Room;
  assignee: Profile | null;
}

// ---------- Env / config helpers ----------

// Centralized env var names so both apps spell them the same way.
export const ENV_KEYS = {
  // Web (Next.js) reads NEXT_PUBLIC_* on the client side.
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  supabaseAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // Mobile (Expo) reads EXPO_PUBLIC_* baked at build time.
  expoSupabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
  expoSupabaseAnonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
} as const;
