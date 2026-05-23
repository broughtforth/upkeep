export type RoomType =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'living-room'
  | 'hallway';

export type Room = {
  id: string;
  type: RoomType;
  name: string;
  estimatedMinutes: number;
};

export type TaskDetail = {
  title: string;
  instruction: string;
  details?: string;
  videoUrl?: string;
};

export type PropertyInfo = {
  id: string;
  name: string;
  location: string;
  postcode: string;
  bedrooms: number;
  bathrooms: number;
};

export type Log = {
  id: string;
  propertyId: string;
  roomId: string;
  roomName: string;
  cleaner: string;
  durationMinutes: number;
  completedAt: string;
};

export const PROPERTY: PropertyInfo = {
  id: 'main',
  name: 'The House',
  location: '',
  postcode: '',
  bedrooms: 0,
  bathrooms: 3,
};

export const PROPERTY_ROOMS: Room[] = [
  { id: 'symposium',         type: 'living-room', name: 'the Symposium',            estimatedMinutes: 22 },
  { id: 'atrium',            type: 'living-room', name: 'the Atrium',               estimatedMinutes: 18 },
  { id: 'kitchen',           type: 'kitchen',     name: 'the Kitchen',              estimatedMinutes: 30 },
  { id: 'forge',             type: 'living-room', name: 'the Forge',                estimatedMinutes: 20 },
  { id: 'zen-room',          type: 'bedroom',     name: 'the Zen Room',             estimatedMinutes: 18 },
  { id: 'tech-room',         type: 'living-room', name: 'the Tech Room',            estimatedMinutes: 20 },
  { id: 'media-room',        type: 'living-room', name: 'the Media Room',           estimatedMinutes: 20 },
  { id: 'bathroom-main',     type: 'bathroom',    name: 'Main Bathroom',            estimatedMinutes: 25 },
  { id: 'bathroom-walkin',   type: 'bathroom',    name: 'Walk-in Bathroom',         estimatedMinutes: 20 },
  { id: 'bathroom-media',    type: 'bathroom',    name: 'Media Room Bathroom',      estimatedMinutes: 18 },
];

