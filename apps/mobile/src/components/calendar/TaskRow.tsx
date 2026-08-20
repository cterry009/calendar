import { Text, XStack, YStack } from '@calendar/ui';
import type { SyncTaskRecord } from '../../lib/calendar/types';

interface TaskRowProps {
  task: SyncTaskRecord;
  isBusy: boolean;
  onComplete: () => void;
}

export function TaskRow({ task, isBusy, onComplete }: TaskRowProps) {
  const isCompleted = task.status === 'COMPLETED';
  const pomodoros = task.estimatedPomodoros ?? 1;

  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack
        width={22}
        height={22}
        borderRadius={999}
        borderWidth={1.5}
        borderColor={isCompleted ? '$success' : '$borderColor'}
        backgroundColor={isCompleted ? '$success' : 'transparent'}
        alignItems="center"
        justifyContent="center"
        onPress={isCompleted || isBusy ? undefined : onComplete}
        flexShrink={0}
      >
        {isCompleted ? (
          <Text fontSize={13} color="#0a1c13">
            {'✓'}
          </Text>
        ) : null}
      </YStack>

      <Text
        flex={1}
        fontSize="$3"
        textDecorationLine={isCompleted ? 'line-through' : 'none'}
        color={isCompleted ? '$muted' : '$color'}
      >
        {task.title}
      </Text>

      <Text fontSize="$1" color="$muted" flexShrink={0}>
        {pomodoros}p
      </Text>
    </XStack>
  );
}
