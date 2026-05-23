import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
  formatLastChecked,
  getAssignee,
  getInventoryStatus,
  isOnShoppingList,
} from '../lib/data';
import {
  getAssignments,
  getCurrentUserId,
  getInventory,
  saveInventory,
} from '../lib/storage';

type Props = NativeStackScreenProps<InventoryStackParamList, 'InventoryList'>;
type Tab = 'stock' | 'shopping';

const STATUS_DOT: Record<InventoryStatus, string> = {
  'in-stock': '#05B046',
  'low-stock': '#F2A93B',
  'out-of-stock': theme.colors.danger,
};

const STATUS_LABEL: Record<InventoryStatus, string> = {
  'in-stock': 'Good',
  'low-stock': 'Low',
  'out-of-stock': 'Out',
};

export function InventoryListScreen({ navigation }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [tab, setTab] = useState<Tab>('stock');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InventoryCategory | 'all'>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Visual-only checklist state for the Shopping List tab. Intentionally
  // lives in-memory: resets when the tab unmounts.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleChecked = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [inv, a, cu] = await Promise.all([
          getInventory(),
          getAssignments(),
          getCurrentUserId(),
        ]);
        if (cancelled) return;
        setItems(inv);
        setAssignments(a);
        setCurrentUserId(cu);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const adjust = (id: string, delta: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
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

  const addItem = (input: { name: string; category: InventoryCategory; quantity: number }) => {
    const item: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: input.name.trim(),
      icon: 'package-variant',
      quantity: input.quantity,
      status: getInventoryStatus(input.quantity),
      category: input.category,
      lastChecked: Date.now(),
    };
    setItems((prev) => {
      const next = [item, ...prev];
      saveInventory(next);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  };

  // Only items assigned to me. When current user isn't set yet (shouldn't
  // happen post-onboarding, but defensive), show nothing.
  const mine = useMemo(() => {
    if (!currentUserId) return [];
    return items.filter(
      (i) => getAssignee(assignments, 'inventory', i.id) === currentUserId,
    );
  }, [items, currentUserId, assignments]);

  const visible = useMemo(() => {
    const tabFiltered = tab === 'stock' ? mine : mine.filter(isOnShoppingList);
    const catFiltered =
      filter === 'all'
        ? tabFiltered
        : tabFiltered.filter((i) => i.category === filter);
    const q = search.trim().toLowerCase();
    return q
      ? catFiltered.filter((i) => i.name.toLowerCase().includes(q))
      : catFiltered;
  }, [mine, tab, filter, search]);

  const stockCount = mine.length;
  const shoppingCount = mine.filter(isOnShoppingList).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.headerActions}>
          {filter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {INVENTORY_CATEGORIES.find((c) => c.id === filter)?.label}
              </Text>
              <Pressable hitSlop={6} onPress={() => setFilter('all')}>
                <Feather name="x" size={14} color={theme.colors.foreground} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <View style={styles.tabRow}>
        <TabButton
          label="In stock"
          count={stockCount}
          active={tab === 'stock'}
          onPress={() => setTab('stock')}
        />
        <TabButton
          label="Shopping list"
          count={shoppingCount}
          active={tab === 'shopping'}
          onPress={() => setTab('shopping')}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={
          tab === 'shopping' ? styles.checklistContent : styles.listContent
        }
        ItemSeparatorComponent={
          tab === 'shopping'
            ? () => <View style={styles.checklistDivider} />
            : () => <View style={{ height: theme.spacing.sm }} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'shopping'
                ? 'Nothing to buy'
                : mine.length === 0
                ? 'Nothing assigned to you'
                : 'No items'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'shopping'
                ? 'Items will appear here automatically when they run low.'
                : mine.length === 0
                ? 'When an admin assigns you inventory, it’ll show up here.'
                : 'Try adjusting filters or search.'}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          tab === 'shopping' ? (
            <ChecklistRow
              item={item}
              checked={checkedIds.has(item.id)}
              onToggle={() => toggleChecked(item.id)}
            />
          ) : (
            <ItemCard
              item={item}
              onPress={() =>
                navigation.navigate('InventoryDetail', { itemId: item.id })
              }
              onPlus={() => adjust(item.id, 1)}
              onMinus={() => adjust(item.id, -1)}
            />
          )
        }
      />

      <ActionPill
        onFilter={() => setShowFilter(true)}
        onSearch={() => setShowSearch(true)}
        onAdd={() => setShowAdd(true)}
      />

      <SearchModal
        visible={showSearch}
        value={search}
        onChange={setSearch}
        onClose={() => setShowSearch(false)}
      />
      <FilterModal
        visible={showFilter}
        current={filter}
        onPick={(next) => {
          setFilter(next);
          setShowFilter(false);
        }}
        onClose={() => setShowFilter(false)}
      />
      <AddModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(input) => {
          addItem(input);
          setShowAdd(false);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------- Item card ----------------

function ItemCard({
  item,
  onPress,
  onPlus,
  onMinus,
}: {
  item: InventoryItem;
  onPress: () => void;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
    >
      <View style={styles.cardImage}>
        <MaterialCommunityIcons
          name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={40}
          color={theme.colors.primary}
        />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[item.status] }]} />
            <Text style={styles.metaText}>{STATUS_LABEL[item.status]}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="package" size={11} color={theme.colors.muted} />
            <Text style={styles.metaText}>{prettyCategory(item.category)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={theme.colors.muted} />
            <Text style={styles.metaText}>{formatLastChecked(item.lastChecked)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.qtyCol}>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <View style={styles.qtyButtons}>
          <Pressable
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation();
              onMinus();
            }}
            style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel={`Decrease ${item.name}`}
          >
            <Feather name="minus" size={14} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation();
              onPlus();
            }}
            style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel={`Increase ${item.name}`}
          >
            <Feather name="plus" size={14} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: InventoryItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.checklistRow, pressed && { opacity: 0.7 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={item.name}
    >
      <Text
        style={[styles.checklistName, checked && styles.checklistNameChecked]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <View
        style={[
          styles.checklistCircle,
          checked && styles.checklistCircleChecked,
        ]}
      >
        {checked && (
          <Feather name="check" size={14} color={theme.colors.surface} />
        )}
      </View>
    </Pressable>
  );
}

