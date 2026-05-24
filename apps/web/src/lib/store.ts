"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Profile, Room, RoomType, TaskInstance, TaskTemplate } from "@/lib/types";
import { SEED_INSTANCES, SEED_PROFILES, SEED_ROOMS, SEED_TEMPLATES } from "@/lib/data/seed";
import { insertProfile, loadAll, updateInstance, updateInstancesBulk } from "@/lib/supabase-data";

// A label that floats over a specific room of the GLB. Position and size
// are baked in from the friend's manualRoomPositions table (same coordinate
// space as the GLB at scale=4); only `name` is user-editable.
// One axis-aligned segment that contributes to a room's volume. Used for
// rooms that aren't simple rectangles (L-shapes, T-junctions, alcoves —
// the kind the GLB actually has).
export interface RoomSegment {
  position: [number, number, number]; // world coords, not relative
  size: [number, number, number];
}

export interface RoomLabel {
  id: string;
  name: string;
  type: RoomType;
  // Anchor position for the floating label.
  position: [number, number, number];
  // Bounding box used to render the room's status-coloured volume, accept
  // drop targets, and place furniture. Treated as the *main* / primary
  // segment when the room also has `extras`.
  size: [number, number, number];
  // Extra segments for non-rectangular rooms — each is a full axis-aligned
  // box in world coords that gets unioned with the main one. Omit for
  // simple rectangular rooms.
  extras?: RoomSegment[];
  // Optional 2D floor-plan polygon (x, z pairs in world coords). When
  // present, the room's status volume is built as a single extruded prism
  // from this shape instead of from size + extras — used for rooms whose
  // walls form a stepped or L-shaped outline (e.g. the hallway) so the
  // volume has no internal seams between sub-rectangles. Y range is the
  // standard room height: 0.15 → 1.85.
  shape?: [number, number][];
  // Optional camera offset (relative to the room's centroid) used when the
  // user clicks this room. Each room has its own natural viewing angle —
  // e.g. small rooms get a closer, head-on view; rooms on the building's
  // east edge get an offset from the south-east; etc. If omitted, falls
  // back to the default offset in CameraController.
  cameraOffset?: [number, number, number];
}

