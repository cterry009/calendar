import { useState } from 'react';
import { AppButton, AppCard, H2, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { FitnessForm } from '../fitness/FitnessForm';
import { TaskForm } from '../tasks/TaskForm';
import type { CalendarEvent } from '../../lib/calendar/types';
import type { FitnessFormValues } from '../../lib/fitness/types';
import type { TaskFormValues } from '../../lib/tasks/types';

interface DayViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onCreateTask: (values: TaskFormValues) => Promise<void>;
  isCreatingTask: boolean;
  onCreateFitness: (values: FitnessFormValues) => Promise<void>;
  isCreatingFitness: boolean;
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

function isWithinBlock(event: CalendarEvent, block: CalendarEvent): boolean {
  return event.start >= block.start && event.start < block.end;
}

/** Clamps "now" into a block's range, so a rest block in the past/future still gets a sensible default. */
function clampIntoBlock(date: Date, block: CalendarEvent): Date {
  if (date < block.start || date >= block.end) return block.start;
  return date;
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <XStack
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
  );
}

export function DayView({
  selectedDate,
  events,
  onCreateTask,
  isCreatingTask,
  onCreateFitness,
  isCreatingFitness,
}: DayViewProps) {
  const [openTaskFormBlockId, setOpenTaskFormBlockId] = useState<string | null>(null);
  const [openFitnessFormBlockId, setOpenFitnessFormBlockId] = useState<string | null>(null);

  const blocks = events
    .filter((event) => event.type === 'work' || event.type === 'rest')
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const otherEvents = events.filter((event) => event.type !== 'work' && event.type !== 'rest');
  const unassignedEvents = otherEvents.filter(
    (event) => !blocks.some((block) => isWithinBlock(event, block)),
  );

  async function handleCreateTask(values: TaskFormValues) {
    await onCreateTask(values);
    setOpenTaskFormBlockId(null);
  }

  async function handleCreateFitness(values: FitnessFormValues) {
    await onCreateFitness(values);
    setOpenFitnessFormBlockId(null);
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6" textTransform="capitalize">
            Agenda del dia
          </H2>
          <Paragraph color="$muted" margin={0}>
            {selectedDate.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Paragraph>
        </YStack>

        {blocks.length === 0 && unassignedEvents.length === 0 ? (
          <Paragraph color="$muted" margin={0}>
            Sin eventos para este dia. Define horarios de trabajo y descanso para empezar a planificar.
          </Paragraph>
        ) : null}

        {blocks.map((block) => {
          const items = otherEvents.filter((event) => isWithinBlock(event, block));
          const isWork = block.type === 'work';

          return (
            <YStack
              key={block.id}
              gap="$3"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$borderColor"
              backgroundColor="rgba(255,255,255,0.02)"
              data-tutorial={isWork ? 'day-work-block' : 'day-rest-block'}
            >
              <YStack>
                <Text fontWeight="700" color={EVENT_TYPE_COLOR[block.type]}>
                  {EVENT_TYPE_LABEL[block.type]}: {block.title}
                </Text>
                <Text color="$muted" fontSize="$2">
                  {formatTimeRange(block.start, block.end)}
                </Text>
              </YStack>

              {items.length > 0 ? (
                <YStack gap="$2">
                  {items.map((item) => (
                    <EventRow key={item.id} event={item} />
                  ))}
                </YStack>
              ) : (
                <Paragraph size="$2" color="$muted" margin={0}>
                  {isWork ? 'Sin tareas asignadas todavia.' : 'Sin fitness registrado en este descanso.'}
                </Paragraph>
              )}

              {isWork ? (
                openTaskFormBlockId === block.id ? (
                  <TaskForm
                    mode="create"
                    isSubmitting={isCreatingTask}
                    initialScheduledAt={block.start.toISOString()}
                    onSubmit={handleCreateTask}
                    onCancel={() => setOpenTaskFormBlockId(null)}
                  />
                ) : (
                  <AppButton variant="small" alignSelf="flex-start" onPress={() => setOpenTaskFormBlockId(block.id)}>
                    + Agregar tarea
                  </AppButton>
                )
              ) : openFitnessFormBlockId === block.id ? (
                <FitnessForm
                  mode="create"
                  isSubmitting={isCreatingFitness}
                  initialLoggedAt={clampIntoBlock(new Date(), block).toISOString()}
                  onSubmit={handleCreateFitness}
                  onCancel={() => setOpenFitnessFormBlockId(null)}
                />
              ) : (
                <AppButton
                  variant="small"
                  alignSelf="flex-start"
                  onPress={() => setOpenFitnessFormBlockId(block.id)}
                >
                  + Registrar fitness
                </AppButton>
              )}
            </YStack>
          );
        })}

        {unassignedEvents.length > 0 ? (
          <YStack gap="$2">
            <H3 margin={0} fontSize="$4" color="$muted">
              Otros eventos
            </H3>
            {unassignedEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </YStack>
        ) : null}
      </YStack>
    </AppCard>
  );
}
