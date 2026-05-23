export type RoomType = "bathroom" | "kitchen" | "tech" | "living" | "bedroom" | "corridor";
export type TaskCategory = "cleaning" | "supplies" | "cooking" | "laundry";
export type TaskStatus = "pending" | "queued" | "assigned" | "completed";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "resident" | "admin";
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