// Default seeded labels — one per room of the GLB. Position is the room's
// centroid; size is the bounding box used to drop status-coloured volumes
// over each room. Name overrides persist to localStorage.
const DEFAULT_ROOM_LABELS: RoomLabel[] = [
  // The big northern living-room area was originally one rectangle called
  // Gallery (Z -8 .. 0). It's now split at Bathroom I's north wall (Z = -2.85)
  // into two rooms: Atrium (the larger northern chunk, kept in the existing
  // 'gallery' row so task history is preserved) + Symposium (the east-west
  // strip next to Bathroom I, new row 'atrium').
  { id: "gallery",          name: "Atrium",        type: "living",   position: [0,     1, -5.43],  size: [5.7,  1.7, 5.16], cameraOffset: [ 4, 10, -8] },
  { id: "atrium",           name: "Symposium",     type: "living",   position: [0,     1, -1.43],  size: [5.7,  1.7, 2.84], cameraOffset: [ 4,  8, -4] },
  { id: "bathroom1",        name: "Bathroom I",    type: "bathroom", position: [3.75,  1, -1.6],   size: [1.7,  1.7, 2.5], cameraOffset: [ 6,  5, -4] },
  { id: "hardwareLab",      name: "Hardware Lab",  type: "tech",     position: [3.4,   1,  0.8],   size: [2.55, 1.7, 2.2], cameraOffset: [ 7,  4, -3] },
  { id: "techRoom",         name: "Tech Room",     type: "tech",     position: [3.4,   1,  3.6],   size: [2.6,  1.7, 3.5], cameraOffset: [ 7,  4,  3] },
  // Hallway shape derived from actual GLB wall positions (extracted by
  // parsing the mesh). The corridor steps westward as it goes south —
  // narrow at the north (X 0.70 → 2.10), widens at the closet (X 0.30 →
  // 2.10), widens further south of the closet (X -0.10 → 2.10). Rendered
  // as a single extruded polygon so the three "steps" have no internal
  // seams between them.
  //
  // Floor-plan polygon traversed CCW (looking down at the floor):
  //   NW → NE → SE → SW (south, pre-girls section) → step east to closet
  //   wall → step east to zen wall → close.
  // `position` is the centroid of the north section so the label sits
  // there; `size` is just a non-zero placeholder (the `shape` is what
  // actually gets rendered).
  {
    id: "hallway", name: "Hallway", type: "corridor",
    position: [1.40, 1, 1.435],
    size: [1.40, 1.7, 2.77],
    cameraOffset: [4, 9, 4],
    shape: [
      [ 0.70, 0.05],  // NW
      [ 2.10, 0.05],  // NE
      [ 2.10, 5.55],  // SE
      [-0.10, 5.55],  // SW of pre-girls section
      [-0.10, 4.55],  // step east — back to closet level
      [ 0.30, 4.55],
      [ 0.30, 2.82],  // step east again — back to north corridor
      [ 0.70, 2.82],
    ],
  },
  { id: "library",          name: "Library",       type: "living",   position: [-1.1,  1,  1.3],   size: [3.5,  1.7, 2.2],  cameraOffset: [-7,  4,  2] },
  { id: "closet",           name: "Closet",        type: "bedroom",  position: [-0.5,  1,  3.55],  size: [1.5,  1.7, 1.95], cameraOffset: [ 4,  6,  5] },
  { id: "bathroom2",        name: "Bathroom II",   type: "bathroom", position: [-2.05, 1,  3.7],   size: [1.5,  1.7, 2.4],  cameraOffset: [-7,  4,  3] },
  // Girls room (formerly War Room). The room actually extends well north of
  // its "main" boundary at Z=5.80 — the corridor south of the closet
  // (X[-1.30, -0.10] × Z[4.60, 5.22]) is also part of it. Below Z=5.22 the
  // west wall (X=-1.90) kicks in, so the room widens west. The hallway's
  // pre-girls section occupies the X[-0.10, 2.10] × Z[4.55, 5.55] strip,
  // so we wrap the polygon around the hallway's SW corner.
  //
  //   walls used:
  //     closet south wall: Z=4.60 (X[-1.26, 0.23])
  //     bathroom2 east wall: X=-1.30
  //     girls-room west wall: X=-1.90 (starts at Z=5.22)
  //     girls-room east wall: X=0.80
  //     south wall: Z=8.20
  //     hallway pre-girls SW: (-0.10, 5.55) — notch
  {
    id: "warroomServerHub",
    name: "War Room",
    type: "tech",
    position: [-0.55, 1, 7],
    size: [2.75, 1.7, 2.4],
    cameraOffset: [5, 5, -5],
    shape: [
      [-1.30, 4.60],  // NW — meets closet's south wall at bathroom2-east X
      [-0.10, 4.60],  // top of corridor strip, east edge at hallway west
      [-0.10, 5.55],  // south along hallway pre-girls' west edge
      [ 0.80, 5.55],  // east along girls room's main north edge
      [ 0.80, 8.20],  // SE
      [-1.90, 8.20],  // SW — main south-west corner
      [-1.90, 5.22],  // up along the girls-room west wall
      [-1.30, 5.22],  // east along step back to corridor west edge
    ],
  },
  { id: "bathroom3",        name: "Bathroom III",  type: "bathroom", position: [-2.5,  1,  6.155], size: [0.7,  1.7, 2.3], cameraOffset: [-6,  4,  5] },
  { id: "kitchen",          name: "Kitchen",       type: "kitchen",  position: [3.7,   1, -5.5],   size: [1.7,  1.7, 5.1], cameraOffset: [ 5,  5, -6] },
];

interface AppState {
  rooms: Room[];
  profiles: Profile[];
  templates: TaskTemplate[];
  instances: TaskInstance[];
  // 'seed' until loadFromSupabase succeeds. The DashboardClient kicks off
  // the load on mount; readers don't need to care which source they're on.
  dataSource: "seed" | "supabase";
  loadError: string | null;
  hoveredRoomId: string | null;
  hoveredInstanceId: string | null;
  selectedInstanceId: string | null;
  selectedProfileId: string | null;
  draggingProfileId: string | null;

  roomLabels: RoomLabel[];
  editMode: boolean;
  // Which room the camera is currently zoomed onto, set by clicking a room
  // volume or label. CameraController watches this and animates accordingly.
  zoomedRoomId: string | null;
  // Last world position the cursor hovered over inside the 3D scene — used
  // by the coord-readout HUD so the user can call out positions to me when
  // adjusting room shapes.
  cursorPos: [number, number, number] | null;

  setHoveredRoom: (id: string | null) => void;
  setHoveredInstance: (id: string | null) => void;
  selectInstance: (id: string | null) => void;
  selectProfile: (id: string | null) => void;
  setDraggingProfile: (id: string | null) => void;

  toggleEditMode: () => void;
  renameRoomLabel: (id: string, name: string) => void;
  zoomToRoom: (id: string | null) => void;
  setCursorPos: (pos: [number, number, number] | null) => void;

  assignTaskToProfile: (instanceId: string, profileId: string) => void;
  unassignTask: (instanceId: string) => void;
  completeTask: (instanceId: string, photoUrl: string) => void;
  toggleSubtask: (instanceId: string, subtask: string) => void;
  assignAllPendingInRoom: (roomId: string, profileId: string) => string[];

