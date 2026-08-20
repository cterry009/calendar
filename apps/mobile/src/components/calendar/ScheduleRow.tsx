import { Text, XStack, YStack } from '@calendar/ui';
import type { SyncScheduleRecord } from '../../lib/calendar/types';
import { formatDaysOfWeek, minuteToTimeValue } from '../../lib/calendar/utils';

const KIND_LABELS: Record<SyncScheduleRecord['kind'], string> = {
  WORK: 'Trabajo',
  REST: 'Descanso',
};

interface ScheduleRowProps {
  schedule: SyncScheduleRecord;
}

export function ScheduleRow({ schedule }: ScheduleRowProps) {
  const title = schedule.label?.trim() || `${KIND_LABELS[schedule.kind]} recurrente`;

  return (
    <YStack gap="$1" paddingVertical="$2">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize="$3" fontWeight="600">
          {title}
        </Text>
        <Text fontSize="$1" color={schedule.enabled ? '$accent' : '$muted'}>
          {schedule.enabled ? 'Activo' : 'Pausado'}
        </Text>
      </XStack>
      <Text fontSize="$2" color="$muted">
        {formatDaysOfWeek(schedule.daysOfWeek)} · {minuteToTimeValue(schedule.startMinute)} -{' '}
        {minuteToTimeValue(schedule.endMinute)}
      </Text>
    </YStack>
  );
}