export const ROOM_TASKS: Record<RoomType, TaskDetail[]> = {
  bedroom: [
    {
      title: 'Strip the bed completely',
      instruction: 'Remove all sheets, pillowcases, duvet cover, and mattress protector. Bag separately if heavily soiled.',
      details:
        'Inspect the mattress for stains while the linen is off. Check under pillows for forgotten items — phones, jewellery, charger cables. Flag any damage to the host before moving on.',
    },
    {
      title: 'Air out the room',
      instruction: 'Open the window wide for the duration of the clean.',
      details:
        'Fresh air during turnaround removes lingering smells from the previous guest. In winter, five minutes is enough — you don\'t need to freeze the room.',
    },
    {
      title: 'Dust top-down',
      instruction: 'Start at light fittings and shelves, work down to skirting boards last.',
      details:
        'Use a microfibre cloth dry for surfaces, slightly damp for picture frames. Always work top to bottom — dust falls, so cleaning low first wastes effort.',
    },
    {
      title: 'Make the bed with fresh linen',
      instruction: 'Fitted sheet, flat sheet, hospital corners, duvet cover, pillowcases. Decorative throw last.',
      details:
        'Hospital corners give a hotel finish: tuck the sheet under the mattress at the foot, lift the side hanging down, tuck the bit underneath, then fold the lifted piece down flat.',
    },
    {
      title: 'Vacuum thoroughly',
      instruction: 'Under the bed, along skirting, in corners. Move bedside tables aside.',
      details:
        'Most dust collects where the wall meets the floor. Use the crevice tool along edges. Finish with a slow pass across the open carpet for visible vacuum lines.',
    },
    {
      title: 'Wipe surfaces and mirror',
      instruction: 'Bedside tables, wardrobe handles, mirror, switches.',
      details:
        'Spray cleaner on the cloth, not the surface — overspray ruins mirrors and timber. Polish the mirror with a dry microfibre after wiping.',
    },
    {
      title: 'Stage the room',
      instruction: 'Curtains tied, lamp positioned, throw straight, pillows plumped.',
      details:
        'Take a photo from the doorway with the camera at chest height — same angle the guest will see. If it doesn\'t look magazine-ready in the photo, fix it.',
    },
  ],
  bathroom: [
    {
      title: 'Apply toilet cleaner and leave to dwell',
      instruction: 'Squirt under the rim. Move on while it works.',
      details:
        'Dwell time matters more than scrubbing. Five minutes minimum for limescale. Never mix bleach with anything containing ammonia — toxic chloramine gas.',
    },
    {
      title: 'Spray shower and tiles',
      instruction: 'Coat the screen, taps, tiles, and tray. Leave for a few minutes.',
      details:
        'Limescale remover needs contact time. Spray it first, do another task, come back to scrub. Saves significant elbow grease.',
    },
    {
      title: 'Clean the mirror',
      instruction: 'Glass cleaner on cloth, polish dry with a second microfibre.',
      details:
        'Two cloths: one to clean, one to buff. Spraying glass cleaner directly drips onto frames and silicone seals.',
    },
    {
      title: 'Scrub shower and screen',
      instruction: 'Work the dwelling cleaner with a brush. Rinse with the shower head.',
      details:
        'Squeegee the screen dry afterwards — water spots forming as it air-dries are the most common complaint in guest reviews.',
    },
    {
      title: 'Scrub and flush the toilet',
      instruction: 'Brush bowl thoroughly, wipe seat top and bottom, base, and behind.',
      details:
        'The base and the wall behind the toilet are where odours hide. Use a separate cloth from the rest of the bathroom — colour-code if you can.',
    },
    {
      title: 'Wipe sink, taps, and surfaces',
      instruction: 'Clean sink, polish taps dry, wipe surrounding counter and splashback.',
      details:
        'Chrome shows every spot. Always polish taps dry with a fresh microfibre — wet taps look dirty even when clean.',
    },
    {
      title: 'Restock and mop floor',
      instruction: 'Fresh towels, full toilet roll plus a spare, hand soap topped up. Mop last.',
      details:
        'Fold towels in thirds, edge facing outward. Two hand towels minimum. Mop from the far corner back to the doorway so you don\'t walk on a wet floor.',
    },
  ],
  kitchen: [
    {
      title: 'Empty and check the dishwasher',
      instruction: 'Put away anything from the previous cycle. Start a new load if needed.',
      details:
        'A guest finding clean dishes in the dishwasher is fine; finding dirty ones is a one-star review. Check the filter — coffee grounds and food bits accumulate here.',
    },
    {
      title: 'Clear the counters',
      instruction: 'Wipe down all worktops, splashback, and the area behind the taps.',
      details:
        'Move the kettle, toaster, and any appliances to wipe underneath. Crumbs hide there and attract insects in summer.',
    },
    {
      title: 'Clean the hob and extractor',
      instruction: 'Degrease the hob, lift grates if gas, wipe the splashback and extractor underside.',
      details:
        'For grease, a degreaser left to dwell for two minutes beats scrubbing. Don\'t forget the extractor filter underneath — it gets sticky.',
    },
    {
      title: 'Wipe inside the microwave and oven door',
      instruction: 'Wipe interior of microwave; clean the oven door glass inside and out.',
      details:
        'A cup of water with a lemon slice microwaved for two minutes loosens stuck-on splatter — wipe out easily afterwards.',
    },
    {
      title: 'Clean the sink and polish taps',
      instruction: 'Scour the sink, clear the plughole, polish the tap dry.',
      details:
        'Stainless steel: rub with the grain, not against it. A drop of olive oil on a cloth buffs out water marks at the end.',
    },
    {
      title: 'Check fridge and bin',
      instruction: 'Empty the fridge of guest leftovers. Take the bin out and replace the liner.',
      details:
        'Wipe down fridge shelves if anything\'s spilt. Leave the bin lid open briefly to air out. Spare bags should go at the bottom of the bin under the new liner.',
    },
    {
      title: 'Sweep and mop',
      instruction: 'Sweep first to lift crumbs, then mop. Start in the far corner.',
      details:
        'Mopping unswept floors just smears the dirt. Two-bucket method if you have it — rinse water separate from cleaning water.',
    },
    {
      title: 'Restock essentials',
      instruction: 'Dish soap, sponge, kitchen roll, tea towels, salt, pepper, oil.',
      details:
        'Check the welcome basket: coffee pods, tea bags, sugar. A handwritten welcome note goes on the counter, not the bed.',
    },
  ],
  'living-room': [
    {
      title: 'Tidy and reset furniture',
      instruction: 'Cushions plumped and placed, throw folded, remotes lined up.',
      details:
        'Lift each sofa cushion — coins, hair clips, and crisps accumulate. Spray a fabric refresher lightly between cushions.',
    },
    {
      title: 'Dust all surfaces',
      instruction: 'TV stand, side tables, shelves, picture frames, lamps.',
      details:
        'TV screens get a dedicated screen cloth — never use glass cleaner or paper towels. The base of lamps collects more dust than the shade.',
    },
    {
      title: 'Clean glass and mirrors',
      instruction: 'Coffee table glass, mirrors, picture frame glass.',
      details:
        'Spray cleaner on the cloth. Buff dry with a fresh microfibre to avoid streaks. Hold the cloth flat, not bunched.',
    },
    {
      title: 'Vacuum thoroughly',
      instruction: 'Under sofa cushions, along skirting, behind the TV stand.',
      details:
        'Move the rug if there is one — dust collects underneath. Vacuum the rug both directions for full pile recovery.',
    },
    {
      title: 'Wipe high-touch points',
      instruction: 'Light switches, door handles, remote controls, thermostat.',
      details:
        'Remotes are the dirtiest item in most homes. A disinfectant wipe on each remote takes ten seconds and matters more than you\'d think.',
    },
    {
      title: 'Stage the room',
      instruction: 'Curtains open, throw draped, fresh look from the doorway.',
      details:
        'Books or magazines fanned slightly — not perfectly stacked, not random. Looks lived-in but intentional.',
    },
  ],
  hallway: [
    {
      title: 'Clear the entry',
      instruction: 'Remove any guest shoes, post, or items left behind.',
      details:
        'The first 30 seconds of a guest\'s arrival happens here. Anything out of place undermines the rest of your work.',
    },
    {
      title: 'Wipe door, handle, and frame',
      instruction: 'Front door inside, handle, and frame. Then internal door handles.',
      details:
        'The front door handle is touched every entry — give it a disinfectant pass. The door itself gets marks at hand height; spot-clean those.',
    },
    {
      title: 'Dust and wipe',
      instruction: 'Shelves, console table, hooks, light switches.',
      details:
        'If there\'s a shoe rack, lift any shoes to wipe underneath. Coat hooks accumulate dust along the top edge.',
    },
    {
      title: 'Vacuum or sweep the floor',
      instruction: 'Pay attention to the doormat — shake outside if possible.',
      details:
        'Skirting boards along the hallway are the dustiest in the flat. A quick crevice-tool pass along the edges is worth doing.',
    },
    {
      title: 'Mop the floor',
      instruction: 'Mop from the far end towards the door.',
      details:
        'Leave the door propped open while the floor dries so the next person in doesn\'t leave fresh prints across it.',
    },
  ],
};

