import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { DAY_NAMES_ES, SCHEDULE_KIND_LABELS, SCHEDULE_STATUS_LABELS } from '../../lib/schedules/labels';
import { minuteToTimeValue, type SyncScheduleRecord } from '../../lib/schedules/types';

interface ScheduleItemProps {
  schedule: SyncScheduleRecord;
  isBusy: boolean;
  onEdit: (schedule: SyncScheduleRecord) => void;
  onDelete: (schedule: SyncScheduleRecord) => Promise<void>;
}

function MetaBadge({ text }: { text: string }) {
  return (
    <Text
      backgroundColor="rgba(255,255,255,0.08)"
      paddingHorizontal="$3"
      paddingVertical="$1"
      borderRadius="$10"
      fontSize="$2"
      color="$muted"
    >
      {text}
    </Text>
  );
}

export function ScheduleItem({ schedule, isBusy, onEdit, onDelete }: ScheduleItemProps) {
  const startLabel = minuteToTimeValue(schedule.startMinute);
  const endLabel = minuteToTimeValue(schedule.endMinute);

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={220}>
            <Paragraph margin={0} size="$6">
              {schedule.label?.trim() || `${SCHEDULE_KIND_LABELS[schedule.kind]} recurrente`}
            </Paragraph>
            <Paragraph margin={0} color="$muted">
              {DAY_NAMES_ES[schedule.dayOfWeek]} · {startLabel} - {endLabel}
            </Paragraph>
          </YStack>

          <XStack gap="$2" flexWrap="wrap">
            <MetaBadge text={`Tipo: ${SCHEDULE_KIND_LABELS[schedule.kind]}`} />
            <MetaBadge text={schedule.enabled ? SCHEDULE_STATUS_LABELS.enabled : SCHEDULE_STATUS_LABELS.disabled} />
          </XStack>
        </XStack>

        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onEdit(schedule)}>
            Editar
          </AppButton>
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onDelete(schedule)}>
            Eliminar
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
