import { AppCard, Paragraph, YStack } from '@calendar/ui';
import type { SyncTaskRecord } from '../../lib/tasks/types';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: SyncTaskRecord[];
  isBusy: boolean;
  emptyMessage?: string;
  onEdit: (task: SyncTaskRecord) => void;
  onDelete: (task: SyncTaskRecord) => Promise<void>;
  onComplete: (task: SyncTaskRecord, actualMinutes: number) => Promise<void>;
  onStartPomodoro?: (task: SyncTaskRecord) => void;
}

export function TaskList({
  tasks,
  isBusy,
  emptyMessage,
  onEdit,
  onDelete,
  onComplete,
  onStartPomodoro,
}: TaskListProps) {
  if (!tasks.length) {
    return (
      <AppCard>
        <Paragraph color="$muted" margin={0}>
          {emptyMessage ?? 'No hay tareas para mostrar.'}
        </Paragraph>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          isBusy={isBusy}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
          onStartPomodoro={onStartPomodoro}
        />
      ))}
    </YStack>
  );
}
