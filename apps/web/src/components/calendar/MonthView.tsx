import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { CalendarDensity, MonthDaySummary } from '../../lib/calendar/types';

interface MonthViewProps {
  days: MonthDaySummary[];
}

const DENSITY_COLOR: Record<CalendarDensity, string> = {
  none: '$muted',
  low: '$accent',
  medium: '$warning',
  high: '$success',
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function MonthView({ days }: MonthViewProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <H2 margin={0} fontSize="$6">
          Vista mensual
        </H2>

        <XStack gap="$2">
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} flex={1} textAlign="center" color="$muted" fontSize="$2">
              {label}
            </Text>
          ))}
        </XStack>

        <XStack flexWrap="wrap" gap="$2">
          {days.map((day) => (
            <YStack
              key={day.date.toISOString()}
              width="14.285%"
              minWidth={96}
              minHeight={92}
              padding="$2"
              borderRadius="$3"
              borderWidth={1}
              borderColor={day.inCurrentMonth ? '$borderColor' : 'transparent'}
              backgroundColor={day.inCurrentMonth ? 'rgba(255,255,255,0.03)' : 'transparent'}
            >
              <Text color={day.inCurrentMonth ? '$color' : '$muted'}>{day.date.getDate()}</Text>
              <YStack marginTop="auto" gap="$1">
                <Text color={DENSITY_COLOR[day.density]} fontSize="$2">
                  {day.taskCount + day.pomodoroCount} eventos
                </Text>
                <Paragraph size="$1" color="$muted" margin={0}>
                  {day.taskCount} tareas / {day.pomodoroCount} pomodoros
                </Paragraph>
              </YStack>
            </YStack>
          ))}
        </XStack>
      </YStack>
    </AppCard>
  );
}
