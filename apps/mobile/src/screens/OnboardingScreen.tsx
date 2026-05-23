import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import { User, USER_COLORS } from '../lib/data';
import { setCurrentUserId } from '../lib/storage';
import { supabase, type Profile } from '../lib/supabase';
import { Avatar } from '../components/Avatar';

type Props = {
  onPicked: () => void;
};

// Map a Supabase profile to the local User shape the Avatar expects.
// Colour is derived from the profile's position in the list since the DB
// doesn't store one.
function profileToUser(profile: Profile, index: number): User {
  return {
    id: profile.id,
    name: profile.full_name,
    color: USER_COLORS[index % USER_COLORS.length],
  };
}

// First-launch identity picker. Loads the residents from Supabase (the same
// three accounts the web app sees) and writes the picked id to AsyncStorage.
export function OnboardingScreen({ onPicked }: Props) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setUsers([]);
        return;
      }
      setUsers((data ?? []).map((p, i) => profileToUser(p as Profile, i)));
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
          Tap your name to see what's assigned to you.
        </Text>

        {users === null && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Couldn't load residents: {error}
            </Text>
          </View>
        )}

        {users !== null && users.length === 0 && !error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              No residents found. Add some in the Supabase profiles table and
              re-open the app.
            </Text>
          </View>
        )}

        <View style={styles.list}>
          {users?.map((u) => (
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
  loading: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.danger ?? '#D9534F',
  },
});
