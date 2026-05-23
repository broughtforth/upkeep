import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
  LaundryItem,
  formatLastChecked,
  getAssignee,
  isWashDue,
  laundryBestMove,
  laundryProgress,
  nextLaundryStatus,
} from '../lib/data';
import {
  getAssignments,
  getCurrentUserId,
  getLaundry,
  saveLaundry,
} from '../lib/storage';

type Props = NativeStackScreenProps<LaundryStackParamList, 'LaundryList'>;
type View_ = 'compact' | 'detailed';


export function LaundryListScreen({ navigation }: Props) {
  const [items, setItems] = useState<LaundryItem[]>([]);
  const [view, setView] = useState<View_>('compact');
  const [assignments, setAssignments] = useState<Assignments>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [lin, a, cu] = await Promise.all([
          getLaundry(),
          getAssignments(),
          getCurrentUserId(),
        ]);
        if (cancelled) return;
        setItems(lin);
        setAssignments(a);
        setCurrentUserId(cu);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visible = useMemo(() => {
    if (!currentUserId) return [];
    return items.filter(
      (i) => getAssignee(assignments, 'laundry', i.id) === currentUserId,
    );
  }, [items, currentUserId, assignments]);

  const cycleStatus = (id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const status = nextLaundryStatus(item.status);
        const lastWashed =
          status === 'clean-storage' ? Date.now() : item.lastWashed;
        return { ...item, status, lastWashed };
      });
      saveLaundry(next);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Laundry</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.viewToggle}>
          <ToggleBtn
            label="Compact"
            active={view === 'compact'}
            onPress={() => setView('compact')}
          />
          <ToggleBtn
            label="Detailed"
            active={view === 'detailed'}
            onPress={() => setView('detailed')}
          />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing assigned to you</Text>
            <Text style={styles.emptyBody}>
              When an admin assigns you laundry, it’ll show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            item={item}
            view={view}
            onPress={() =>
              navigation.navigate('LaundryDetail', { itemId: item.id })
            }
            onAdvance={() => cycleStatus(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ---------------- Card ----------------

function Card({
  item,
  view,
  onPress,
  onAdvance,
}: {
  item: LaundryItem;
  view: View_;
  onPress: () => void;
  onAdvance: () => void;
}) {
  const progress = laundryProgress(item.status);
  const percent = Math.round(progress * 100);
  const due = isWashDue(item);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.iconWell}>
          <MaterialCommunityIcons
            name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.statusRight}>
          <Feather
            name={due ? 'alert-circle' : 'activity'}
            size={14}
            color={due ? theme.colors.danger : theme.colors.primary}
          />
          <Text
            style={[
              styles.statusRightText,
              due && { color: theme.colors.danger },
            ]}
          >
            {due ? 'due for wash' : LAUNDRY_STATUS_LABEL[item.status].toLowerCase()}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.cardBottomRow}>
        <View style={styles.metaCol}>
          <MetaRow
            icon="calendar"
            label="Last wash"
            value={formatLastChecked(item.lastWashed)}
          />
          <MetaRow
            icon="zap"
            label="Best move"
            value={laundryBestMove(item.status)}
          />
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>

      {view === 'detailed' && (
        <View style={styles.detailedExtras}>
          <View style={styles.divider} />
          <View style={styles.actionsRow}>
            <Chip label={item.location} icon="map-pin" />
            <Chip label={`${item.quantity} pieces`} icon="hash" />
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onAdvance();
              }}
              style={({ pressed }) => [
                styles.advanceBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityLabel={`Advance ${item.name} status`}
            >
              <Text style={styles.advanceBtnText}>
                {item.status === 'clean-storage' ? 'Reset' : 'Advance'}
              </Text>
              <Feather name="arrow-right" size={14} color={theme.colors.surface} />
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={13} color={theme.colors.primary} />
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Chip({
  label,
  icon,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}) {
  return (
    <View style={styles.chip}>
      <Feather name={icon} size={11} color={theme.colors.primary} />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ToggleBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleBtn,
        active && styles.toggleBtnActive,
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------- Styles ----------------

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

  toolbar: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  mineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.secondary,
  },
  mineChipActive: {
    backgroundColor: theme.colors.foreground,
  },
  mineChipText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.foreground,
  },
  mineChipTextActive: {
    color: theme.colors.surface,
  },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.pill,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  toggleBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.muted,
  },
  toggleBtnTextActive: {
    color: theme.colors.foreground,
  },

  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 3,
    borderColor: theme.colors.foreground,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.primary,
    letterSpacing: -0.3,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusRightText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 0.1,
  },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.secondary,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },

  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  metaCol: { flex: 1, gap: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.muted,
  },
  metaValue: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.foreground,
    flexShrink: 1,
  },
  percent: {
    fontFamily: theme.fonts.bold,
    fontSize: 36,
    color: theme.colors.primary,
    letterSpacing: -1,
  },

  detailedExtras: {
    gap: theme.spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: theme.colors.line,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.primaryContainer,
  },
  chipText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.primary,
    marginLeft: 'auto',
  },
  advanceBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.surface,
    letterSpacing: 0.2,
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
});
