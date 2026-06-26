import { AppCard, Paragraph, YStack } from '@calendar/ui';
import type { SyncScheduleRecord } from '../../lib/schedules/types';
import { ScheduleItem } from './ScheduleItem';

interface ScheduleListProps {
  schedules: SyncScheduleRecord[];
  isBusy: boolean;
  emptyMessage?: string;
  onEdit: (schedule: SyncScheduleRecord) => void;
  onDelete: (schedule: SyncScheduleRecord) => Promise<void>;
}

export function ScheduleList({ schedules, isBusy, emptyMessage, onEdit, onDelete }: ScheduleListProps) {
  if (!schedules.length) {
    return (
      <AppCard>
        <Paragraph color="$muted" margin={0}>
          {emptyMessage ?? 'No hay horarios para mostrar.'}
        </Paragraph>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      {schedules.map((schedule) => (
        <ScheduleItem key={schedule.id} schedule={schedule} isBusy={isBusy} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </YStack>
  );
}
