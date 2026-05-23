import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import { User } from '../lib/data';
import { getUsers, setCurrentUserId } from '../lib/storage';
import { Avatar } from '../components/Avatar';

type Props = {
  onPicked: () => void;
};

// First-launch identity picker. The app is gated on having a current user, so
// the user can't dismiss this without making a choice.
export function OnboardingScreen({ onPicked }: Props) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getUsers();
      if (!cancelled) setUsers(u);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    await setCurrentUserId(id);
    onPicked();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.brand}>Upkeep</Text>
        <Text style={styles.title}>Who are you?</Text>
        <Text style={styles.subtitle}>
          Pick yourself to see what's assigned to you. You can change this any
          time in the Team tab.
        </Text>

        <View style={styles.list}>
          {users.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => pick(u.id)}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Sign in as ${u.name}`}
            >
              <Avatar user={u} size={44} />
              <Text style={styles.rowName}>{u.name}</Text>
              <Feather name="chevron-right" size={20} color={theme.colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  brand: {
    ...theme.typography.display,
    color: theme.colors.primary,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xl,
  },
  list: {
    gap: theme.spacing.md,
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
  rowName: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.foreground,
  },
});
