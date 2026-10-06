import { ATTENTION_PROFILE_SPECS } from '@calendar/shared';
import { Text, XStack, YStack } from '@calendar/ui';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import { usePomodoro } from '../context/PomodoroContext';
import { useBlockExit } from '../hooks/useBlockFocus';
import { useCalendarData } from '../hooks/useCalendarData';
import { formatTimer } from '../lib/pomodoro/timer';

const PHASES: Record<string, string> = {
  FOCUS: 'Enfoque',
  SHORT_BREAK: 'Pausa',
  LONG_BREAK: 'Pausa larga',
};

/**
 * The running pomodoro, on every screen: phase, time left, profile and task, with "Cancelar".
 * The desktop shows its timer over whatever is open instead of on a page of its own; this is the
 * phone's version of that (user-requested, 2026-10-01). Tapping it opens the full timer.
 */
export function FocusBar() {
  const { session, remainingSeconds, cancel, isMutating } = usePomodoro();
  const { tasks, refetch, isLoading } = useCalendarData();
  const pathname = usePathname();
  const { leave, comeBack, isOut, exits } = useBlockExit();
  const inBlock = !!session?.scheduleId;
  const task = session?.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const missingTask = !!session?.active && !!session.taskId && !task;

  // A block can start on a task created after this bar loaded its tasks (the phone gets no live
  // updates), so pull once when the running task isn't in the list.
  const pulledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!missingTask || isLoading || pulledFor.current === session?.taskId) return;
    pulledFor.current = session?.taskId ?? null;
    void refetch();
  }, [missingTask, isLoading, refetch, session?.taskId]);

  if (!session?.active || pathname === '/pomodoro') return null;

  const profile = session.attentionProfile ? ATTENTION_PROFILE_SPECS[session.attentionProfile].name : null;
  const focus = session.state === 'FOCUS' && !isOut;
  const exitsLabel = exits > 0 ? ` · ${exits} ${exits === 1 ? 'salida' : 'salidas'}` : '';

  return (
    <Pressable onPress={() => router.push('/pomodoro')}>
      <XStack
        backgroundColor={focus ? 'rgba(62, 207, 142, 0.16)' : 'rgba(224, 184, 74, 0.16)'}
        paddingHorizontal="$4"
        paddingVertical="$2"
        gap="$3"
        alignItems="center"
      >
        <Text fontSize="$6" fontWeight="700" color={focus ? '$accent' : '$warning'} style={{ fontVariant: ['tabular-nums'] }}>
          {isOut ? '⏸' : formatTimer(remainingSeconds)}
        </Text>
        <YStack flex={1}>
          <Text fontSize="$2" fontWeight="700" numberOfLines={1}>
            {isOut ? 'Fuera del bloque · el tiempo no cuenta' : PHASES[session.state] ?? session.state}
            {!isOut && profile ? ` · ${profile}` : ''}
            {!isOut ? ` · ciclo ${session.completedCycles + (focus ? 1 : 0)}` : ''}
            {exitsLabel}
          </Text>
          {task ? (
            <Text fontSize="$2" color="$muted" numberOfLines={1}>
              {task.title}
            </Text>
          ) : null}
        </YStack>
        {inBlock ? (
          // In a WORK block: leave it (time stops, the exit counts) or come back, not cancel.
          <Pressable onPress={() => void (isOut ? comeBack() : leave())} disabled={isMutating} hitSlop={10}>
            <Text fontSize="$2" fontWeight="700" color={isOut ? '$accent' : '$warning'}>
              {isOut ? 'Volver' : 'Salir'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void cancel()} disabled={isMutating} hitSlop={10}>
            <Text fontSize="$2" fontWeight="700" color="$danger">
              Cancelar
            </Text>
          </Pressable>
        )}
      </XStack>
    </Pressable>
  );
}
