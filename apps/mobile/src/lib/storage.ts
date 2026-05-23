import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Assignments,
  INITIAL_INVENTORY,
  INITIAL_LAUNDRY,
  INITIAL_USERS,
  InventoryItem,
  LaundryItem,
  Log,
  User,
} from './data';

const LOGS_KEY = 'barrowhall:logs';
const COMPLETED_KEY = 'barrowhall:completed-rooms';
// v2: items now carry a `roomId` field; the v1 seed was room-less. Bumping
// the key ignores the old shape and triggers a re-seed.
const INVENTORY_KEY = 'upkeep:inventory:v2';
const LAUNDRY_KEY = 'upkeep:laundry';
const USERS_KEY = 'upkeep:users';
const ASSIGNMENTS_KEY = 'upkeep:assignments';
const CURRENT_USER_KEY = 'upkeep:current-user';

// Persistence is best-effort: a missing/failing AsyncStorage shouldn't take
// down the cleaning flow. Reads return safe defaults; writes warn and move on.

export async function saveLog(input: {
  propertyId: string;
  roomId: string;
  roomName: string;
  cleaner: string;
  durationMinutes: number;
}): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(LOGS_KEY);
    const logs: Log[] = existing ? JSON.parse(existing) : [];
    logs.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...input,
      completedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('[storage] saveLog failed', e);
  }
}

export async function getLogs(): Promise<Log[]> {
  try {
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    return raw ? (JSON.parse(raw) as Log[]) : [];
  } catch (e) {
    console.warn('[storage] getLogs failed', e);
    return [];
  }
}

export async function getLastCleaned(roomId: string): Promise<Log | null> {
  const logs = await getLogs();
  const forRoom = logs.filter((l) => l.roomId === roomId);
  if (forRoom.length === 0) return null;
  return forRoom.reduce((latest, l) =>
    new Date(l.completedAt).getTime() > new Date(latest.completedAt).getTime() ? l : latest,
  );
}

export async function markRoomCompleted(roomId: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(COMPLETED_KEY);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    if (!ids.includes(roomId)) ids.push(roomId);
    await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('[storage] markRoomCompleted failed', e);
  }
}

export async function getCompletedRooms(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch (e) {
    console.warn('[storage] getCompletedRooms failed', e);
    return new Set();
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      LOGS_KEY,
      COMPLETED_KEY,
      INVENTORY_KEY,
      LAUNDRY_KEY,
      USERS_KEY,
      ASSIGNMENTS_KEY,
      CURRENT_USER_KEY,
    ]);
  } catch (e) {
    console.warn('[storage] clearAllData failed', e);
  }
}

// ---------------- Users ----------------

export async function getUsers(): Promise<User[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as User[];
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  } catch (e) {
    console.warn('[storage] getUsers failed', e);
    return INITIAL_USERS;
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('[storage] saveUsers failed', e);
  }
}

// ---------------- Assignments ----------------

export async function getAssignments(): Promise<Assignments> {
  try {
    const raw = await AsyncStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? (JSON.parse(raw) as Assignments) : {};
  } catch (e) {
    console.warn('[storage] getAssignments failed', e);
    return {};
  }
}

export async function saveAssignments(a: Assignments): Promise<void> {
  try {
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(a));
  } catch (e) {
    console.warn('[storage] saveAssignments failed', e);
  }
}

// Convenience: write a single assignment without round-tripping callers.
export async function setAssignment(
  key: string,
  userId: string | null,
): Promise<Assignments> {
  const a = await getAssignments();
  if (userId === null) delete a[key];
  else a[key] = userId;
  await saveAssignments(a);
  return a;
}

// ---------------- "Current user" (for the 'mine only' filter) ----------------

export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_USER_KEY);
  } catch (e) {
    console.warn('[storage] getCurrentUserId failed', e);
    return null;
  }
}

export async function setCurrentUserId(id: string | null): Promise<void> {
  try {
    if (id === null) await AsyncStorage.removeItem(CURRENT_USER_KEY);
    else await AsyncStorage.setItem(CURRENT_USER_KEY, id);
  } catch (e) {
    console.warn('[storage] setCurrentUserId failed', e);
  }
}

// ---------------- Inventory ----------------

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (raw) return JSON.parse(raw) as InventoryItem[];
    // First-run seed. Persist immediately so subsequent reads hit storage,
    // and so a partial in-memory update can't lose the seed list.
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(INITIAL_INVENTORY));
    return INITIAL_INVENTORY;
  } catch (e) {
    console.warn('[storage] getInventory failed', e);
    return INITIAL_INVENTORY;
  }
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[storage] saveInventory failed', e);
  }
}

// ---------------- Laundry ----------------

export async function getLaundry(): Promise<LaundryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LAUNDRY_KEY);
    if (raw) return JSON.parse(raw) as LaundryItem[];
    await AsyncStorage.setItem(LAUNDRY_KEY, JSON.stringify(INITIAL_LAUNDRY));
    return INITIAL_LAUNDRY;
  } catch (e) {
    console.warn('[storage] getLaundry failed', e);
    return INITIAL_LAUNDRY;
  }
}

export async function saveLaundry(items: LaundryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LAUNDRY_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[storage] saveLaundry failed', e);
  }
}
