import { useMemo } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { POMODORO_STATE_LABELS } from '../../lib/pomodoro/labels';
import { formatTimer } from '../../lib/pomodoro/timer';
import type { PomodoroConfigFormValues, SyncPomodoroRecord } from '../../lib/pomodoro/types';

interface PomodoroTimerProps {
  session: SyncPomodoroRecord | null;
  linkedTaskName: string | null;
  selectedTaskId: string | null;
  config: PomodoroConfigFormValues;
  remainingSeconds: number;
  phaseDurationMinutes: number | null;
  isBlocking: boolean;
  notificationsEnabled: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  onRefetch: () => Promise<void>;
  onStart: (taskId?: string | null) => Promise<void>;
  onCancel: () => Promise<void>;
  onReset: () => Promise<void>;
  onToggleNotifications: (enabled: boolean) => Promise<void>;
}

export function PomodoroTimer({
  session,
  linkedTaskName,
  selectedTaskId,
  config,
  remainingSeconds,
  phaseDurationMinutes,
  isBlocking,
  notificationsEnabled,
  isLoading,
  isMutating,
  error,
  syncedAt,
  onRefetch,
  onStart,
  onCancel,
  onReset,
  onToggleNotifications,
}: PomodoroTimerProps) {
  const currentState = session?.state ?? 'IDLE';
  const isActive = session?.active ?? false;

  const badgeColor = useMemo(() => {
    if (currentState === 'FOCUS') return 'rgba(226, 72, 72, 0.18)';
    if (currentState === 'SHORT_BREAK') return 'rgba(84, 179, 120, 0.2)';
    if (currentState === 'LONG_BREAK') return 'rgba(78, 128, 255, 0.2)';
    return 'rgba(255,255,255,0.08)';
  }, [currentState]);

  return (
    <YStack gap="$4">
      <AppCard>
        <YStack gap="$4" alignItems="center">
          <Text
            backgroundColor={badgeColor}
            borderRadius="$10"
            paddingHorizontal="$4"
            paddingVertical="$2"
            color="$muted"
          >
            {POMODORO_STATE_LABELS[currentState]}
          </Text>

          <Text fontSize={72} fontWeight="700" letterSpacing={2}>
            {formatTimer(remainingSeconds)}
          </Text>

          <Paragraph margin={0} color="$muted">
            {isActive
              ? `Duracion fase: ${phaseDurationMinutes ?? '-'} min`
              : `Se activa solo durante tu horario de trabajo (${config.focusDurationMin} min por defecto si lo inicias manualmente).`}
          </Paragraph>

          <Paragraph margin={0} color={isBlocking ? '$warning' : '$muted'}>
            {isBlocking ? 'Bloqueo recomendado: activo en fase de enfoque.' : 'Bloqueo recomendado: inactivo.'}
          </Paragraph>

          <Paragraph margin={0} color="$muted">
            {linkedTaskName ? `Tarea vinculada: ${linkedTaskName}` : 'Sin tarea vinculada'}
          </Paragraph>

          <XStack gap="$2" flexWrap="wrap" justifyContent="center">
            <AppButton
              type="button"
              variant="primary"
              disabled={isMutating || isActive || isLoading}
              onPress={() => void onStart(selectedTaskId)}
            >
              Iniciar
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              disabled={isMutating || !isActive}
              onPress={() => void onCancel()}
            >
              Cancelar
            </AppButton>
            <AppButton type="button" variant="ghost" disabled={isMutating} onPress={() => void onReset()}>
              Reiniciar
            </AppButton>
            <AppButton type="button" variant="ghost" disabled={isLoading || isMutating} onPress={() => void onRefetch()}>
              Refrescar
            </AppButton>
          </XStack>

          <XStack gap="$2" alignItems="center">
            <input
              id="pomodoro-notifications"
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => {
                void onToggleNotifications(event.target.checked);
              }}
              disabled={isMutating}
            />
            <label htmlFor="pomodoro-notifications">Notificar al cambiar de fase</label>
          </XStack>
        </YStack>
      </AppCard>

      {error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
