import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';

interface DayViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
}

const EVENT_TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  task: 'Tarea',
  work: 'Trabajo',
  rest: 'Descanso',
  pomodoro: 'Pomodoro',
  fitness: 'Fitness',
};

const EVENT_TYPE_COLOR: Record<CalendarEvent['type'], string> = {
  task: '$accent',
  work: '$success',
  rest: '$warning',
  pomodoro: '$muted',
  fitness: '$info',
};

function formatTimeRange(start: Date, end: Date): string {
  const startLabel = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const endLabel = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${startLabel} - ${endLabel}`;
}

export function DayView({ selectedDate, events }: DayViewProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6" textTransform="capitalize">
            Agenda del día
          </H2>
          <Paragraph color="$muted" margin={0}>
            {selectedDate.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Paragraph>
        </YStack>

        {events.length === 0 ? (
          <Paragraph color="$muted" margin={0}>
            Sin eventos para este día.
          </Paragraph>
        ) : (
          <YStack gap="$3">
            {events.map((event) => (
              <XStack
                key={event.id}
                justifyContent="space-between"
                alignItems="center"
                gap="$3"
                padding="$3"
                borderRadius="$3"
                backgroundColor="rgba(255,255,255,0.03)"
                borderLeftWidth={3}
                borderLeftColor={EVENT_TYPE_COLOR[event.type]}
              >
                <YStack flex={1} gap="$1">
                  <Text fontWeight="700">{event.title}</Text>
                  <Paragraph size="$2" color="$muted" margin={0}>
                    {EVENT_TYPE_LABEL[event.type]}
                  </Paragraph>
                </YStack>

                <Text fontSize="$3" color="$muted">
                  {formatTimeRange(event.start, event.end)}
                </Text>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    </AppCard>
  );
}
