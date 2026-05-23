import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { LaundryStackParamList } from '../navigation';
import {
  Assignments,
  LAUNDRY_STATUS_LABEL,
  LAUNDRY_STATUS_ORDER,
  LaundryItem,
  LaundryStatus,
  User,
  assignmentKey,
  formatLastChecked,
  getAssignee,
} from '../lib/data';
import {
  getAssignments,
  getLaundry,
  getUsers,
  saveLaundry,
  setAssignment,
} from '../lib/storage';
import { Avatar } from '../components/Avatar';
import { AssigneePicker } from '../components/AssigneePicker';

type Props = NativeStackScreenProps<LaundryStackParamList, 'LaundryDetail'>;

const STATUS_COLOR: Record<LaundryStatus, string> = {
  'in-use': theme.colors.primary,
  'in-wash': '#7E57C2',
  drying: '#FF9800',
  'clean-storage': '#05B046',
};

export function LaundryDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const [item, setItem] = useState<LaundryItem | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [showPicker, setShowPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [all, u, a] = await Promise.all([
          getLaundry(),
          getUsers(),
          getAssignments(),
        ]);
        if (cancelled) return;
        setItem(all.find((i) => i.id === itemId) ?? null);
        setUsers(u);
        setAssignments(a);
      })();
      return () => {
        cancelled = true;
      };
    }, [itemId]),
  );

  const assigneeId = getAssignee(assignments, 'laundry', itemId);
  const assignee = assigneeId ? users.find((u) => u.id === assigneeId) : undefined;

  const onPickAssignee = async (userId: string | null) => {
    const next = await setAssignment(assignmentKey('laundry', itemId), userId);
    setAssignments(next);
    setShowPicker(false);
  };

  const persist = async (next: LaundryItem) => {
    setItem(next);
    const all = await getLaundry();
    await saveLaundry(all.map((i) => (i.id === next.id ? next : i)));
  };

  const setStatus = (status: LaundryStatus) => {
    if (!item || status === item.status) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    const lastWashed =
      status === 'clean-storage' ? Date.now() : item.lastWashed;
    persist({ ...item, status, lastWashed });
  };

  const startWashCycle = () => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    persist({ ...item, status: 'in-wash' });
  };

  const adjust = (delta: number) => {
    if (!item) return;
    Haptics.selectionAsync().catch(() => undefined);
    persist({ ...item, quantity: Math.max(0, item.quantity + delta) });
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="Item" />
        <Text style={styles.missing}>Item not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header onBack={() => navigation.goBack()} title={item.name} />

      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={[
            styles.iconWell,
            { backgroundColor: STATUS_COLOR[item.status] + '22' },
          ]}
        >
          <MaterialCommunityIcons
            name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={64}
            color={STATUS_COLOR[item.status]}
          />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.statusButtons}>
            {LAUNDRY_STATUS_ORDER.map((s) => {
              const active = s === item.status;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStatus(s)}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    active && {
                      backgroundColor: STATUS_COLOR[s],
                      borderColor: STATUS_COLOR[s],
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityLabel={`Set status to ${LAUNDRY_STATUS_LABEL[s]}`}
                >
                  <Text
                    style={[
                      styles.statusBtnText,
                      active && { color: '#fff' },
                    ]}
                  >
                    {LAUNDRY_STATUS_LABEL[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.qtyCard}>
          <Text style={styles.cardLabel}>Quantity</Text>
          <View style={styles.qtyRow}>
            <Pressable
              onPress={() => adjust(-1)}
              style={({ pressed }) => [
                styles.qtyBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Decrease quantity"
            >
              <Feather name="minus" size={22} color={theme.colors.foreground} />
            </Pressable>
            <Text style={styles.qtyValue}>{item.quantity}</Text>
            <Pressable
              onPress={() => adjust(1)}
              style={({ pressed }) => [
                styles.qtyBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Increase quantity"
            >
              <Feather name="plus" size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.metaCard}>
          <MetaRow label="Location" value={item.location} />
          <Divider />
          <MetaRow
            label="Last washed"
            value={formatLastChecked(item.lastWashed)}
          />
          <Divider />
          <Pressable
            onPress={() => setShowPicker(true)}
            style={({ pressed }) => [styles.metaRow, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Change assignee"
          >
            <Text style={styles.metaLabel}>Assigned to</Text>
            <View style={styles.assigneeValue}>
              <Avatar user={assignee} size={26} emptyVariant="plus" />
              <Text style={styles.metaValue}>
                {assignee ? assignee.name : 'Unassigned'}
              </Text>
            </View>
          </Pressable>
        </View>

        {item.status !== 'in-wash' && (
          <Pressable
            onPress={startWashCycle}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Feather name="droplet" size={18} color={theme.colors.primary} />
            <Text style={styles.primaryBtnText}>Start wash cycle</Text>
          </Pressable>
        )}
      </ScrollView>

      <AssigneePicker
        visible={showPicker}
        users={users}
        currentUserId={assigneeId}
        title={`Assign ${item.name}`}
        onClose={() => setShowPicker(false)}
        onPick={onPickAssignee}
      />
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.headerBtn} onPress={onBack} accessibilityLabel="Back">
        <Feather name="chevron-left" size={24} color={theme.colors.foreground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    flex: 1,
  },
  missing: {
    padding: theme.spacing.lg,
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  iconWell: {
    alignSelf: 'center',
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardLabel: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: theme.spacing.sm,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusBtn: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  statusBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.foreground,
  },
  qtyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 44,
    color: theme.colors.foreground,
    minWidth: 60,
    textAlign: 'center',
  },
  metaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  metaLabel: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  metaValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.foreground,
  },
  assigneeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  primaryBtnText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: 16,
  },
});
