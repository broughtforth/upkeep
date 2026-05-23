import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Room, User } from '../lib/data';
import { theme } from '../theme';
import { RoomIcon } from './RoomIcon';
import { Avatar } from './Avatar';

type Props = {
  room: Room;
  completed: boolean;
  assignee?: User;
  onPress: () => void;
  onLongPress?: () => void;
};

// Capitalize the first letter of every word, leave the rest as authored.
// Keeps "Walk-in" and intentional acronyms intact.
function titleCase(s: string): string {
  return s.replace(/(^|\s|-)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function RoomTile({ room, completed, assignee, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Start cleaning ${room.name}${assignee ? `, assigned to ${assignee.name}` : ''}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {titleCase(room.name)}
        </Text>
        <Text style={styles.status}>
          {completed ? 'Clean' : `${room.estimatedMinutes}m`}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <RoomIcon type={room.type} size={32} color={theme.colors.primary} />
        <View style={styles.bottomRight}>
          {assignee && <Avatar user={assignee} size={22} />}
          {completed && (
            <View style={styles.checkBadge}>
              <Feather name="check" size={14} color={theme.colors.surface} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 3,
    borderColor: theme.colors.foreground,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.primary,
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  status: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