// ---------------- Tabs + action pill ----------------

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <View style={styles.tabBtn}>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
        <View
          style={[
            styles.tabCount,
            active && { backgroundColor: theme.colors.foreground },
          ]}
        >
          <Text
            style={[
              styles.tabCountText,
              active && { color: theme.colors.surface },
            ]}
          >
            {count}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ActionPill({
  onFilter,
  onSearch,
  onAdd,
}: {
  onFilter: () => void;
  onSearch: () => void;
  onAdd: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.pillWrap}>
      <View style={styles.pill}>
        <PillBtn icon="filter" onPress={onFilter} label="Filter" />
        <View style={styles.pillDivider} />
        <PillBtn icon="search" onPress={onSearch} label="Search" />
      </View>
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addBtn,
          theme.shadows.md,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel="Add item"
      >
        <Feather name="plus" size={22} color={theme.colors.surface} />
      </Pressable>
    </View>
  );
}

function PillBtn({
  icon,
  onPress,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pillBtn, pressed && { opacity: 0.6 }]}
      accessibilityLabel={label}
    >
      <Feather name={icon} size={20} color={theme.colors.surface} />
    </Pressable>
  );
}

// ---------------- Modals ----------------

function SearchModal({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Search</Text>
          <View style={styles.searchRow}>
            <Feather name="search" size={18} color={theme.colors.muted} />
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="Item name…"
              placeholderTextColor={theme.colors.muted}
              autoFocus
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={onClose}
            />
            {value.length > 0 && (
              <Pressable onPress={() => onChange('')} hitSlop={8}>
                <Feather name="x" size={18} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalCta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.modalCtaText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterModal({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: InventoryCategory | 'all';
  onPick: (c: InventoryCategory | 'all') => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Filter by category</Text>
          <FilterRow
            label="All categories"
            active={current === 'all'}
            onPress={() => onPick('all')}
          />
          {INVENTORY_CATEGORIES.map((c) => (
            <FilterRow
              key={c.id}
              label={c.label}
              active={current === c.id}
              onPress={() => onPick(c.id)}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterRow({
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
      style={({ pressed }) => [styles.filterRow, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.filterRowLabel}>{label}</Text>
      {active && <Feather name="check" size={18} color={theme.colors.primary} />}
    </Pressable>
  );
}

function AddModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; category: InventoryCategory; quantity: number }) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('supplies');
  const [quantity, setQuantity] = useState('1');

  const reset = () => {
    setName('');
    setCategory('supplies');
    setQuantity('1');
  };

  const submit = () => {
    if (!name.trim()) return;
    const q = parseInt(quantity, 10);
    onSubmit({
      name,
      category,
      quantity: Number.isFinite(q) && q >= 0 ? q : 0,
    });
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => {
          reset();
          onClose();
        }}
      >
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Add item</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Toilet roll"
            placeholderTextColor={theme.colors.muted}
            style={styles.field}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.catRow}>
            {INVENTORY_CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={({ pressed }) => [
                    styles.catChip,
                    active && {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      active && { color: theme.colors.surface },
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Quantity</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            style={styles.field}
          />

          <Pressable
            onPress={submit}
            disabled={!name.trim()}
            style={({ pressed }) => [
              styles.modalCta,
              !name.trim() && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.modalCtaText}>Add</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------- Helpers ----------------

function prettyCategory(c: InventoryCategory): string {
  switch (c) {
    case 'cleaning-products':
      return 'Cleaning';
    case 'linens':
      return 'Linens';
    case 'amenities':
      return 'Amenities';
    case 'supplies':
      return 'Supplies';
  }
}

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  headerWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.typography.display,
    fontSize: 44,
    color: theme.colors.foreground,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.lg,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: theme.colors.muted,
  },
  tabLabelActive: {
    color: theme.colors.foreground,
  },
  tabCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.muted,
  },

  mineRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    flexDirection: 'row',
  },
  mineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
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

  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 140, // breathing room for floating pill
  },
  checklistContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 140,
  },
  checklistDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  checklistName: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 17,
    color: theme.colors.foreground,
  },
  checklistNameChecked: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  checklistCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  checklistCircleChecked: {
    backgroundColor: theme.colors.foreground,
    borderColor: theme.colors.foreground,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 3,
    borderColor: theme.colors.foreground,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 6 },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardName: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.primary,
    letterSpacing: -0.2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.muted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  qtyCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 56,
  },
  qtyValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.primary,
  },
  qtyButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    paddingTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
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
  },

  // Floating action pill
  pillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: 6,
    height: 52,
    ...theme.shadows.md,
  },
  pillBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: theme.colors.primaryContainer,
    opacity: 0.4,
    marginHorizontal: 2,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    color: theme.colors.foreground,
    paddingVertical: 0,
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  filterRowLabel: {
    ...theme.typography.body,
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
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  catChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  catChipText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.foreground,
  },
});
