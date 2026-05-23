import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { User, userInitials } from '../lib/data';
import { theme } from '../theme';

type Props = {
  user?: User;
  size?: number;
  // Show a subtle dashed circle when no user is provided.
  emptyVariant?: 'dashed' | 'plus' | 'hidden';
  style?: ViewStyle;
};

export function Avatar({ user, size = 28, emptyVariant = 'dashed', style }: Props) {
  if (!user) {
    if (emptyVariant === 'hidden') return null;
    return (
      <View
        style={[
          styles.empty,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderStyle: emptyVariant === 'dashed' ? 'dashed' : 'solid',
          },
          style,
        ]}
      >
        {emptyVariant === 'plus' && (
          <Feather name="plus" size={size * 0.45} color={theme.colors.muted} />
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.filled,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: user.color,
        },
        style,
      ]}
      accessibilityLabel={`Assigned to ${user.name}`}
    >
      <Text style={[styles.initials, { fontSize: size * 0.42 }]}>
        {userInitials(user.name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filled: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  initials: {
    fontFamily: theme.fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
