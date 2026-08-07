import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSoftFocus } from '../../context/SoftFocusContext';
import { useBlockList } from '../../hooks/useBlockList';
import { useTasks } from '../../hooks/useTasks';
import { recordFocusFeedbackSample } from '../../lib/pomodoro/planner';
import { formatTimer } from '../../lib/pomodoro/timer';

const FOCUS_REMINDER_KINDS = new Set(['WEBSITE', 'DESKTOP_APP', 'MOBILE_APP']);

const DEFAULT_REMINDERS = [
  'Cierra redes sociales, mensajeria y videos cortos.',
  'Evita abrir pestañas nuevas fuera de la tarea actual.',
  'Silencia notificaciones no esenciales durante el enfoque.',
];

const KIND_LABELS: Record<string, string> = {
  WEBSITE: 'Sitio web',
  DESKTOP_APP: 'App de escritorio',
  MOBILE_APP: 'App movil',
};

export function SoftFocusOverlay() {
  const pomodoro = usePomodoro();
  const softFocus = useSoftFocus();
  const blockList = useBlockList();
  const tasksData = useTasks();
  const [feedbackSavedFor, setFeedbackSavedFor] = useState<string | null>(null);

  const isPomodoroBlocking = pomodoro.isBlocking;
  const isManualFocus = !isPomodoroBlocking && softFocus.manualSoftFocus.active;
  const isWorkHoursBlocking = !isPomodoroBlocking && !isManualFocus && softFocus.isWorkHoursActive;
  const isVisible = softFocus.isOverlayVisible;

  const timerLabel = useMemo(() => {
    if (isPomodoroBlocking) {
      return pomodoro.remainingSeconds;
    }
    if (isManualFocus) {
      return softFocus.manualRemainingSeconds;
    }
    return null;
  }, [isManualFocus, isPomodoroBlocking, pomodoro.remainingSeconds, softFocus.manualRemainingSeconds]);

  const phaseLabel = isPomodoroBlocking
    ? 'Enfoque pomodoro activo'
    : isManualFocus
      ? 'Modo enfoque manual'
      : 'Bloqueo obligatorio: horario de trabajo activo';
  const taskTitle = useMemo(() => {
    const taskId = pomodoro.session?.taskId;
    if (!taskId) {
      return null;
    }
    return tasksData.tasks.find((task) => task.id === taskId)?.title ?? null;
  }, [pomodoro.session?.taskId, tasksData.tasks]);

  const reminders = useMemo(
    () =>
      blockList.enabledEntries
        .filter((entry) => FOCUS_REMINDER_KINDS.has(entry.kind))
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          kind: KIND_LABELS[entry.kind] ?? entry.kind,
        })),
    [blockList.enabledEntries],
  );

  const plannedFocusMin = pomodoro.phaseDurationMinutes ?? pomodoro.config.focusDurationMin;
  const feedbackKey = pomodoro.session ? `${pomodoro.session.id}-${pomodoro.session.completedCycles}` : null;

  function handleRecordFeedback(fraction: number) {
    if (!feedbackKey) return;
    recordFocusFeedbackSample(Math.max(1, Math.round(plannedFocusMin * fraction)));
    setFeedbackSavedFor(feedbackKey);
  }

  if (!isVisible || typeof document === 'undefined') {
    return null;
  }

  async function handleExit() {
    if (isPomodoroBlocking) {
      const confirmed = window.confirm('Esto cancelara el pomodoro activo. Deseas salir del enfoque?');
      if (!confirmed) {
        return;
      }
      await pomodoro.cancel();
      return;
    }

    if (isWorkHoursBlocking) {
      softFocus.dismissWorkHoursFocus();
      return;
    }

    softFocus.stopManualFocus();
  }

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
      backgroundColor="rgba(18, 21, 27, 0.94)"
      justifyContent="center"
      alignItems="center"
      padding="$6"
    >
      <YStack
        width="100%"
        maxWidth={860}
        borderWidth={1}
        borderColor="rgba(234,240,238,0.14)"
        borderRadius="$8"
        backgroundColor="rgba(33, 40, 54, 0.92)"
        padding="$6"
        gap="$4"
      >
        <Text color="$warning" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
          Recordatorio visual de enfoque
        </Text>

        {timerLabel !== null ? (
          <Text fontSize={64} fontWeight="800" lineHeight={72}>
            {formatTimer(timerLabel)}
          </Text>
        ) : null}

        <Paragraph margin={0} color="$muted">
          {phaseLabel}
        </Paragraph>

        {isWorkHoursBlocking ? (
          <Paragraph margin={0} color="$muted">
            Este bloqueo permanece activo mientras dure tu horario de trabajo configurado.
          </Paragraph>
        ) : null}

        {taskTitle ? (
          <Paragraph margin={0}>
            Tarea vinculada: <Text fontWeight="700">{taskTitle}</Text>
          </Paragraph>
        ) : null}

        <YStack gap="$2">
          <Text fontWeight="700">Evita estos distractores durante esta sesion:</Text>
          {blockList.isLoading ? (
            <Paragraph margin={0} color="$muted">
              Cargando recordatorios de bloqueo...
            </Paragraph>
          ) : reminders.length ? (
            reminders.map((entry) => (
              <Paragraph key={entry.id} margin={0}>
                - {entry.label} ({entry.kind})
              </Paragraph>
            ))
          ) : (
            DEFAULT_REMINDERS.map((entry) => (
              <Paragraph key={entry} margin={0}>
                - {entry}
              </Paragraph>
            ))
          )}
          {blockList.error ? (
            <Paragraph margin={0} color="$error">
              {blockList.error}
            </Paragraph>
          ) : null}
        </YStack>

        <Paragraph margin={0} color="$warning">
          Aviso: este modo solo muestra recordatorios visuales en web y no bloquea aplicaciones ni sitios a nivel
          sistema operativo.
        </Paragraph>

        {isPomodoroBlocking ? (
          <YStack gap="$2" borderTopWidth={1} borderTopColor="rgba(255,255,255,0.12)" paddingTop="$4">
            {feedbackSavedFor === feedbackKey ? (
              <Paragraph margin={0} color="$success" size="$2">
                Gracias, usaremos esto para ajustar la duracion sugerida del pomodoro.
              </Paragraph>
            ) : (
              <>
                <Text fontWeight="700" size="$2">
                  ¿Cuanto llevas concentrado de verdad en este pomodoro?
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  <AppButton variant="ghost" onPress={() => handleRecordFeedback(1)}>
                    Todo ({plannedFocusMin} min)
                  </AppButton>
                  <AppButton variant="ghost" onPress={() => handleRecordFeedback(0.75)}>
                    Casi todo
                  </AppButton>
                  <AppButton variant="ghost" onPress={() => handleRecordFeedback(0.5)}>
                    La mitad
                  </AppButton>
                  <AppButton variant="ghost" onPress={() => handleRecordFeedback(0.25)}>
                    Poco
                  </AppButton>
                </XStack>
              </>
            )}
          </YStack>
        ) : null}

        <XStack justifyContent="flex-end" marginTop="$2">
          <AppButton variant="ghost" onPress={() => void handleExit()} disabled={pomodoro.isMutating}>
            Salir del enfoque
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