  loadFromSupabase: () => Promise<void>;
  // Used by the Supabase Realtime listener so live updates from the mobile
  // app (or another browser tab) show up here instantly.
  upsertInstanceFromRemote: (next: TaskInstance) => void;
  upsertProfileFromRemote: (next: Profile) => void;

  // Create a new resident in Supabase and add them locally for instant UI.
  addProfile: (name: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  rooms: SEED_ROOMS,
  profiles: SEED_PROFILES,
  templates: SEED_TEMPLATES,
  instances: SEED_INSTANCES,
  dataSource: "seed",
  loadError: null,
  hoveredRoomId: null,
  hoveredInstanceId: null,
  selectedInstanceId: null,
  selectedProfileId: null,
  draggingProfileId: null,

  roomLabels: DEFAULT_ROOM_LABELS,
  editMode: false,
  zoomedRoomId: null,
  cursorPos: null,

  setHoveredRoom: (id) => set({ hoveredRoomId: id }),
  setHoveredInstance: (id) => set({ hoveredInstanceId: id }),
  selectInstance: (id) => set({ selectedInstanceId: id }),
  selectProfile: (id) => set({ selectedProfileId: id }),
  setDraggingProfile: (id) => set({ draggingProfileId: id }),

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  renameRoomLabel: (id, name) =>
    set((s) => ({
      roomLabels: s.roomLabels.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  zoomToRoom: (id) => set({ zoomedRoomId: id }),

  setCursorPos: (pos) => set({ cursorPos: pos }),

  assignTaskToProfile: (instanceId, profileId) => {
    const assignedAt = new Date().toISOString();
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === instanceId
          ? { ...i, assignee_id: profileId, status: "assigned", assigned_at: assignedAt }
          : i,
      ),
    }));
    if (get().dataSource === "supabase") {
      void updateInstance(instanceId, {
        assignee_id: profileId,
        status: "assigned",
        assigned_at: assignedAt,
      });
    }
  },

  unassignTask: (instanceId) => {
    const target = get().instances.find((i) => i.id === instanceId);
    if (!target) return;
    set((s) => {
      const cleared = s.instances.map((i) =>
        i.id === instanceId
          ? { ...i, assignee_id: null, status: "pending" as const, assigned_at: null, subtasks_done: [] }
          : i,
      );
      return { instances: promoteNextInQueue(cleared, target.assignee_id, target.room_id, s.templates) };
    });
    if (get().dataSource === "supabase") {
      void updateInstance(instanceId, {
        assignee_id: null,
        status: "pending",
        assigned_at: null,
        subtasks_done: [],
      });
      // Promotion (if any) is also persisted.
      const promoted = get().instances.find(
        (i) =>
          i.room_id === target.room_id &&
          i.assignee_id === target.assignee_id &&
          i.status === "assigned",
      );
      if (promoted) {
        void updateInstance(promoted.id, {
          status: "assigned",
          assigned_at: promoted.assigned_at,
        });
      }
    }
  },

  completeTask: (instanceId, photoUrl) => {
    const target = get().instances.find((i) => i.id === instanceId);
    if (!target) return;
    const completedAt = new Date().toISOString();
    set((s) => {
      const completed = s.instances.map((i) =>
        i.id === instanceId
          ? { ...i, status: "completed" as const, completed_at: completedAt, photo_url: photoUrl }
          : i,
      );
      return { instances: promoteNextInQueue(completed, target.assignee_id, target.room_id, s.templates) };
    });
    if (get().dataSource === "supabase") {
      void updateInstance(instanceId, {
        status: "completed",
        completed_at: completedAt,
        photo_url: photoUrl,
      });
      const promoted = get().instances.find(
        (i) =>
          i.room_id === target.room_id &&
          i.assignee_id === target.assignee_id &&
          i.status === "assigned",
      );
      if (promoted) {
        void updateInstance(promoted.id, {
          status: "assigned",
          assigned_at: promoted.assigned_at,
        });
      }
    }
  },

  toggleSubtask: (instanceId, subtask) => {
    let nextDone: string[] | null = null;
    set((s) => ({
      instances: s.instances.map((i) => {
        if (i.id !== instanceId) return i;
        const done = i.subtasks_done.includes(subtask)
          ? i.subtasks_done.filter((x) => x !== subtask)
          : [...i.subtasks_done, subtask];
        nextDone = done;
        return { ...i, subtasks_done: done };
      }),
    }));
    if (get().dataSource === "supabase" && nextDone) {
      void updateInstance(instanceId, { subtasks_done: nextDone });
    }
  },

