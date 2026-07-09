import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Checkbox, Input, Label } from 'tamagui';
import { DAY_NAMES_ES, SCHEDULE_KIND_LABELS } from '../../lib/schedules/labels';
import {
  SCHEDULE_KINDS,
  minuteToTimeValue,
  timeValueToMinute,
  type ScheduleFormValues,
  type SyncScheduleRecord,
} from '../../lib/schedules/types';
import {
  MAX_LONG_BREAKS,
  countSegmentsByType,
  estimateFocusDurationMin,
  generateFocusPlan,
  loadFocusFeedbackHistory,
} from '../../lib/pomodoro/planner';

interface ScheduleFormProps {
  mode: 'create' | 'edit';
  initialSchedule?: SyncScheduleRecord;
  isSubmitting: boolean;
  onSubmit: (valuesList: ScheduleFormValues[]) => Promise<void>;
  onCancel: () => void;
}

interface ScheduleFormDraft {
  kind: ScheduleFormValues['kind'];
  dayOfWeeks: number[];
  startTime: string;
  endTime: string;
  label: string;
  enabled: boolean;
}

function defaultDraft(schedule?: SyncScheduleRecord): ScheduleFormDraft {
  return {
    kind: schedule?.kind ?? 'WORK',
    dayOfWeeks: [schedule?.dayOfWeek ?? 1],
    startTime: minuteToTimeValue(schedule?.startMinute ?? 9 * 60),
    endTime: minuteToTimeValue(schedule?.endMinute ?? 18 * 60),
    label: schedule?.label ?? '',
    enabled: schedule?.enabled ?? true,
  };
}

