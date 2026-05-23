import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../theme';
import { CleaningStackParamList } from '../navigation';
import {
  Assignments,
  PROPERTY_ROOMS,
  User,
  formatDuration,
  getAssignee,
} from '../lib/data';
import { RoomTile } from '../components/RoomTile';
import {
  getAssignments,
  getCompletedRooms,
  getCurrentUserId,
  getUsers,
} from '../lib/storage';

type Props = NativeStackScreenProps<CleaningStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [c, u, a, cu] = await Promise.all([
          getCompletedRooms(),
          getUsers(),
          getAssignments(),
          getCurrentUserId(),
        ]);
        if (cancelled) return;
        setCompleted(c);
        setUsers(u);
        setAssignments(a);
        setCurrentUserId(cu);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const visibleRooms = useMemo(() => {
    if (!currentUserId) return [];
    return PROPERTY_ROOMS.filter(
      (r) => getAssignee(assignments, 'room', r.id) === currentUserId,
    );
  }, [currentUserId, assignments]);

  const remainingMinutes = visibleRooms
    .filter((r) => !completed.has(r.id))
    .reduce((sum, r) => sum + r.estimatedMinutes, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visibleRooms}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.brand}>Upkeep</Text>
            <Text style={styles.subtitle}>Your rooms today</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => {
          const assigneeId = getAssignee(assignments, 'room', item.id);
          return (
            <RoomTile
              room={item}
              completed={completed.has(item.id)}
              assignee={assigneeId ? userById.get(assigneeId) : undefined}
              onPress={() => navigation.navigate('CleaningFlow', { roomId: item.id })}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing assigned to you</Text>
            <Text style={styles.emptyBody}>
              When an admin assigns you a room, it'll show up here.
            </Text>
          </View>
        }
        ListFooterComponent={
          visibleRooms.length > 0 ? (
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
  brand: {
    ...theme.typography.display,
    color: theme.colors.primary,
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
