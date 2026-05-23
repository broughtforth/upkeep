import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
  formatLastChecked,
  getInventoryStatus,
} from '../lib/data';

type Props = {
  roomId: string;
  roomName: string;
  items: InventoryItem[];
  unassignedGlobal: InventoryItem[];
  onAdjust: (itemId: string, delta: number) => void;
  // Either link an existing global item to this room, or create a new one
  // already linked. Both callbacks mutate the parent's items list.
  onLinkExisting: (itemId: string) => void;
  onCreateNew: (input: {
    name: string;
    category: InventoryCategory;
    quantity: number;
  }) => void;
};

const STATUS_DOT: Record<InventoryStatus, string> = {
  'in-stock': '#05B046',
  'low-stock': '#F2A93B',
  'out-of-stock': theme.colors.danger,
};

const STATUS_LABEL: Record<InventoryStatus, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low',
  'out-of-stock': 'Out',
};

export function InventoryStep({
  roomName,
  items,
  unassignedGlobal,
  onAdjust,
  onLinkExisting,
  onCreateNew,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <View style={styles.stepPill}>
          <Text style={styles.stepText}>Final step</Text>
        </View>
        <Text style={styles.title}>Check inventory</Text>
        <Text style={styles.subtitle}>
          Update stock for {roomName} before finishing. Tap + or − on any item.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <ItemRow item={item} onAdjust={(d) => onAdjust(item.id, d)} />
        )}
        ListFooterComponent={
          <Pressable
            onPress={() => setShowAdd(true)}
            style={({ pressed }) => [
              styles.addRow,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add item to this room"
          >
            <Feather name="plus" size={18} color={theme.colors.primary} />
            <Text style={styles.addRowText}>Add item to this room</Text>
          </Pressable>
        }
      />

      <AddToRoomModal
        visible={showAdd}
        unassignedGlobal={unassignedGlobal}
        onClose={() => setShowAdd(false)}
        onLinkExisting={(id) => {
          onLinkExisting(id);
          setShowAdd(false);
          Haptics.selectionAsync().catch(() => undefined);
        }}
        onCreateNew={(input) => {
          onCreateNew(input);
          setShowAdd(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
        }}
      />
    </View>
  );
}

// ---------------- Inline item row ----------------

function ItemRow({
  item,
  onAdjust,
}: {
  item: InventoryItem;
  onAdjust: (delta: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardImage}>
        <MaterialCommunityIcons
          name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={32}
          color={theme.colors.primary}
        />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[item.status] }]} />
          <Text style={styles.metaText}>{STATUS_LABEL[item.status]}</Text>
          <Feather name="clock" size={11} color={theme.colors.muted} />
          <Text style={styles.metaText}>{formatLastChecked(item.lastChecked)}</Text>
        </View>
      </View>

      <View style={styles.qtyCol}>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <View style={styles.qtyButtons}>
          <Pressable
            hitSlop={8}
            onPress={() => onAdjust(-1)}
            style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel={`Decrease ${item.name}`}
          >
            <Feather name="minus" size={14} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => onAdjust(1)}
            style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel={`Increase ${item.name}`}
          >
            <Feather name="plus" size={14} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------- Add to room modal ----------------

function AddToRoomModal({
  visible,
  unassignedGlobal,
  onClose,
  onLinkExisting,
  onCreateNew,
}: {
  visible: boolean;
  unassignedGlobal: InventoryItem[];
  onClose: () => void;
  onLinkExisting: (id: string) => void;
  onCreateNew: (input: {
    name: string;
    category: InventoryCategory;
    quantity: number;
  }) => void;
}) {
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('supplies');
  const [quantity, setQuantity] = useState('1');

  const reset = () => {
    setMode('pick');
    setName('');
    setCategory('supplies');
    setQuantity('1');
  };

  const submitCreate = () => {
    if (!name.trim()) return;
    const q = parseInt(quantity, 10);
    onCreateNew({
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
          <Text style={styles.modalTitle}>Add to this room</Text>

          <View style={styles.modeRow}>
            <ModeBtn
              label="Existing item"
              active={mode === 'pick'}
              onPress={() => setMode('pick')}
            />
            <ModeBtn
              label="New item"
              active={mode === 'create'}
              onPress={() => setMode('create')}
            />
          </View>

          {mode === 'pick' ? (
            unassignedGlobal.length === 0 ? (
              <Text style={styles.emptyHint}>
                No unassigned items in inventory. Switch to "New item" to create one.
              </Text>
            ) : (
              <FlatList
                data={unassignedGlobal}
                keyExtractor={(i) => i.id}
                style={{ maxHeight: 280 }}
                ItemSeparatorComponent={() => <View style={styles.pickDivider} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => onLinkExisting(item.id)}
                    style={({ pressed }) => [
                      styles.pickRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                      size={22}
                      color={theme.colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{item.name}</Text>
                      <Text style={styles.pickMeta}>
                        Qty {item.quantity} · {STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                  </Pressable>
                )}
              />
            )
          ) : (
            <>
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
                onPress={submitCreate}
                disabled={!name.trim()}
                style={({ pressed }) => [
                  styles.modalCta,
                  !name.trim() && { opacity: 0.4 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.modalCtaText}>Add to room</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModeBtn({
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
        styles.modeBtn,
        active && styles.modeBtnActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  wrap: { flex: 1 },

  headerCard: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
  },
  stepText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  title: {
    ...theme.typography.title,
    fontSize: 28,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },

  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.foreground,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cardImage: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardName: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
    minWidth: 52,
  },
  qtyValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
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

  addRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.background,
  },
  addRowText: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.primary,
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
  modeRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.pill,
    padding: 4,
    gap: 2,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  modeBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.muted,
  },
  modeBtnTextActive: {
    color: theme.colors.foreground,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pickDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  pickName: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  pickMeta: {
    ...theme.typography.caption,
    marginTop: 2,
  },
  emptyHint: {
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
