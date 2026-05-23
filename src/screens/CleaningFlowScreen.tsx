import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { RootStackParamList } from '../navigation';
import {
  Assignments,
  InventoryCategory,
  InventoryItem,
  User,
  assignmentKey,
  formatStopwatch,
  getAssignee,
  getInventoryStatus,
  getItemsForRoom,
  getRoomById,
  getTasksForRoom,
  getUnassignedItems,
  PROPERTY,
} from '../lib/data';
import {
  getAssignments,
  getInventory,
  getUsers,
  markRoomCompleted,
  saveInventory,
  saveLog,
  setAssignment,
} from '../lib/storage';
import { ProgressBar } from '../components/ProgressBar';
import { TaskCard } from '../components/TaskCard';
import { Avatar } from '../components/Avatar';
import { AssigneePicker } from '../components/AssigneePicker';
import { InventoryStep } from '../components/InventoryStep';

const DEFAULT_CLEANER = 'Ali';

type Props = NativeStackScreenProps<RootStackParamList, 'CleaningFlow'>;
type TaskState = 'upcoming' | 'current' | 'done' | 'skipped';

export function CleaningFlowScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const room = getRoomById(roomId);
  const tasks = useMemo(() => getTasksForRoom(roomId), [roomId]);

  const [currentTask, setCurrentTask] = useState(0);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showList, setShowList] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [showAssign, setShowAssign] = useState(false);
  // Inventory snapshot for this room flow; written back on every adjustment.
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  // True once the user has advanced past the last cleaning task and the
  // room has at least one inventory item. Renders InventoryStep instead of
  // the next TaskCard.
  const [onInventoryStep, setOnInventoryStep] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, a, inv] = await Promise.all([
        getUsers(),
        getAssignments(),
        getInventory(),
      ]);
      if (cancelled) return;
      setUsers(u);
      setAssignments(a);
      setInventory(inv);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const assigneeId = getAssignee(assignments, 'room', roomId);
  const assignee = assigneeId ? users.find((u) => u.id === assigneeId) : undefined;

  const onPickAssignee = async (userId: string | null) => {
    const next = await setAssignment(assignmentKey('room', roomId), userId);
    setAssignments(next);
    setShowAssign(false);
  };

  const adjustInventory = (itemId: string, delta: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setInventory((prev) => {
      const next = prev.map((item) => {
        if (item.id !== itemId) return item;
        const quantity = Math.max(0, item.quantity + delta);
        return {
          ...item,
          quantity,
          status: getInventoryStatus(quantity),
          lastChecked: Date.now(),
        };
      });
      saveInventory(next);
      return next;
    });
  };

  const linkExistingItem = (itemId: string) => {
    setInventory((prev) => {
      const next = prev.map((item) =>
        item.id === itemId ? { ...item, roomId, lastChecked: Date.now() } : item,
      );
      saveInventory(next);
      return next;
    });
  };

  const createNewItem = (input: {
    name: string;
    category: InventoryCategory;
    quantity: number;
  }) => {
    const item: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: input.name.trim(),
      icon: 'package-variant',
      quantity: input.quantity,
      status: getInventoryStatus(input.quantity),
      category: input.category,
      lastChecked: Date.now(),
      roomId,
    };
    setInventory((prev) => {
      const next = [item, ...prev];
      saveInventory(next);
      return next;
    });
  };

  // Tick every second while the flow is mounted.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 24 }}>Room not found.</Text>
      </SafeAreaView>
    );
  }

  const roomItems = useMemo(
    () => getItemsForRoom(inventory, roomId),
    [inventory, roomId],
  );
  const unassignedItems = useMemo(
    () => getUnassignedItems(inventory),
    [inventory],
  );
  const hasInventoryStep = roomItems.length > 0;

  // Total includes the virtual inventory step (when present) for progress %.
  const cleaningTotal = tasks.length;
  const total = cleaningTotal + (hasInventoryStep ? 1 : 0);
  const finishedCount =
    done.size + skipped.size + (onInventoryStep ? 1 : 0);
  const progress = total === 0 ? 1 : finishedCount / total;
  const onLastTask = currentTask >= cleaningTotal - 1;

  function advance(markAs: 'done' | 'skipped') {
    if (onInventoryStep) {
      // Tapping Done/Skip on the inventory step closes the room.
      finishRoom();
      return;
    }

    if (markAs === 'done') {
      setDone((prev) => new Set(prev).add(currentTask));
      Haptics.selectionAsync().catch(() => undefined);
    } else {
      setSkipped((prev) => new Set(prev).add(currentTask));
    }

    if (onLastTask) {
      if (hasInventoryStep) {
        setOnInventoryStep(true);
        Haptics.selectionAsync().catch(() => undefined);
      } else {
        finishRoom();
      }
    } else {
      setCurrentTask((i) => i + 1);
    }
  }

  function goBack() {
    if (onInventoryStep) {
      // Returning from the inventory step lands back on the last task.
      setOnInventoryStep(false);
      return;
    }
    if (currentTask === 0) return;
    setCurrentTask((i) => i - 1);
    // Backtracking shouldn't lock in an earlier "done"; remove it so the user
    // can re-mark when they re-advance.
    setDone((prev) => {
      const next = new Set(prev);
      next.delete(currentTask - 1);
      return next;
    });
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(currentTask - 1);
      return next;
    });
  }

  async function finishRoom() {
    const elapsedSeconds = Math.floor((Date.now() - startTime.current) / 1000);
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    // Resolve cleaner name from the room's current assignee, if any.
    const [users, assignments] = await Promise.all([
      getUsers(),
      getAssignments(),
    ]);
    const assigneeId = getAssignee(assignments, 'room', roomId);
    const cleaner =
      (assigneeId && users.find((u) => u.id === assigneeId)?.name) ||
      DEFAULT_CLEANER;

    await markRoomCompleted(roomId);
    await saveLog({
      propertyId: PROPERTY.id,
      roomId,
      roomName: room!.name,
      cleaner,
      durationMinutes: elapsedMinutes,
    });

    // Pop straight back to the room grid; HomeScreen reloads completed state
    // via useFocusEffect.
    navigation.popToTop();
  }

  const taskStates: TaskState[] = tasks.map((_, i) => {
    if (done.has(i)) return 'done';
    if (skipped.has(i)) return 'skipped';
    if (i === currentTask) return 'current';
    return 'upcoming';
  });

  // ------------- header -------------
  const Header = (
    <View style={styles.header}>
      <Pressable
        style={styles.headerBtn}
        onPress={() => {
          if (showList) setShowList(false);
          else navigation.goBack();
        }}
        accessibilityLabel={showList ? 'Close task list' : 'Back to rooms'}
      >
        <Feather
          name={showList ? 'x' : 'chevron-left'}
          size={24}
          color={theme.colors.foreground}
        />
      </Pressable>

      <View style={styles.headerCenter}>
        <Text style={styles.headerRoom} numberOfLines={1}>{room.name}</Text>
        <View style={styles.headerMetaRow}>
          <Text style={styles.headerMeta}>
            {onInventoryStep
              ? `Step ${total} of ${total}`
              : `Task ${Math.min(currentTask + 1, total)} of ${total}`}
          </Text>
          <Text style={styles.headerMetaDot}> · </Text>
          <Feather name="watch" size={13} color={theme.colors.muted} />
          <Text style={styles.headerMeta}> {formatStopwatch(elapsed)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.headerBtn}
        onPress={() => setShowAssign(true)}
        accessibilityLabel={assignee ? `Reassign ${room.name}` : `Assign ${room.name}`}
      >
        {assignee ? (
          <Avatar user={assignee} size={28} />
        ) : (
          <Feather name="user-plus" size={20} color={theme.colors.foreground} />
        )}
      </Pressable>

      <Pressable
        style={styles.headerBtn}
        onPress={() => setShowList((s) => !s)}
        accessibilityLabel={showList ? 'Show current task' : 'Show all tasks'}
      >
        <Feather
          name={showList ? 'minimize-2' : 'list'}
          size={22}
          color={theme.colors.foreground}
        />
      </Pressable>
    </View>
  );

  // ------------- normal flow -------------
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {Header}
      <View style={styles.progressWrap}>
        <ProgressBar progress={progress} />
      </View>

      {showList ? (
        <FlatList
          data={tasks}
          keyExtractor={(_, i) => `t${i}`}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.listDivider} />}
          renderItem={({ item, index }) => {
            const state = taskStates[index];
            return (
              <View style={styles.listRow}>
                <TaskStateIcon state={state} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.listRowTitle,
                      state === 'done' && { textDecorationLine: 'line-through', color: theme.colors.muted },
                      state === 'skipped' && { color: theme.colors.muted },
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.listRowBadge}>
                  {state === 'current' ? 'now'
                    : state === 'done' ? 'done'
                    : state === 'skipped' ? 'skipped'
                    : 'next'}
                </Text>
              </View>
            );
          }}
        />
      ) : onInventoryStep ? (
        <Animated.View
          key="inventory-step"
          entering={SlideInRight.duration(280)}
          exiting={SlideOutLeft.duration(220)}
          style={{ flex: 1 }}
        >
          <InventoryStep
            roomId={roomId}
            roomName={room.name}
            items={roomItems}
            unassignedGlobal={unassignedItems}
            onAdjust={adjustInventory}
            onLinkExisting={linkExistingItem}
            onCreateNew={createNewItem}
          />
        </Animated.View>
      ) : (
        <Animated.View
          // The key remount drives a fresh slide animation per task.
          key={currentTask}
          entering={SlideInRight.duration(280)}
          exiting={SlideOutLeft.duration(220)}
          style={{ flex: 1 }}
        >
          <TaskCard task={tasks[currentTask]} index={currentTask} total={total} />
        </Animated.View>
      )}

      {!showList && (
        <View style={styles.footerBar}>
          <Pressable
            disabled={!onInventoryStep && currentTask === 0}
            style={({ pressed }) => [
              styles.iconBtn,
              !onInventoryStep && currentTask === 0 && { opacity: 0.35 },
              pressed && { opacity: 0.6 },
            ]}
            onPress={goBack}
            accessibilityLabel="Previous step"
          >
            <Feather name="arrow-left" size={20} color={theme.colors.foreground} />
          </Pressable>

          {(!onLastTask || onInventoryStep) && (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => advance('skipped')}
            >
              <Text style={styles.secondaryBtnText}>Skip</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => advance('done')}
          >
            <Text style={styles.primaryBtnText}>
              {onInventoryStep
                ? 'Finish room'
                : onLastTask && !hasInventoryStep
                ? 'Finish room'
                : 'Done'}
            </Text>
            <Feather
              name={
                onInventoryStep || (onLastTask && !hasInventoryStep)
                  ? 'check'
                  : 'arrow-right'
              }
              size={18}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>
      )}

      <AssigneePicker
        visible={showAssign}
        users={users}
        currentUserId={assigneeId}
        title={`Assign ${room.name}`}
        onClose={() => setShowAssign(false)}
        onPick={onPickAssignee}
      />
    </SafeAreaView>
  );
}

function TaskStateIcon({ state }: { state: TaskState }) {
  if (state === 'done') {
    return (
      <View style={[styles.stateDot, { backgroundColor: theme.colors.primaryContainer }]}>
        <Feather name="check" size={14} color={theme.colors.primary} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={[styles.stateDot, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.stateDotInner} />
      </View>
    );
  }
  if (state === 'skipped') {
    return (
      <View style={[styles.stateDot, { backgroundColor: theme.colors.secondary }]}>
        <Feather name="skip-forward" size={13} color={theme.colors.muted} />
      </View>
    );
  }
  return (
    <View style={[styles.stateDot, { backgroundColor: theme.colors.secondary }]}>
      <Feather name="clock" size={13} color={theme.colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'flex-start', paddingLeft: theme.spacing.xs },
  headerRoom: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerMeta: {
    ...theme.typography.caption,
  },
  headerMetaDot: {
    ...theme.typography.caption,
  },
  progressWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },

  listBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  listRowTitle: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  listRowBadge: {
    ...theme.typography.label,
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  stateDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.background,
  },

  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.secondary,
  },
  secondaryBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.foreground,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  primaryBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },

});
