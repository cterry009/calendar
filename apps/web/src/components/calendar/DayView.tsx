import { useMemo, useState } from 'react';
import { AppButton, AppCard, H2, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { DayTimeGrid } from './DayTimeGrid';
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from './eventStyles';
import { FitnessForm } from '../fitness/FitnessForm';
import { QuickAddTask } from '../tasks/QuickAddTask';
import type { CalendarEvent } from '../../lib/calendar/types';
import { isSameDay } from '../../lib/calendar/utils';
import type { FitnessFormValues } from '../../lib/fitness/types';
import type { TaskFormValues } from '../../lib/tasks/types';
import {
  MAX_LONG_BREAKS,
  countSegmentsByType,
  generateFocusPlan,
  resolveFocusPlanConfig,
} from '../../lib/pomodoro/planner';

function pomodoroLengthForBlock(block: CalendarEvent): number {
  return resolveFocusPlanConfig({
    startMinute: minuteOfDay(block.start),
    endMinute: minuteOfDay(block.end),
    pomodoroMin: block.meta?.pomodoroMin ?? null,
    shortBreakMin: block.meta?.shortBreakMin ?? null,
    longBreakMin: block.meta?.longBreakMin ?? null,
    pomodorosPerChunk: block.meta?.pomodorosPerChunk ?? null,
    chunks: block.meta?.chunks ?? null,
  }).pomodoroMin;
}

interface DayViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onCreateTask: (values: TaskFormValues) => Promise<void>;
  isCreatingTask: boolean;
  onCreateFitness: (values: FitnessFormValues) => Promise<void>;
  isCreatingFitness: boolean;
  onStartFocusSegment: (focusDurationMin: number) => Promise<void>;
  isStartingFocus: boolean;
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

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

function FocusPlanSummary({
  block,
  isToday,
  onStartFocusSegment,
  isStartingFocus,
}: {
  block: CalendarEvent;
  isToday: boolean;
  onStartFocusSegment: (focusDurationMin: number) => Promise<void>;
  isStartingFocus: boolean;
}) {
  const planConfig = useMemo(
    () =>
      resolveFocusPlanConfig({
        startMinute: minuteOfDay(block.start),
        endMinute: minuteOfDay(block.end),
        pomodoroMin: block.meta?.pomodoroMin ?? null,
        shortBreakMin: block.meta?.shortBreakMin ?? null,
        longBreakMin: block.meta?.longBreakMin ?? null,
        pomodorosPerChunk: block.meta?.pomodorosPerChunk ?? null,
        chunks: block.meta?.chunks ?? null,
      }),
    [
      block.meta?.pomodoroMin,
      block.meta?.shortBreakMin,
      block.meta?.longBreakMin,
      block.meta?.pomodorosPerChunk,
      block.meta?.chunks,
      block.start,
      block.end,
    ],
  );

  const plan = useMemo(
    () => generateFocusPlan(minuteOfDay(block.start), minuteOfDay(block.end), planConfig),
    [block.start, block.end, planConfig],
  );

  if (plan.length === 0) return null;

  const nowMinute = isToday ? minuteOfDay(new Date()) : -1;
  const currentSegment = plan.find((segment) => nowMinute >= segment.startMinute && nowMinute < segment.endMinute);
  const longBreaks = countSegmentsByType(plan, 'long-break');
  const pomodoros = countSegmentsByType(plan, 'pomodoro');

  return (
    <XStack gap="$3" alignItems="center" flexWrap="wrap">
      <Text fontSize="$2" color="$muted">
        Plan automatico: {pomodoros} pomodoros · {longBreaks}/{MAX_LONG_BREAKS} descansos largos
      </Text>

      {currentSegment?.type === 'pomodoro' ? (
        <AppButton
          variant="small"
          disabled={isStartingFocus}
          onPress={() => void onStartFocusSegment(currentSegment.endMinute - currentSegment.startMinute)}
        >
          Iniciar pomodoro ({currentSegment.endMinute - currentSegment.startMinute} min)
        </AppButton>
      ) : null}
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
  onStartFocusSegment,
  isStartingFocus,
}: DayViewProps) {
  const [openFitnessFormBlockId, setOpenFitnessFormBlockId] = useState<string | null>(null);
  const isSelectedDateToday = isSameDay(selectedDate, new Date());

  const blocks = events
    .filter((event) => event.type === 'work' || event.type === 'rest')
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const otherEvents = events.filter((event) => event.type !== 'work' && event.type !== 'rest');
  const unassignedEvents = otherEvents.filter(
    (event) => !blocks.some((block) => isWithinBlock(event, block)),
  );

  async function handleCreateFitness(values: FitnessFormValues) {
    await onCreateFitness(values);
    setOpenFitnessFormBlockId(null);
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <XStack alignItems="center" gap="$4" flexWrap="wrap">
          <YStack alignItems="center" minWidth={84}>
            <Text fontSize="$3" color="$muted" textTransform="uppercase" letterSpacing={1}>
              {selectedDate.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}
            </Text>
            <Text
              fontSize={64}
              fontWeight="800"
              lineHeight={64}
              color={isSelectedDateToday ? '$primary' : '$color'}
            >
              {selectedDate.getDate()}
            </Text>
          </YStack>

          <YStack gap="$1">
            <H2 margin={0} fontSize="$6" textTransform="capitalize">
              Agenda del dia
            </H2>
            <Paragraph color="$muted" margin={0} textTransform="capitalize">
              {selectedDate.toLocaleDateString('es-ES', {
                weekday: 'long',
                month: 'long',
                year: 'numeric',
              })}
            </Paragraph>
          </YStack>
        </XStack>

        {blocks.length === 0 && unassignedEvents.length === 0 ? (
          <Paragraph color="$muted" margin={0}>
            Sin eventos para este dia. Define horarios de trabajo y descanso para empezar a planificar.
          </Paragraph>
        ) : (
          <DayTimeGrid
            selectedDate={selectedDate}
            blocks={blocks}
            otherEvents={otherEvents}
            isToday={isSelectedDateToday}
            onStartFocusSegment={onStartFocusSegment}
            isStartingFocus={isStartingFocus}
          />
        )}

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

              {isWork ? (
                <FocusPlanSummary
                  block={block}
                  isToday={isSelectedDateToday}
                  onStartFocusSegment={onStartFocusSegment}
                  isStartingFocus={isStartingFocus}
                />
              ) : null}

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
                <QuickAddTask
                  isSubmitting={isCreatingTask}
                  initialScheduledAt={block.start.toISOString()}
                  pomodoroLengthMin={pomodoroLengthForBlock(block)}
                  onSubmit={onCreateTask}
                />
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
