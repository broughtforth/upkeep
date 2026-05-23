import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';

type Props = {
  // 0..1
  progress: number;
};

export function ProgressBar({ progress }: Props) {
  const value = useSharedValue(progress);

  useEffect(() => {
    value.value = withTiming(progress, {
      duration: 350,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, value.value)) * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
});
