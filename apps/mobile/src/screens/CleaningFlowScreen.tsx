import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { CleaningStackParamList } from '../navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningFlow'>;

// Shape returned by Supabase for the joined select below. Both join sides
// are nullable to be safe — in practice template / room always exist.
type InstanceRow = {
  id: string;
  status: 'pending' | 'queued' | 'assigned' | 'completed';
  subtasks_done: string[];
  completed_at: string | null;
  room: { id: string; name: string } | null;
  template: {
    id: string;
    name: string;
    instructions: string;
    subtasks: string[];
    duration_min: number;
  } | null;
};

// Sage green to match RoomTile's completed state. Keeping the value here so
// the two surfaces stay visually aligned.
const COMPLETE_FG = '#1F8F4E';
const COMPLETE_BG = '#E8F5EC';

export function CleaningFlowScreen({ route, navigation }: Props) {
  const { instanceId } = route.params;
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const fetchInstance = useCallback(async () => {
    const { data, error } = await supabase
      .from('task_instances')
      .select(
        'id, status, subtasks_done, completed_at, room:rooms(id, name), template:task_templates(id, name, instructions, subtasks, duration_min)',
      )
      .eq('id', instanceId)
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setInstance(data as unknown as InstanceRow);
    setError(null);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    void fetchInstance();
  }, [fetchInstance]);

  // Subscribe to changes on this specific row so subtask ticks from another
  // device or the daily-reset cron land here without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`cleaning_instance_${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_instances',
          filter: `id=eq.${instanceId}`,
        },
        () => {
          void fetchInstance();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [instanceId, fetchInstance]);

  const isComplete = instance?.status === 'completed';
  const subtasks = instance?.template?.subtasks ?? [];
  const subtasksDone = instance?.subtasks_done ?? [];
  const doneCount = subtasksDone.length;
  const totalCount = subtasks.length;

  const toggleSubtask = async (label: string) => {
    if (!instance || isComplete) return;
    const isDone = subtasksDone.includes(label);
    const nextDone = isDone
      ? subtasksDone.filter((s) => s !== label)
      : [...subtasksDone, label];
    // Optimistic update.
    setInstance({ ...instance, subtasks_done: nextDone });
    Haptics.selectionAsync().catch(() => undefined);
    const { error } = await supabase
      .from('task_instances')
      .update({ subtasks_done: nextDone })
      .eq('id', instance.id);
    if (error) {
      // Roll back on failure.
      setInstance({ ...instance, subtasks_done: subtasksDone });
      Alert.alert('Could not save', error.message);
    }
  };

  const markRoomComplete = async () => {
    if (!instance) return;
    setFinishing(true);
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from('task_instances')
      .update({
        status: 'completed',
        completed_at: completedAt,
      })
      .eq('id', instance.id);
    if (error) {
      Alert.alert('Could not finish', error.message);
      setFinishing(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    navigation.popToTop();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !instance || !instance.room || !instance.template) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Header onBack={() => navigation.goBack()} title="" />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this room</Text>
          <Text style={styles.errorBody}>
            {error ?? 'The task may have been unassigned. Try going back.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const room = instance.room;
  const template = instance.template;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header onBack={() => navigation.goBack()} title={room.name} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Status pill + duration */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.statusPill,
              isComplete && { backgroundColor: COMPLETE_BG },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isComplete && { color: COMPLETE_FG },
              ]}
            >
              {isComplete
                ? 'Clean'
                : totalCount > 0
                  ? `${doneCount}/${totalCount} done`
                  : 'Ready to start'}
            </Text>
          </View>
          <Text style={styles.duration}>~{template.duration_min} min</Text>
        </View>

        {/* Instructions */}
        {template.instructions ? (
          <View style={styles.instructionBox}>
            <Text style={styles.instructionLabel}>Read first</Text>
            <Text style={styles.instructionBody}>{template.instructions}</Text>
          </View>
        ) : null}

        {/* Checklist */}
        <Text style={styles.sectionLabel}>Checklist</Text>
        <View style={styles.checklist}>
          {subtasks.map((label) => {
            const checked = subtasksDone.includes(label);
            return (
              <Pressable
                key={label}
                onPress={() => toggleSubtask(label)}
                disabled={isComplete}
                style={({ pressed }) => [
                  styles.checkRow,
                  checked && styles.checkRowDone,
                  pressed && !isComplete && { opacity: 0.7 },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={label}
              >
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                  ]}
                >
                  {checked && (
                    <Feather name="check" size={16} color="#fff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    checked && styles.checkLabelDone,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {subtasks.length === 0 && (
            <Text style={styles.emptyChecklist}>
              No checklist for this room.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isComplete ? (
          <View style={[styles.finishBtn, styles.finishBtnDone]}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.finishBtnText}>Room marked clean</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.finishBtn,
              pressed && { opacity: 0.85 },
              finishing && { opacity: 0.6 },
            ]}
            onPress={markRoomComplete}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${room.name} complete`}
          >
            {finishing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.finishBtnText}>Mark room complete</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.headerBtn,
          pressed && { opacity: 0.6 },
        ]}
        accessibilityLabel="Back"
      >
        <Feather name="chevron-left" size={24} color={theme.colors.foreground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorTitle: {
    ...theme.typography.heading,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  errorBody: {
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...theme.typography.heading,
    color: theme.colors.foreground,
    textAlign: 'center',
  },

  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  statusPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.primaryContainer,
  },
  statusText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  duration: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.muted,
  },

  instructionBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: theme.spacing.md,
    gap: 6,
  },
  instructionLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  instructionBody: {
    ...theme.typography.body,
    color: theme.colors.foregroundSoft,
  },

  sectionLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginBottom: -theme.spacing.sm,
  },
  checklist: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    overflow: 'hidden',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  checkRowDone: {
    backgroundColor: '#F5F8F6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: COMPLETE_FG,
    borderColor: COMPLETE_FG,
  },
  checkLabel: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  checkLabelDone: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  emptyChecklist: {
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },

  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.foreground,
  },
  finishBtnDone: {
    backgroundColor: COMPLETE_FG,
  },
  finishBtnText: {
    color: '#fff',
    fontFamily: theme.fonts.bold,
    fontSize: 16,
  },
});
