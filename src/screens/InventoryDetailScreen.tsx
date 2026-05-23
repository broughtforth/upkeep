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
import { InventoryStackParamList } from '../navigation';
import {
  Assignments,
  InventoryItem,
  InventoryStatus,
  User,
  assignmentKey,
  formatLastChecked,
  getAssignee,
  getInventoryStatus,
} from '../lib/data';
import {
  getAssignments,
  getInventory,
  getUsers,
  saveInventory,
  setAssignment,
} from '../lib/storage';
import { Avatar } from '../components/Avatar';
import { AssigneePicker } from '../components/AssigneePicker';

type Props = NativeStackScreenProps<InventoryStackParamList, 'InventoryDetail'>;

const STATUS_COLOR: Record<InventoryStatus, string> = {
  'in-stock': '#05B046',
  'low-stock': '#FF9800',
  'out-of-stock': theme.colors.danger,
};

const STATUS_LABEL: Record<InventoryStatus, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
};

export function InventoryDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [showPicker, setShowPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [inv, u, a] = await Promise.all([
          getInventory(),
          getUsers(),
          getAssignments(),
        ]);
        if (cancelled) return;
        setItem(inv.find((i) => i.id === itemId) ?? null);
        setUsers(u);
        setAssignments(a);
      })();
      return () => {
        cancelled = true;
      };
    }, [itemId]),
  );

  const assigneeId = getAssignee(assignments, 'inventory', itemId);
  const assignee = assigneeId ? users.find((u) => u.id === assigneeId) : undefined;

  const onPickAssignee = async (userId: string | null) => {
    const next = await setAssignment(assignmentKey('inventory', itemId), userId);
    setAssignments(next);
    setShowPicker(false);
  };

  const persist = async (next: InventoryItem) => {
    setItem(next);
    const inv = await getInventory();
    await saveInventory(inv.map((i) => (i.id === next.id ? next : i)));
  };

  const adjust = (delta: number) => {
    if (!item) return;
    Haptics.selectionAsync().catch(() => undefined);
    const quantity = Math.max(0, item.quantity + delta);
    persist({
      ...item,
      quantity,
      status: getInventoryStatus(quantity),
      lastChecked: Date.now(),
    });
  };

  const markChecked = () => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    persist({ ...item, lastChecked: Date.now() });
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

        <View
          style={[
            styles.statusBanner,
            { backgroundColor: STATUS_COLOR[item.status] + '22' },
          ]}
        >
          <Text style={[styles.statusBannerText, { color: STATUS_COLOR[item.status] }]}>
            {STATUS_LABEL[item.status]}
          </Text>
        </View>

        <View style={styles.qtyCard}>
          <Text style={styles.qtyLabel}>Quantity</Text>
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
          <MetaRow label="Category" value={prettyCategory(item.category)} />
          <Divider />
          <MetaRow label="Last checked" value={formatLastChecked(item.lastChecked)} />
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

        <Pressable
          onPress={markChecked}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="check" size={18} color={theme.colors.primary} />
          <Text style={styles.primaryBtnText}>Mark checked now</Text>
        </Pressable>
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
      <Pressable
        style={styles.headerBtn}
        onPress={onBack}
        accessibilityLabel="Back"
      >
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

function prettyCategory(c: InventoryItem['category']): string {
  switch (c) {
    case 'cleaning-products':
      return 'Cleaning products';
    case 'linens':
      return 'Linens';
    case 'amenities':
      return 'Amenities';
    case 'supplies':
      return 'Supplies';
  }
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
    alignItems: 'stretch',
  },
  iconWell: {
    alignSelf: 'center',
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
  },
  statusBannerText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  qtyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  qtyLabel: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
