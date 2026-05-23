import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Row types — kept minimal here so the screens don't import @upkeep/shared
// and pull in the whole monorepo type surface. Mirrors the public schema.
export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: 'resident' | 'admin';
  expo_push_token: string | null;
  created_at: string;
};

export type TaskTemplate = {
  id: string;
  room_id: string;
  name: string;
  category: 'cleaning' | 'supplies' | 'cooking' | 'laundry';
  duration_min: number;
  schedule_time: string;
  active: boolean;
  instructions: string;
  subtasks: string[];
};

export type TaskInstance = {
  id: string;
  template_id: string;
  room_id: string;
  scheduled_for: string;
  status: 'pending' | 'queued' | 'assigned' | 'completed';
  assignee_id: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  photo_url: string | null;
  subtasks_done: string[];
};
