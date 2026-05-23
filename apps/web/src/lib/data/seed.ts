// Local seed data for the MVP / pre-Supabase mode.
//
// One task per room: each room has a single checklist that's the full list
// of subtasks for that room. The room node in the 3D view shows the room
// name, total estimated time, and checklist progress.
//
// Room geometry is derived from the GLB (`telos-house.glb`) and matches the
// roomLabels in `src/lib/store.ts`. Pins now sit at the room centre (the
// node is the room's only marker beyond the floating label).

import type { Profile, Room, TaskInstance, TaskTemplate } from "@/lib/types";

const WALL_H = 1.4;

export const SEED_ROOMS: Room[] = [
  { id: "kitchen",          name: "The Kitchen",   type: "kitchen",  position_x:  3.7,  position_z: -5.5,   width: 1.7,  depth: 5.1,  height: WALL_H, color: "#fafafa" },
  { id: "bathroom1",        name: "Bathroom I",    type: "bathroom", position_x:  3.75, position_z: -1.6,   width: 1.7,  depth: 2.5,  height: WALL_H, color: "#fafafa" },
  { id: "hardwareLab",      name: "Hardware Lab",  type: "tech",     position_x:  3.4,  position_z:  0.8,   width: 2.55, depth: 2.2,  height: WALL_H, color: "#fafafa" },
  { id: "techRoom",         name: "The Tech Room", type: "tech",     position_x:  3.4,  position_z:  3.6,   width: 2.6,  depth: 3.5,  height: WALL_H, color: "#fafafa" },
  { id: "gallery",          name: "Gallery",       type: "living",   position_x:  0,    position_z: -4.01,  width: 5.7,  depth: 8.0,  height: WALL_H, color: "#fafafa" },
  { id: "hallway",          name: "Hallway",       type: "corridor", position_x:  1.4,  position_z:  2.8,   width: 1.3,  depth: 5.5,  height: WALL_H, color: "#efe7d4" },
  { id: "library",          name: "Library",       type: "living",   position_x: -1.1,  position_z:  1.3,   width: 3.5,  depth: 2.2,  height: WALL_H, color: "#fafafa" },
  { id: "closet",           name: "Closet",        type: "living",   position_x: -0.5,  position_z:  3.55,  width: 1.5,  depth: 1.95, height: WALL_H, color: "#fafafa" },
  { id: "warroomServerHub", name: "War Room",      type: "tech",     position_x: -0.55, position_z:  7,     width: 2.75, depth: 2.4,  height: WALL_H, color: "#fafafa" },
  { id: "bathroom2",        name: "Bathroom II",   type: "bathroom", position_x: -2.05, position_z:  3.7,   width: 1.5,  depth: 2.4,  height: WALL_H, color: "#fafafa" },
  { id: "bathroom3",        name: "Bathroom III",  type: "bathroom", position_x: -2.5,  position_z:  6.155, width: 0.7,  depth: 2.3,  height: WALL_H, color: "#fafafa" },
];

// Real Telos House residents (Names.txt)
const RESIDENT_NAMES = [
  "Daniel", "Sameed", "Axel", "Naziha", "Sophia", "Assiya", "Silmi", "Mussab",
  "Will", "Kiki", "Sam", "Abdulazeez", "Mika", "A.R.", "Mikias", "Laila",
  "Zaheed", "Clara", "Celine", "Panos", "Janya", "Aristotle", "Faizan",
  "Hamza", "Ty", "Ali", "Maitham", "Micah", "Hussam", "Fivos", "Dihya",
  "Adam I", "Simon", "Ivoine",
];

export const SEED_PROFILES: Profile[] = RESIDENT_NAMES.map((name, i) => ({
  id: `p${i + 1}`,
  full_name: name,
  avatar_url: null,
  role: i === 0 ? "admin" : "resident",
}));

// Y_MID = mid-height of the room (waist level). The node sits at the room's
// centroid at this height so it floats nicely in the middle of the space.
const Y_MID = 0.95;

