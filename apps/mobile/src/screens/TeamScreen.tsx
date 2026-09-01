import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../theme';
import {
  Assignments,
  USER_COLORS,
  User,
} from '../lib/data';
import {
  getAssignments,
  getCurrentUserId,
  getUsers,
  saveAssignments,
  saveUsers,
  setCurrentUserId,
} from '../lib/storage';
import { Avatar } from '../components/Avatar';

export function TeamScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [u, a, current] = await Promise.all([
          getUsers(),
          getAssignments(),
          getCurrentUserId(),
        ]);
        if (cancelled) return;
        setUsers(u);
        setAssignments(a);
        setCurrentUserIdState(current);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const counts = useMemo(() => {
    const c: Record<string, { room: number; inventory: number; laundry: number }> = {};
    for (const u of users) c[u.id] = { room: 0, inventory: 0, laundry: 0 };
    for (const [key, userId] of Object.entries(assignments)) {
      if (!c[userId]) continue;
      const scope = key.split(':')[0] as 'room' | 'inventory' | 'laundry';
      c[userId][scope] += 1;
    }
    return c;
  }, [users, assignments]);

  const persistUsers = (next: User[]) => {
    setUsers(next);
    saveUsers(next);
  };

  const addOrUpdate = (input: { id?: string; name: string; color: string }) => {
    const name = input.name.trim();
    if (!name) return;
    if (input.id) {
      persistUsers(
        users.map((u) =>
          u.id === input.id ? { ...u, name, color: input.color } : u,
        ),
      );
    } else {
      persistUsers([
        ...users,
        { id: `usr-${Date.now()}`, name, color: input.color },
      ]);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setShowEditor(false);
    setEditingUser(null);
  };

  const remove = (user: User) => {
    Alert.alert(
      `Remove ${user.name}?`,
      'Their assignments will be unassigned. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            persistUsers(users.filter((u) => u.id !== user.id));
            const next: Assignments = { ...assignments };
            for (const key of Object.keys(next)) {
              if (next[key] === user.id) delete next[key];
            }
            setAssignments(next);
            saveAssignments(next);
            if (currentUserId === user.id) {
              setCurrentUserIdState(null);
              setCurrentUserId(null);
            }
          },
        },
      ],
    );
  };

  const pickCurrent = (id: string | null) => {
    setCurrentUserIdState(id);
    setCurrentUserId(id);
    Haptics.selectionAsync().catch(() => undefined);
  };

  // Pick the first unused color so new users default to something distinct.
  const nextColor = (): string => {
    const used = new Set(users.map((u) => u.color));
    return USER_COLORS.find((c) => !used.has(c)) ?? USER_COLORS[0];
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Team</Text>
      </View>

      <View style={styles.meSection}>
        <Text style={styles.sectionLabel}>I am</Text>
        <View style={styles.meRow}>
          <MeChip
            label="No one"
            active={!currentUserId}
            onPress={() => pickCurrent(null)}
          />
          {users.map((u) => (
            <MeChip
              key={u.id}
              user={u}
              label={u.name}
              active={currentUserId === u.id}
              onPress={() => pickCurrent(u.id)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No team members</Text>
            <Text style={styles.emptyBody}>
              Add people who help with cleaning, supplies, or laundry. Tap the
              plus button to start.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const c = counts[item.id] ?? { room: 0, inventory: 0, laundry: 0 };
          const total = c.room + c.inventory + c.laundry;
          return (
            <Pressable
              onPress={() => {
                setEditingUser(item);
                setShowEditor(true);
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Avatar user={item} size={48} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {total === 0
                    ? 'No assignments yet'
                    : [
                        c.room && `${c.room} room${c.room === 1 ? '' : 's'}`,
                        c.inventory &&
                          `${c.inventory} item${c.inventory === 1 ? '' : 's'}`,
                        c.laundry &&
                          `${c.laundry} linen${c.laundry === 1 ? '' : 's'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation();
                  remove(item);
                }}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel={`Remove ${item.name}`}
              >
                <Feather name="trash-2" size={18} color={theme.colors.muted} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={() => {
          setEditingUser(null);
          setShowEditor(true);
        }}
        style={({ pressed }) => [
          styles.addBtn,
          theme.shadows.md,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel="Add user"
      >
        <Feather name="plus" size={26} color={theme.colors.surface} />
      </Pressable>

      <UserEditorModal
        visible={showEditor}
        user={editingUser}
        defaultColor={nextColor()}
        onClose={() => {
          setShowEditor(false);
          setEditingUser(null);
        }}
        onSubmit={addOrUpdate}
      />
    </SafeAreaView>
  );
}

function MeChip({
  user,
  label,
  active,
  onPress,
}: {
  user?: User;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.meChip,
        active && styles.meChipActive,
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
    >
      {user ? <Avatar user={user} size={22} /> : null}
      <Text style={[styles.meChipText, active && styles.meChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function UserEditorModal({
  visible,
  user,
  defaultColor,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  user: User | null;
  defaultColor: string;
  onClose: () => void;
  onSubmit: (input: { id?: string; name: string; color: string }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultColor);

  // Sync local form state whenever the modal opens with a different target.
  React.useEffect(() => {
    if (!visible) return;
    setName(user?.name ?? '');
    setColor(user?.color ?? defaultColor);
  }, [visible, user, defaultColor]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{user ? 'Edit member' : 'Add member'}</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sam"
            placeholderTextColor={theme.colors.muted}
            style={styles.field}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorRow}>
            {USER_COLORS.map((c) => {
              const active = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={({ pressed }) => [
                    styles.colorSwatch,
                    { backgroundColor: c },
                    active && styles.colorSwatchActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel={`Pick color ${c}`}
                >
                  {active && (
                    <Feather name="check" size={16} color={theme.colors.surface} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            disabled={!name.trim()}
            onPress={() => onSubmit({ id: user?.id, name, color })}
            style={({ pressed }) => [
              styles.modalCta,
              !name.trim() && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.modalCtaText}>{user ? 'Save' : 'Add'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  headerWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    fontSize: 44,
    color: theme.colors.foreground,
  },
  addBtn: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  meSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  meChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.secondary,
  },
  meChipActive: {
    backgroundColor: theme.colors.foreground,
  },
  meChipText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.foreground,
  },
  meChipTextActive: {
    color: theme.colors.surface,
  },

  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  rowBody: { flex: 1 },
  rowName: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17,
    color: theme.colors.foreground,
  },
  rowMeta: {
    ...theme.typography.caption,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 12, 20, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  modalTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
  },
  fieldLabel: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: theme.spacing.xs,
  },
  field: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    color: theme.colors.foreground,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: theme.colors.foreground,
  },
  modalCta: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  modalCtaText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.surface,
  },
});
