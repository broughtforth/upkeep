import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TaskDetail } from '../lib/data';
import { theme } from '../theme';

type Props = {
  task: TaskDetail;
  index: number;
  total: number;
};

export function TaskCard({ task, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  const hasDetails = !!task.details;

  const toggle = () => {
    if (!hasDetails) return;
    const next = !open;
    setOpen(next);
    rotation.value = withTiming(next ? 180 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, theme.shadows.md]}>
        <View style={styles.topRow}>
          <View style={styles.stepPill}>
            <Text style={styles.stepText}>Step {index + 1}/{total}</Text>
          </View>
          {hasDetails && (
            <Pressable
              hitSlop={12}
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Hide detailed tips' : 'Show detailed tips'}
            >
              <Animated.View style={chevronStyle}>
                <Feather name="chevron-down" size={22} color={theme.colors.foregroundSoft} />
              </Animated.View>
            </Pressable>
          )}
        </View>

        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.instruction}>{task.instruction}</Text>

        {hasDetails && open && (
          <View style={styles.detailsBody}>
            <Text style={styles.detailsText}>{task.details}</Text>
            {task.videoUrl && (
              <Pressable
                style={styles.videoBtn}
                onPress={() => task.videoUrl && Linking.openURL(task.videoUrl)}
              >
                <Feather name="play-circle" size={16} color={theme.colors.primary} />
                <Text style={styles.videoBtnText}>Watch Video</Text>
              </Pressable>
            )}
          </View>
        )}

        {hasDetails && !open && (
          <Pressable style={styles.hintRow} onPress={toggle}>
            <Text style={styles.hintText}>Tap for detailed tips</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepPill: {
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
  },
  stepText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    ...theme.typography.title,
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.foreground,
    marginTop: theme.spacing.sm,
  },
  instruction: {
    ...theme.typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: theme.colors.foregroundSoft,
  },
  hintRow: {
    marginTop: theme.spacing.sm,
  },
  hintText: {
    ...theme.typography.body,
    color: theme.colors.mutedSoft,
    fontWeight: '500',
  },
  detailsBody: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
    gap: theme.spacing.sm,
  },
  detailsText: {
    ...theme.typography.body,
    color: theme.colors.foregroundSoft,
  },
  videoBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  videoBtnText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
