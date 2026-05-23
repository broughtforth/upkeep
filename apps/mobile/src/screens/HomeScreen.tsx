import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../theme';
import { CleaningStackParamList } from '../navigation';
import { Room, RoomType, USER_COLORS, User, formatDuration } from '../lib/data';
import { RoomTile } from '../components/RoomTile';
import { getCurrentUserId } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

type Props = NativeStackScreenProps<CleaningStackParamList, 'Home'>;

// Supabase rooms.type → mobile Room.type. The shapes overlap but not
// perfectly: web has tech/living/corridor; mobile has bedroom/living-room/
// hallway. We collapse the unsupported types into the closest mobile type
// so RoomIcon still renders something sensible.
function mapRoomType(t: string): RoomType {
  switch (t) {
    case 'bathroom': return 'bathroom';
    case 'kitchen':  return 'kitchen';
    case 'bedroom':  return 'bedroom';
    case 'corridor': return 'hallway';
    // 'tech' and 'living' both render best as living-room in mobile.
    default:         return 'living-room';
  }
}

// Joined row we ask Supabase to return: instance + room + template.
type AssignedRow = {
  id: string;
  status: 'pending' | 'queued' | 'assigned' | 'completed';
  room: { id: string; name: string; type: string } | null;
  template: { duration_min: number } | null;
};

// A locally-stored user id from an older build may be a non-UUID slug like
// 'usr-ali'. Supabase rejects those — we bail to the picker instead of
// spamming warnings.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useSession();
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  // Map roomId -> task_instance id so RoomTile can navigate to the right
  // instance when tapped. One instance per room today.
  const [instanceByRoomId, setInstanceByRoomId] = useState<Record<string, string>>({});
  const [completedRoomIds, setCompletedRoomIds] = useState<Set<string>>(new Set());
  const [assignee, setAssignee] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull the user's id + name once at first focus (and whenever focus returns).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const id = await getCurrentUserId();
        if (cancelled) return;
        // Recover from stale non-UUID ids saved by older builds.
        if (id && !UUID_RE.test(id)) {
          void signOut();
          return;
        }
        setCurrentUserIdState(id);
        if (!id) {
          setAssignee(null);
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', id)
          .single();
        if (cancelled) return;
        if (data) {
          setAssignee({
            id: data.id,
            name: data.full_name,
            color: USER_COLORS[0],
          });
        } else if (error) {
          console.warn('[home] profile lookup failed', error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [signOut]),
  );

  // Refetch the user's task_instances on focus + whenever currentUserId changes.
  const loadAssignments = useCallback(async () => {
    if (!currentUserId) {
      setRooms([]);
      setCompletedRoomIds(new Set());
      return;
    }
    const { data, error } = await supabase
      .from('task_instances')
      .select(
        'id, status, room:rooms(id, name, type), template:task_templates(duration_min)',
      )
      .eq('assignee_id', currentUserId)
      .in('status', ['assigned', 'queued', 'completed']);
    if (error) {
      console.warn('[home] loadAssignments failed', error);
      setError(error.message);
      return;
    }
    setError(null);
    const rows = (data ?? []) as unknown as AssignedRow[];
    // Dedupe by room id — the user might have many task_instances for the
    // same room in future, but the home screen shows one tile per room.
    const seen = new Set<string>();
    const mapped: Room[] = [];
    const completed = new Set<string>();
    const instanceMap: Record<string, string> = {};
    for (const r of rows) {
      if (!r.room) continue;
      if (r.status === 'completed') completed.add(r.room.id);
      if (seen.has(r.room.id)) continue;
      seen.add(r.room.id);
      instanceMap[r.room.id] = r.id;
      mapped.push({
        id: r.room.id,
        name: r.room.name,
        type: mapRoomType(r.room.type),
        estimatedMinutes: r.template?.duration_min ?? 15,
      });
    }
    setRooms(mapped);
    setCompletedRoomIds(completed);
    setInstanceByRoomId(instanceMap);
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      void loadAssignments();
    }, [loadAssignments]),
  );

  // Realtime: when the web app assigns a room to me, the row appears here
  // instantly. We just refetch on any change to task_instances — keeps the
  // logic simple and the data set is small.
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('mobile_home_assignments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_instances' },
        () => {
          void loadAssignments();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadAssignments]);

  const remainingMinutes = useMemo(
    () =>
      rooms
        .filter((r) => !completedRoomIds.has(r.id))
        .reduce((sum, r) => sum + r.estimatedMinutes, 0),
    [rooms, completedRoomIds],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.brand}>Upkeep</Text>
              <Pressable
                onPress={signOut}
                style={({ pressed }) => [
                  styles.signOutBtn,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              {assignee ? `Hi ${assignee.name} · your rooms` : 'Your rooms today'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => {
          const instanceId = instanceByRoomId[item.id];
          return (
            <RoomTile
              room={item}
              completed={completedRoomIds.has(item.id)}
              assignee={assignee ?? undefined}
              onPress={() => {
                if (!instanceId) return;
                navigation.navigate('CleaningFlow', { instanceId });
              }}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing assigned to you</Text>
            <Text style={styles.emptyBody}>
              {error
                ? error
                : "When someone assigns you a room on the web display, it'll show up here."}
            </Text>
          </View>
        }
        ListFooterComponent={
          rooms.length > 0 ? (
            <View style={styles.footerPill}>
              <Text
                style={[
                  styles.footerText,
                  remainingMinutes === 0 && { color: theme.colors.primary },
                ]}
              >
                {remainingMinutes === 0
                  ? 'All your rooms cleaned · nice work'
                  : `Estimated time remaining · ${formatDuration(remainingMinutes)}`}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    paddingBottom: theme.spacing.lg,
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    ...theme.typography.display,
    color: theme.colors.primary,
  },
  signOutBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  signOutText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.muted,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  empty: {
    paddingTop: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  footerPill: {
    alignSelf: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.pill,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '500',
  },
});