// One task per room. The room node UI reads `name` for the title,
// `duration_min` for the time chip, and `subtasks` for the checklist.
export const SEED_TEMPLATES: TaskTemplate[] = [
  // ─── Bathrooms — same 7-item checklist for each ──────────────────────
  {
    id: "t-bath1",
    room_id: "bathroom1",
    category: "cleaning",
    duration_min: 15,
    schedule_time: "09:00",
    name: "Clean Bathroom I",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.`,
    subtasks: [
      "Scrub toilet bowl",
      "Wipe mirror",
      "Clean sink",
      "Clean shower floor / tub",
      "Clean shower drain",
      "Wipe down remaining surfaces",
      "Empty the bins",
    ],
  },
  {
    id: "t-bath2",
    room_id: "bathroom2",
    category: "cleaning",
    duration_min: 15,
    schedule_time: "09:00",
    name: "Clean Bathroom II",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Top-to-bottom — start with the highest surface and work down. Glass last so it stays streak-free.`,
    subtasks: [
      "Scrub toilet bowl",
      "Wipe mirror",
      "Clean sink",
      "Clean shower floor / tub",
      "Clean shower drain",
      "Wipe down remaining surfaces",
      "Empty the bins",
    ],
  },
  {
    id: "t-bath3",
    room_id: "bathroom3",
    category: "cleaning",
    duration_min: 12,
    schedule_time: "09:00",
    name: "Clean Bathroom III",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Small bathroom — same routine, less surface area. Top-to-bottom.`,
    subtasks: [
      "Scrub toilet bowl",
      "Wipe mirror",
      "Clean sink",
      "Clean shower floor / tub",
      "Clean shower drain",
      "Wipe down remaining surfaces",
      "Empty the bins",
    ],
  },

  // ─── Kitchen ─────────────────────────────────────────────────────────
  {
    id: "t-kitchen",
    room_id: "kitchen",
    category: "cleaning",
    duration_min: 30,
    schedule_time: "08:00",
    name: "Clean the Kitchen",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Counters before the floor. Dishes before counters. Always finish with the sink empty.`,
    subtasks: [
      "Put away dishes",
      "Wash dishes or load the dishwasher",
      "Wipe down counters, stovetop, and sink",
      "Sweep the kitchen floor",
      "Wipe spills on appliances and cabinets",
      "Put away leftovers · check fridge for expired food",
      "Place eggs in the egg holder",
    ],
  },

  // ─── Living & common areas: Gallery + Library ────────────────────────
  {
    id: "t-gallery",
    room_id: "gallery",
    category: "cleaning",
    duration_min: 20,
    schedule_time: "10:00",
    name: "Tidy the Gallery",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Dust from high to low, then vacuum / mop last so anything that falls is picked up.`,
    subtasks: [
      "Dust TV, electronics, and furniture",
      "Vacuum or mop under furniture if possible",
      "Clean windowsills and light fixtures",
      "Wash throws or cushion covers if needed",
    ],
  },
  {
    id: "t-library",
    room_id: "library",
    category: "cleaning",
    duration_min: 20,
    schedule_time: "10:00",
    name: "Tidy the Library",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Dust from high to low, then vacuum / mop last so anything that falls is picked up.`,
    subtasks: [
      "Dust TV, electronics, and furniture",
      "Vacuum or mop under furniture if possible",
      "Clean windowsills and light fixtures",
      "Wash throws or cushion covers if needed",
    ],
  },

  // ─── War Room — treated as a bedroom-style space ─────────────────────
  {
    id: "t-warroom",
    room_id: "warroomServerHub",
    category: "cleaning",
    duration_min: 25,
    schedule_time: "09:00",
    name: "Reset the War Room",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Dust before vacuuming. Surfaces declutter first — easier to wipe.`,
    subtasks: [
      "Change bed linens",
      "Dust furniture, lamps, and picture frames",
      "Vacuum or sweep the floors",
      "Organise closets and wardrobes — fold, tidy, arrange",
      "Declutter surfaces (nightstands, dressers)",
    ],
  },

  // ─── Closet — small tidy-up ──────────────────────────────────────────
  {
    id: "t-closet",
    room_id: "closet",
    category: "supplies",
    duration_min: 10,
    schedule_time: "10:00",
    name: "Tidy the Closet",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Front of shelf is grabbable. Back of shelf is stock. Nothing on the floor.`,
    subtasks: [
      "Fold loose clothes",
      "Group like with like on each shelf",
      "Floor cleared — door closes flush",
    ],
  },

  // ─── Hallway ─────────────────────────────────────────────────────────
  {
    id: "t-hallway",
    room_id: "hallway",
    category: "cleaning",
    duration_min: 10,
    schedule_time: "09:00",
    name: "Sweep & Mop the Hallway",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Sweep first, mop second. Get the corners — that's where it builds up.`,
    subtasks: [
      "Sweep the full length",
      "Mop with diluted floor cleaner",
      "Wipe skirting boards if smudged",
      "Doormat shaken out",
    ],
  },

  // ─── Hardware Lab — friend's existing list, untouched ────────────────
  {
    id: "t-hardwareLab",
    room_id: "hardwareLab",
    category: "cleaning",
    duration_min: 15,
    schedule_time: "22:00",
    name: "Reset the Hardware Lab",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Workspaces → pegboard → repair depot. Tools home before anything else.`,
    subtasks: [
      "All laptops docked · pens in holders · cables coiled · desks cleared",
      "Every tool returned to its labelled pegboard silhouette",
      "Repair items tagged Green / Orange / Red, bin closed",
    ],
  },

  // ─── Tech Room — friend's existing list, untouched ───────────────────
  {
    id: "t-techRoom",
    room_id: "techRoom",
    category: "supplies",
    duration_min: 15,
    schedule_time: "21:00",
    name: "Reset the Tech Room",
    pin: { x: 0, y: Y_MID, z: 0 },
    instructions:
`Three surfaces. Match peripherals to colour-coded labels. Lock the cabinet.`,
    subtasks: [
      "Peripherals match the colour-coded labels · drones on outlines",
      "Lenses capped · inventory list ticked · cabinet locked",
      "Issues logged · Canon front-panel off · cables coiled · door locked",
    ],
  },
];

const today = new Date().toISOString().slice(0, 10);
export const SEED_INSTANCES: TaskInstance[] = SEED_TEMPLATES.map((t, i) => ({
  id: `i${i + 1}`,
  template_id: t.id,
  room_id: t.room_id,
  scheduled_for: `${today}T${t.schedule_time}:00`,
  status: "pending",
  assignee_id: null,
  assigned_at: null,
  completed_at: null,
  photo_url: null,
  subtasks_done: [],
}));