  assignAllPendingInRoom: (roomId, profileId) => {
    const state = get();
    // Pick up every task in this room that isn't already completed — so
    // dragging a person onto a room reassigns it from whoever held it
    // before. Completed tasks stay locked until the daily reset.
    const candidates: TaskInstance[] = [];
    for (const t of state.templates) {
      if (t.room_id !== roomId) continue;
      const inst = state.instances.find(
        (i) =>
          i.template_id === t.id &&
          i.room_id === roomId &&
          i.status !== "completed",
      );
      if (inst) candidates.push(inst);
    }
    if (candidates.length === 0) return [];

    // Always reset the timer on a fresh assignment — even if it's a
    // re-assignment from someone else.
    const now = new Date().toISOString();
    const headId = candidates[0].id;
    const candidateIds = new Set(candidates.map((c) => c.id));

    set((s) => ({
      instances: s.instances.map((i) => {
        if (!candidateIds.has(i.id)) return i;
        if (i.id === headId) {
          return { ...i, assignee_id: profileId, status: "assigned" as const, assigned_at: now };
        }
        return { ...i, assignee_id: profileId, status: "queued" as const, assigned_at: null };
      }),
    }));

    if (get().dataSource === "supabase") {
      void updateInstancesBulk(
        candidates.map((c) => ({
          id: c.id,
          patch:
            c.id === headId
              ? { assignee_id: profileId, status: "assigned" as const, assigned_at: now }
              : { assignee_id: profileId, status: "queued" as const, assigned_at: null },
        })),
      );
    }

    return candidates.map((c) => c.id);
  },

  loadFromSupabase: async () => {
    try {
      const { rooms, profiles, templates, instances } = await loadAll();
      set({
        rooms,
        profiles,
        templates,
        instances,
        dataSource: "supabase",
        loadError: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[store] loadFromSupabase failed", e);
      set({ loadError: msg });
    }
  },

  upsertInstanceFromRemote: (next) => {
    set((s) => {
      const exists = s.instances.some((i) => i.id === next.id);
      const instances = exists
        ? s.instances.map((i) => (i.id === next.id ? next : i))
        : [...s.instances, next];
      return { instances };
    });
  },

  upsertProfileFromRemote: (next) => {
    set((s) => {
      const exists = s.profiles.some((p) => p.id === next.id);
      const profiles = exists
        ? s.profiles.map((p) => (p.id === next.id ? next : p))
        : [...s.profiles, next];
      return { profiles };
    });
  },

  addProfile: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Optimistic add disabled — let Supabase assign the UUID and round-trip
    // the row, so local state and DB never diverge on the primary key.
    const profile = await insertProfile(trimmed);
    set((s) => {
      if (s.profiles.some((p) => p.id === profile.id)) return s;
      return { profiles: [...s.profiles, profile] };
    });
  },
    }),
    {
      name: "house-tasks-v3",
      storage: createJSONStorage(() => localStorage),
      // Don't persist anything to localStorage anymore. The Supabase load
      // gives us the live truth on every page load, and the code's
      // DEFAULT_ROOM_LABELS gives us the geometry. Persisting room name
      // overrides caused renames in code to be silently swallowed by stale
      // browser storage.
      partialize: () => ({}),
      merge: (_persisted, current) => current,
    },
  ),
);

// Find the next queued instance for (assignee, room) in template order
// and promote it to assigned. Pure — returns a new instances array.
function promoteNextInQueue(
  instances: TaskInstance[],
  assigneeId: string | null,
  roomId: string,
  templates: TaskTemplate[],
): TaskInstance[] {
  if (!assigneeId) return instances;
  // Don't double up — if this person already has an active task in the
  // room (e.g. they were also actively working another node), leave the
  // queue intact.
  const stillActive = instances.some(
    (i) =>
      i.room_id === roomId &&
      i.status === "assigned" &&
      i.assignee_id === assigneeId,
  );
  if (stillActive) return instances;

  let nextId: string | null = null;
  for (const t of templates) {
    if (t.room_id !== roomId) continue;
    const candidate = instances.find(
      (i) =>
        i.template_id === t.id &&
        i.status === "queued" &&
        i.assignee_id === assigneeId,
    );
    if (candidate) {
      nextId = candidate.id;
      break;
    }
  }
  if (!nextId) return instances;

  const now = new Date().toISOString();
  return instances.map((i) =>
    i.id === nextId
      ? { ...i, status: "assigned" as const, assigned_at: now }
      : i,
  );
}

export function statusColorFor(roomId: string, instances: TaskInstance[]): string | null {
  const roomInstances = instances.filter((i) => i.room_id === roomId);
  if (roomInstances.length === 0) return null;
  if (roomInstances.some((i) => i.status === "pending")) return "#ef4444";
  if (roomInstances.some((i) => i.status === "assigned" || i.status === "queued"))
    return "#f97316";
  return "#22c55e";
}

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 52%)`;
}