export function getRoomsForProperty(): Room[] {
  return PROPERTY_ROOMS;
}

export function getTasksForRoom(roomId: string): TaskDetail[] {
  const room = PROPERTY_ROOMS.find((r) => r.id === roomId);
  if (!room) return [];
  return ROOM_TASKS[room.type];
}

export function getRoomById(roomId: string): Room | undefined {
  return PROPERTY_ROOMS.find((r) => r.id === roomId);
}

export function getNextRoom(currentRoomId: string): Room | undefined {
  const idx = PROPERTY_ROOMS.findIndex((r) => r.id === currentRoomId);
  if (idx === -1 || idx === PROPERTY_ROOMS.length - 1) return undefined;
  return PROPERTY_ROOMS[idx + 1];
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m.toString().padStart(2, '0')}`;
}

export function formatStopwatch(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------- Inventory ----------------

export type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
export type InventoryCategory =
  | 'cleaning-products'
  | 'linens'
  | 'amenities'
  | 'supplies';

export type InventoryItem = {
  id: string;
  name: string;
  // MaterialCommunityIcons glyph name. Typed loose here so seed data and
  // user-entered icons don't fight the icon set's massive union.
  icon: string;
  quantity: number;
  status: InventoryStatus;
  category: InventoryCategory;
  lastChecked: number;
  // Room the item lives in. Items without a roomId are "global" — they show
  // in the main Inventory tab but not in any room's end-of-clean checklist
  // until a cleaner explicitly adds them to a room.
  roomId?: string;
  notes?: string;
};

const LOW_STOCK_THRESHOLD = 3;

export function getInventoryStatus(quantity: number): InventoryStatus {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'in-stock';
}

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string }[] = [
  { id: 'cleaning-products', label: 'Cleaning' },
  { id: 'linens',            label: 'Linens' },
  { id: 'amenities',         label: 'Amenities' },
  { id: 'supplies',          label: 'Supplies' },
];

export function isOnShoppingList(item: InventoryItem): boolean {
  return item.status !== 'in-stock';
}

export function getItemsForRoom(items: InventoryItem[], roomId: string): InventoryItem[] {
  return items.filter((i) => i.roomId === roomId);
}

export function getUnassignedItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => !i.roomId);
}

// Build seed timestamps relative to "now" so they're never absurdly stale.
const daysAgo = (d: number) => Date.now() - d * 24 * 60 * 60 * 1000;

export const INITIAL_INVENTORY: InventoryItem[] = [
  // Kitchen
  { id: 'inv-cif',           name: 'Cif Cream',             icon: 'bottle-tonic-outline', quantity: 5, status: 'in-stock',     category: 'cleaning-products', lastChecked: daysAgo(1),  roomId: 'kitchen' },
  { id: 'inv-sponges',       name: 'Sponges',               icon: 'cookie-outline',       quantity: 12, status: 'in-stock',    category: 'supplies',          lastChecked: daysAgo(2),  roomId: 'kitchen' },
  { id: 'inv-kitchen-roll',  name: 'Kitchen Roll',          icon: 'paper-roll-outline',   quantity: 1, status: 'low-stock',    category: 'supplies',          lastChecked: daysAgo(8),  roomId: 'kitchen' },
  { id: 'inv-bin-bags',      name: 'Bin Bags',              icon: 'delete-outline',       quantity: 20, status: 'in-stock',    category: 'supplies',          lastChecked: daysAgo(5),  roomId: 'kitchen' },
  { id: 'inv-coffee-pods',   name: 'Coffee Pods',           icon: 'coffee',               quantity: 24, status: 'in-stock',    category: 'amenities',         lastChecked: daysAgo(3),  roomId: 'kitchen' },

  // Main Bathroom
  { id: 'inv-toilet-roll',   name: 'Toilet Roll',           icon: 'paper-roll',           quantity: 16, status: 'in-stock',    category: 'amenities',         lastChecked: daysAgo(1),  roomId: 'bathroom-main' },
  { id: 'inv-hand-soap',     name: 'Hand Soap',             icon: 'hand-wash-outline',    quantity: 0, status: 'out-of-stock', category: 'amenities',         lastChecked: daysAgo(9),  roomId: 'bathroom-main' },
  { id: 'inv-bleach',        name: 'Household Bleach',      icon: 'bottle-tonic',         quantity: 4, status: 'in-stock',     category: 'cleaning-products', lastChecked: daysAgo(10), roomId: 'bathroom-main' },

  // Walk-in Bathroom
  { id: 'inv-flash',         name: 'Flash Cleaning Spray',  icon: 'spray',                quantity: 2, status: 'low-stock',    category: 'cleaning-products', lastChecked: daysAgo(5),  roomId: 'bathroom-walkin' },
  { id: 'inv-microfibre',    name: 'Microfibre Cloths',     icon: 'rectangle-outline',    quantity: 8, status: 'in-stock',     category: 'supplies',          lastChecked: daysAgo(2),  roomId: 'bathroom-walkin' },

  // Media Room Bathroom
  { id: 'inv-windex',        name: 'Windex Glass Cleaner',  icon: 'spray',                quantity: 0, status: 'out-of-stock', category: 'cleaning-products', lastChecked: daysAgo(7),  roomId: 'bathroom-media' },
  { id: 'inv-dettol-wipes',  name: 'Dettol Surface Wipes',  icon: 'package-variant',      quantity: 6, status: 'in-stock',     category: 'cleaning-products', lastChecked: daysAgo(3),  roomId: 'bathroom-media' },

  // Zen Room (bedroom)
  { id: 'inv-febreze',       name: 'Febreze Room Spray',    icon: 'air-purifier',         quantity: 3, status: 'low-stock',    category: 'cleaning-products', lastChecked: daysAgo(4),  roomId: 'zen-room' },

  // Global (no room) — appear in main Inventory tab but not in any room's check
  { id: 'inv-zoflora',       name: 'Zoflora Disinfectant',  icon: 'spray-bottle',         quantity: 4, status: 'in-stock',     category: 'cleaning-products', lastChecked: daysAgo(2) },
  { id: 'inv-ecos',          name: 'Ecos Laundry Detergent', icon: 'bottle-tonic-plus',   quantity: 2, status: 'low-stock',    category: 'cleaning-products', lastChecked: daysAgo(6) },
];

// ---------------- Laundry ----------------

export type LaundryStatus = 'in-use' | 'in-wash' | 'drying' | 'clean-storage';

export const LAUNDRY_STATUS_ORDER: LaundryStatus[] = [
  'in-use',
  'in-wash',
  'drying',
  'clean-storage',
];

export const LAUNDRY_STATUS_LABEL: Record<LaundryStatus, string> = {
  'in-use': 'In Use',
  'in-wash': 'In Wash',
  drying: 'Drying',
  'clean-storage': 'Clean Storage',
};

export type LaundryItem = {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  status: LaundryStatus;
  lastWashed: number | null;
  location: string;
  notes?: string;
};

export const INITIAL_LAUNDRY: LaundryItem[] = [
  { id: 'lin-king-duvet',     name: 'King Duvet Cover',  icon: 'bed-king-outline',     quantity: 2, status: 'clean-storage', lastWashed: daysAgo(3),  location: 'Linen Cupboard' },
  { id: 'lin-twin-duvet',     name: 'Twin Duvet Cover',  icon: 'bed-outline',          quantity: 4, status: 'in-use',        lastWashed: daysAgo(9),  location: 'Bedrooms' },
  { id: 'lin-pillowcases',    name: 'Pillowcases',       icon: 'pillar',               quantity: 16, status: 'in-use',       lastWashed: daysAgo(6),  location: 'Bedrooms' },
  { id: 'lin-fitted-sheets',  name: 'Fitted Sheets',     icon: 'rectangle-outline',    quantity: 6, status: 'in-wash',       lastWashed: daysAgo(8),  location: 'Utility' },
  { id: 'lin-bath-towels',    name: 'Bath Towels',       icon: 'hanger',               quantity: 12, status: 'clean-storage', lastWashed: daysAgo(2), location: 'Linen Cupboard' },
  { id: 'lin-hand-towels',    name: 'Hand Towels',       icon: 'hand-wash-outline',    quantity: 10, status: 'drying',       lastWashed: daysAgo(1),  location: 'Drying Rack' },
  { id: 'lin-bath-mats',      name: 'Bath Mats',         icon: 'rug',                  quantity: 4, status: 'in-use',        lastWashed: daysAgo(12), location: 'Bathrooms' },
  { id: 'lin-bath-robes',     name: 'Bath Robes',        icon: 'tshirt-crew-outline',  quantity: 2, status: 'clean-storage', lastWashed: daysAgo(5),  location: 'Linen Cupboard' },
];

export function formatLastChecked(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function nextLaundryStatus(current: LaundryStatus): LaundryStatus {
  const idx = LAUNDRY_STATUS_ORDER.indexOf(current);
  return LAUNDRY_STATUS_ORDER[(idx + 1) % LAUNDRY_STATUS_ORDER.length];
}

// Fraction of the laundry lifecycle completed for the given status.
// in-use = 0, in-wash = 0.33, drying = 0.66, clean-storage = 1.
export function laundryProgress(status: LaundryStatus): number {
  const idx = LAUNDRY_STATUS_ORDER.indexOf(status);
  return idx / (LAUNDRY_STATUS_ORDER.length - 1);
}

export function laundryBestMove(status: LaundryStatus): string {
  switch (status) {
    case 'in-use':        return 'Start wash cycle';
    case 'in-wash':       return 'Move to dryer';
    case 'drying':        return 'Fold and store';
    case 'clean-storage': return 'Restock to room';
  }
}

const WASH_DUE_DAYS = 7;

export function isWashDue(item: LaundryItem): boolean {
  if (item.status !== 'in-use') return false;
  if (!item.lastWashed) return true;
  const days = (Date.now() - item.lastWashed) / (24 * 60 * 60 * 1000);
  return days > WASH_DUE_DAYS;
}

// ---------------- Users ----------------

export type User = {
  id: string;
  name: string;
  // Hex string. Used as the avatar background; foreground is always white.
  color: string;
};

// Distinct, decent-contrast palette. Free users get the next unused color.
export const USER_COLORS = [
  '#0F7AEF',
  '#E68A2E',
  '#7E57C2',
  '#34A853',
  '#D9534F',
  '#F2A93B',
  '#1FA9A9',
  '#C0428D',
] as const;

export const INITIAL_USERS: User[] = [
  { id: 'usr-ali',    name: 'Ali',    color: USER_COLORS[0] },
  { id: 'usr-sam',    name: 'Sam',    color: USER_COLORS[1] },
  { id: 'usr-jordan', name: 'Jordan', color: USER_COLORS[2] },
];

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------- Assignments ----------------

// Single shared record: scope ('room' | 'inventory' | 'laundry') + targetId.
// Keeps the data model flat and avoids three parallel maps.
export type AssignmentScope = 'room' | 'inventory' | 'laundry';
export type Assignments = Record<string, string>; // key = `${scope}:${targetId}` → userId

export function assignmentKey(scope: AssignmentScope, targetId: string): string {
  return `${scope}:${targetId}`;
}

export function getAssignee(
  assignments: Assignments,
  scope: AssignmentScope,
  targetId: string,
): string | undefined {
  return assignments[assignmentKey(scope, targetId)];
}
