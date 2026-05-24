import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// Row types — minimal subset of the shared schema. Keeping them local so
// this app has zero dependency on the rest of the monorepo's types.
export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "resident" | "admin";
  expo_push_token: string | null;
};

export type Room = {
  id: string;
  name: string;
  type: "bathroom" | "kitchen" | "tech" | "living" | "bedroom" | "corridor";
};

export type TaskTemplate = {
  id: string;
  name: string;
  instructions: string;
  subtasks: string[];
  duration_min: number;
};

export type TaskInstance = {
  id: string;
  status: "pending" | "queued" | "assigned" | "completed";
  subtasks_done: string[];
  completed_at: string | null;
};
