import { useEffect, useMemo, useState } from 'react';
import { Input } from 'tamagui';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
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
  onUpdateConfig: (values: PomodoroConfigFormValues) => Promise<void>;
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
  onUpdateConfig,
  onToggleNotifications,
}: PomodoroTimerProps) {
  const [draftConfig, setDraftConfig] = useState<PomodoroConfigFormValues>(config);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  const currentState = session?.state ?? 'IDLE';
  const isActive = session?.active ?? false;

  const badgeColor = useMemo(() => {
    if (currentState === 'FOCUS') return 'rgba(226, 72, 72, 0.18)';
    if (currentState === 'SHORT_BREAK') return 'rgba(84, 179, 120, 0.2)';
    if (currentState === 'LONG_BREAK') return 'rgba(78, 128, 255, 0.2)';
    return 'rgba(255,255,255,0.08)';
  }, [currentState]);

  async function handleSaveConfig() {
    setConfigError(null);

    const normalized: PomodoroConfigFormValues = {
      focusDurationMin: Number(draftConfig.focusDurationMin),
      shortBreakMin: Number(draftConfig.shortBreakMin),
      longBreakMin: Number(draftConfig.longBreakMin),
      cyclesBeforeLongBreak: Number(draftConfig.cyclesBeforeLongBreak),
    };

    const values = Object.values(normalized);
    const hasInvalidValue = values.some((value) => !Number.isInteger(value) || value < 1);
    if (hasInvalidValue) {
      setConfigError('Todos los valores deben ser enteros mayores o iguales a 1.');
      return;
    }

    await onUpdateConfig(normalized);
  }

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
              : `Proximo enfoque: ${config.focusDurationMin} min`}
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

      {!isActive ? (
        <AppCard>
          <YStack gap="$3">
            <H2 margin={0} fontSize="$6">
              Configuracion del ciclo
            </H2>

            <XStack gap="$3" flexWrap="wrap">
              <YStack gap="$2" minWidth={160}>
                <Paragraph margin={0}>Enfoque (min)</Paragraph>
                <Input
                  type="number"
                  min={1}
                  value={String(draftConfig.focusDurationMin)}
                  onChangeText={(value: string) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      focusDurationMin: Number(value || 0),
                    }))
                  }
                />
              </YStack>

              <YStack gap="$2" minWidth={160}>
                <Paragraph margin={0}>Descanso corto (min)</Paragraph>
                <Input
                  type="number"
                  min={1}
                  value={String(draftConfig.shortBreakMin)}
                  onChangeText={(value: string) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      shortBreakMin: Number(value || 0),
                    }))
                  }
                />
              </YStack>

              <YStack gap="$2" minWidth={160}>
                <Paragraph margin={0}>Descanso largo (min)</Paragraph>
                <Input
                  type="number"
                  min={1}
                  value={String(draftConfig.longBreakMin)}
                  onChangeText={(value: string) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      longBreakMin: Number(value || 0),
                    }))
                  }
                />
              </YStack>

              <YStack gap="$2" minWidth={160}>
                <Paragraph margin={0}>Ciclos para descanso largo</Paragraph>
                <Input
                  type="number"
                  min={1}
                  value={String(draftConfig.cyclesBeforeLongBreak)}
                  onChangeText={(value: string) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      cyclesBeforeLongBreak: Number(value || 0),
                    }))
                  }
                />
              </YStack>
            </XStack>

            {configError ? (
              <Paragraph color="$error" margin={0}>
                {configError}
              </Paragraph>
            ) : null}

            <XStack justifyContent="flex-end">
              <AppButton type="button" variant="primary" disabled={isMutating} onPress={() => void handleSaveConfig()}>
                Guardar configuracion
              </AppButton>
            </XStack>
          </YStack>
        </AppCard>
      ) : null}

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