export function ScheduleForm({ mode, initialSchedule, isSubmitting, onSubmit, onCancel }: ScheduleFormProps) {
  const [draft, setDraft] = useState<ScheduleFormDraft>(() => defaultDraft(initialSchedule));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialSchedule));
    setError(null);
  }, [initialSchedule, mode]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo horario' : `Editar horario: ${initialSchedule?.label ?? 'sin etiqueta'}`),
    [initialSchedule?.label, mode],
  );

  const focusEstimateMin = useMemo(() => estimateFocusDurationMin(loadFocusFeedbackHistory()), []);

  const focusPlanPreview = useMemo(() => {
    if (draft.kind !== 'WORK') return null;

    const startMinute = timeValueToMinute(draft.startTime);
    const endMinute = timeValueToMinute(draft.endTime);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) return null;

    const plan = generateFocusPlan(startMinute, endMinute, focusEstimateMin);
    if (plan.length === 0) return { plan, pomodoros: 0, shortBreaks: 0, longBreaks: 0, pomodoroMin: focusEstimateMin };

    const firstPomodoro = plan.find((segment) => segment.type === 'pomodoro');

    return {
      plan,
      pomodoros: countSegmentsByType(plan, 'pomodoro'),
      shortBreaks: countSegmentsByType(plan, 'short-break'),
      longBreaks: countSegmentsByType(plan, 'long-break'),
      pomodoroMin: firstPomodoro ? firstPomodoro.endMinute - firstPomodoro.startMinute : focusEstimateMin,
    };
  }, [draft.kind, draft.startTime, draft.endTime, focusEstimateMin]);

  function setField<Key extends keyof ScheduleFormDraft>(field: Key, value: ScheduleFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day: number) {
    if (mode === 'edit') {
      setField('dayOfWeeks', [day]);
      return;
    }

    setDraft((current) => {
      const isSelected = current.dayOfWeeks.includes(day);
      if (isSelected) {
        if (current.dayOfWeeks.length === 1) return current;
        return { ...current, dayOfWeeks: current.dayOfWeeks.filter((value) => value !== day) };
      }
      return { ...current, dayOfWeeks: [...current.dayOfWeeks, day].sort((a, b) => a - b) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const startMinute = timeValueToMinute(draft.startTime);
    const endMinute = timeValueToMinute(draft.endTime);

    if (startMinute === null || endMinute === null) {
      setError('El formato de hora debe ser HH:MM.');
      return;
    }

    if (endMinute <= startMinute) {
      setError('La hora de fin debe ser mayor que la hora de inicio.');
      return;
    }

    if (draft.dayOfWeeks.length === 0) {
      setError('Selecciona al menos un dia.');
      return;
    }

    await onSubmit(
      draft.dayOfWeeks.map((dayOfWeek) => ({
        kind: draft.kind,
        dayOfWeek,
        startMinute,
        endMinute,
        label: draft.label.trim() || null,
        enabled: draft.enabled,
      })),
    );
  }

  return (
    <AppCard>
      <YStack gap="$4" tag="form" onSubmit={handleSubmit}>
        <H2 margin={0} fontSize="$6">
          {title}
        </H2>

        <YStack gap="$2">
          <Paragraph margin={0}>Tipo de bloque</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {SCHEDULE_KINDS.map((kind) => (
              <AppButton
                key={kind}
                type="button"
                variant={draft.kind === kind ? 'primary' : 'ghost'}
                onPress={() => setField('kind', kind)}
              >
                {SCHEDULE_KIND_LABELS[kind]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>{mode === 'create' ? 'Dias de la semana' : 'Dia de la semana'}</Paragraph>
          {mode === 'create' ? (
            <Paragraph margin={0} size="$2" color="$muted">
              Selecciona uno o mas dias: se creara este mismo horario para cada dia elegido.
            </Paragraph>
          ) : null}
          <XStack gap="$2" flexWrap="wrap">
            {DAY_NAMES_ES.map((dayName, index) => (
              <AppButton
                key={dayName}
                type="button"
                variant={draft.dayOfWeeks.includes(index) ? 'primary' : 'ghost'}
                onPress={() => toggleDay(index)}
              >
                {dayName}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={180} gap="$2">
            <Label htmlFor="schedule-start-time">Hora inicio</Label>
            <Input
              id="schedule-start-time"
              type="time"
              value={draft.startTime}
              onChangeText={(value: string) => setField('startTime', value)}
              required
            />
          </YStack>

          <YStack flex={1} minWidth={180} gap="$2">
            <Label htmlFor="schedule-end-time">Hora fin</Label>
            <Input
              id="schedule-end-time"
              type="time"
              value={draft.endTime}
              onChangeText={(value: string) => setField('endTime', value)}
              required
            />
          </YStack>
        </XStack>

        {draft.kind === 'WORK' ? (
          <AppCard backgroundColor="rgba(255,255,255,0.04)">
            <YStack gap="$2">
              <Text fontWeight="700">Plan de enfoque automatico</Text>
              {focusPlanPreview && focusPlanPreview.pomodoros > 0 ? (
                <>
                  <Paragraph margin={0} color="$muted">
                    {focusPlanPreview.pomodoros} pomodoros de {focusPlanPreview.pomodoroMin} min ·{' '}
                    {focusPlanPreview.shortBreaks} descansos cortos de 5 min · {focusPlanPreview.longBreaks} descansos
                    largos (max {MAX_LONG_BREAKS})
                  </Paragraph>
                  <Paragraph margin={0} size="$2" color="$muted">
                    La duracion del pomodoro se ajusta con el tiempo segun cuanto reportes que te concentras.
                  </Paragraph>
                </>
              ) : (
                <Paragraph margin={0} color="$muted">
                  Define un rango de al menos 25 minutos para generar el plan de pomodoros y descansos
                  automaticamente.
                </Paragraph>
              )}
            </YStack>
          </AppCard>
        ) : null}

        <YStack gap="$2">
          <Label htmlFor="schedule-label">Etiqueta (opcional)</Label>
          <Input
            id="schedule-label"
            value={draft.label}
            onChangeText={(value: string) => setField('label', value)}
            placeholder={draft.kind === 'WORK' ? 'Ej. Jornada principal' : 'Ej. Almuerzo'}
          />
        </YStack>

        <XStack gap="$3" alignItems="center">
          <Checkbox
            id="schedule-enabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => setField('enabled', Boolean(checked))}
            size="$4"
          >
            <Checkbox.Indicator />
          </Checkbox>
          <Label htmlFor="schedule-enabled">Horario activo</Label>
        </XStack>

        {error ? (
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        ) : null}

        <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={onCancel} disabled={isSubmitting}>
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Guardando...'
              : mode === 'create'
                ? draft.dayOfWeeks.length > 1
                  ? `Crear ${draft.dayOfWeeks.length} horarios`
                  : 'Crear horario'
                : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
