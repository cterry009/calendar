import { useMemo, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { TaskForm } from '../tasks/TaskForm';
import { useLanguage } from '../../context/LanguageContext';
import { usePanel } from '../../context/PanelContext';
import { useTasks } from '../../hooks/useTasks';
import { isSameDay } from '../../lib/calendar/utils';
import type { SyncTaskRecord } from '../../lib/tasks/types';

interface DayTasksSidebarProps {
  selectedDate: Date;
}

interface CompactTaskRowProps {
  task: SyncTaskRecord;
  isBusy: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onStartPomodoro: () => void;
}

function CompactTaskRow({ task, isBusy, onComplete, onEdit, onStartPomodoro }: CompactTaskRowProps) {
  const isCompleted = task.status === 'COMPLETED';
  const pomodoros = task.estimatedPomodoros ?? 1;

  return (
    <XStack alignItems="center" gap="$2" paddingVertical="$2">
      <YStack
        width={20}
        height={20}
        borderRadius={999}
        borderWidth={1.5}
        borderColor={isCompleted ? '$success' : '$borderColor'}
        backgroundColor={isCompleted ? '$success' : 'transparent'}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        onPress={isCompleted || isBusy ? undefined : onComplete}
        flexShrink={0}
      >
        {isCompleted ? (
          <Text fontSize={12} color="#0a1c13">
            ✓
          </Text>
        ) : null}
      </YStack>

      <Text
        flex={1}
        fontSize="$3"
        textDecorationLine={isCompleted ? 'line-through' : 'none'}
        color={isCompleted ? '$muted' : '$color'}
        cursor="pointer"
        onPress={onEdit}
      >
        {task.title}
      </Text>

      <Text fontSize="$1" color="$muted" flexShrink={0}>
        {pomodoros}p
      </Text>

      {!isCompleted ? (
        <AppButton variant="ghost" paddingHorizontal="$2" disabled={isBusy} onPress={onStartPomodoro}>
          ▶
        </AppButton>
      ) : null}
    </XStack>
  );
}

/**
 * Compact, filtered-to-one-day task view for the calendar hub's sidebar -- the full-featured
 * TaskManager (filters, detailed cards) was moved out per user feedback that the main page was
 * too dense; this is intentionally minimal, not a replacement for it. Creation still happens via
 * the global quick-add ("Q" / the + button), not here.
 */
export function DayTasksSidebar({ selectedDate }: DayTasksSidebarProps) {
  const { locale } = useLanguage();
  const { openPanel } = usePanel();
  const { tasks, isLoading, isMutating, error, updateTask, completeTask } = useTasks();
  const [editingTask, setEditingTask] = useState<SyncTaskRecord | null>(null);

  const dayTasks = useMemo(
    () => tasks.filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), selectedDate)),
    [tasks, selectedDate],
  );

  const dayLabel = useMemo(() => {
    const today = new Date();
    if (isSameDay(selectedDate, today)) {
      return 'Hoy';
    }
    return selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  }, [selectedDate, locale]);

  async function handleUpdate(values: Parameters<typeof updateTask>[1]) {
    if (!editingTask) return;
    await updateTask(editingTask.id, values);
    setEditingTask(null);
  }

  return (
    <AppCard data-tutorial="tasks-header">
      <YStack gap="$3">
        <H2 margin={0} fontSize="$5" textTransform="capitalize">
          Tareas - {dayLabel}
        </H2>

        {error ? (
          <Paragraph color="$error" margin={0} size="$2">
            {error}
          </Paragraph>
        ) : null}

        {editingTask ? (
          <TaskForm
            mode="edit"
            initialTask={editingTask}
            isSubmitting={isMutating}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTask(null)}
          />
        ) : null}

        {isLoading ? (
          <Paragraph margin={0} size="$2" color="$muted">
            Cargando...
          </Paragraph>
        ) : dayTasks.length === 0 ? (
          <Paragraph margin={0} size="$2" color="$muted">
            No hay tareas para este dia. Presiona "Q" para agregar una.
          </Paragraph>
        ) : (
          <YStack>
            {dayTasks.map((task) => (
              <CompactTaskRow
                key={task.id}
                task={task}
                isBusy={isMutating}
                onComplete={() => void completeTask(task, task.estimatedMinutes)}
                onEdit={() => setEditingTask(task)}
                onStartPomodoro={() => openPanel('pomodoro', { taskId: task.id })}
              />
            ))}
          </YStack>
        )}
      </YStack>
    </AppCard>
  );
}
