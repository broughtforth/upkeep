import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { theme } from '../theme';
import { User } from '../lib/data';
import { Avatar } from './Avatar';

type Props = {
  visible: boolean;
  users: User[];
  currentUserId?: string;
  title?: string;
  onClose: () => void;
  onPick: (userId: string | null) => void;
};

export function AssigneePicker({
  visible,
  users,
  currentUserId,
  title = 'Assign to',
  onClose,
  onPick,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>

          <Row
            label="Unassigned"
            sublabel="Anyone can pick this up"
            selected={!currentUserId}
            onPress={() => onPick(null)}
          />

          {users.map((u) => (
            <Row
              key={u.id}
              user={u}
              label={u.name}
              selected={currentUserId === u.id}
              onPress={() => onPick(u.id)}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  user,
  label,
  sublabel,
  selected,
  onPress,
}: {
  user?: User;
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <Avatar user={user} size={36} emptyVariant="dashed" />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSub}>{sublabel}</Text>}
      </View>
      {selected && <Feather name="check" size={20} color={theme.colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 12, 20, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.foreground,
  },
  rowSub: {
    ...theme.typography.caption,
  },
});
