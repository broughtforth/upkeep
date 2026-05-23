import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Room } from '../lib/data';
import { theme } from '../theme';
import { RoomIcon } from './RoomIcon';
import { formatDuration } from '../lib/data';

type Props = {
  room: Room;
  completed: boolean;
  lastCleanedLabel?: string | null;
  onPress: () => void;
};

export function RoomCard({ room, completed, lastCleanedLabel, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        theme.shadows.md,
        pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Start cleaning ${room.name}`}
    >
      <View style={styles.iconWell}>
        <RoomIcon type={room.type} size={30} color={theme.colors.primary} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {room.name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.pill}>
            <Feather name="clock" size={12} color={theme.colors.muted} />
            <Text style={styles.pillText}>{formatDuration(room.estimatedMinutes)}</Text>
          </View>
          {completed ? (
            <View style={[styles.pill, styles.pillSuccess]}>
              <Feather name="check" size={12} color={theme.colors.primary} />
              <Text style={[styles.pillText, { color: theme.colors.primary }]}>
                {lastCleanedLabel ? `Cleaned ${lastCleanedLabel}` : 'Cleaned'}
              </Text>
            </View>
          ) : (
            <View style={styles.pill}>
              <Feather name="circle" size={10} color={theme.colors.muted} />
              <Text style={styles.pillText}>Not cleaned</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cta}>
        <Text style={styles.ctaText}>Start</Text>
        <Feather name="arrow-right" size={16} color={theme.colors.background} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    minHeight: 90,
    gap: theme.spacing.md,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  name: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs * 2,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.pill,
  },
  pillSuccess: { backgroundColor: theme.colors.primaryContainer },
  pillText: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.pill,
  },
  ctaText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
